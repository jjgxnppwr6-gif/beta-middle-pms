// ============================================
// PMS Cockpit v2.3 — Calculations
// ============================================

import type {
  Position,
  Portfolio,
  FXRates,
  FXTrade,
  CustodianPosition,
  NAVReconciliation,
  PositionBreak,
  CashBreak,
  BreakCauseAnalysis,
  BreakCause,
  RebalanceConfig,
  RebalanceResult,
  RebalanceAllocation,
  SettlementHorizon,
  Currency,
  CashBucket,
  Basket,
  CashProjection,
  ShadowNAVCard,
  NAVBridgeItem,
} from '../types';
import { uid } from '../fmt';

// ============================================
// Safe Helpers
// ============================================

function safeNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(num) ? num : 0;
}

function getFX(rates: FXRates, currency: string): number {
  return safeNum(rates[currency]) || 1.0;
}

// ============================================
// Cash Calculations (v2.1)
// ============================================

export function getCumulativeCashAtHorizon(
  cashBuckets: CashBucket[],
  horizon: SettlementHorizon,
  fxRates: FXRates
): number {
  // Buckets are CUMULATIVE: T = available now, T1 = available by T+1, T2 = available by T+2
  // So we read the horizon column directly (not sum)
  let total = 0;

  for (const bucket of cashBuckets) {
    const fx = getFX(fxRates, bucket.currency);
    let localAmount = 0;

    switch (horizon) {
      case 'T':
        localAmount = safeNum(bucket.T);
        break;
      case 'T1':
        localAmount = safeNum(bucket.T1);
        break;
      case 'T2':
      default:
        localAmount = safeNum(bucket.T2);
        break;
    }

    total += localAmount * fx;
  }

  return total;
}

// Helper to get cash at a specific bucket for a currency
export function getCashAtBucket(
  cashBuckets: CashBucket[],
  currency: Currency,
  bucket: 'T' | 'T1' | 'T2' | 'T3' | 'T5'
): number {
  const found = cashBuckets.find(b => b.currency === currency);
  if (!found) return 0;
  return safeNum(found[bucket]);
}

// Derive total cash USD equivalent from T bucket (single source of truth)
export function getTotalCashUSD(
  cashBuckets: CashBucket[],
  fxRates: FXRates
): number {
  return cashBuckets.reduce((total, bucket) => {
    const fx = getFX(fxRates, bucket.currency);
    return total + safeNum(bucket.T) * fx;
  }, 0);
}

export function getInvestableCash(
  availableCash: number,
  targetCashPct: number,
  navUSD: number
): number {
  const targetCashAmt = (targetCashPct / 100) * navUSD;
  return Math.max(0, availableCash - targetCashAmt);
}

export function applyPendingFXToCashLadder(
  baseBuckets: CashBucket[],
  pendingFX: FXTrade[],
  fxRates: FXRates
): CashBucket[] {
  // Clone buckets
  const buckets = baseBuckets.map((b) => ({ ...b }));

  for (const fx of pendingFX) {
    if (fx.status !== 'Pending') continue;

    // settlementBucket is a property of FXTrade; default to T2 if somehow missing
    const bucketKey: 'T' | 'T1' | 'T2' | 'T3' | 'T5' = fx.settlementBucket || 'T2';

    // Find sell currency bucket and subtract from this bucket and all future buckets (cumulative)
    const sellBucket = buckets.find((b) => b.currency === fx.sellCcy);
    if (sellBucket) {
      const bucketsToUpdate = getBucketsFromHorizon(bucketKey);
      for (const bk of bucketsToUpdate) {
        sellBucket[bk] -= fx.sellAmt;
      }
      sellBucket.total -= fx.sellAmt;
      sellBucket.equivUSD -= fx.sellAmt * getFX(fxRates, fx.sellCcy);
    }

    // Find buy currency bucket and add to this bucket and all future buckets (cumulative)
    const buyBucket = buckets.find((b) => b.currency === fx.buyCcy);
    if (buyBucket) {
      const bucketsToUpdate = getBucketsFromHorizon(bucketKey);
      for (const bk of bucketsToUpdate) {
        buyBucket[bk] += fx.buyAmt;
      }
      buyBucket.total += fx.buyAmt;
      buyBucket.equivUSD += fx.buyAmt * getFX(fxRates, fx.buyCcy);
    }
  }

  return buckets;
}

// Helper: for cumulative buckets, when something settles at T1, it affects T1, T2, T3, T5
function getBucketsFromHorizon(startBucket: 'T' | 'T1' | 'T2' | 'T3' | 'T5'): ('T' | 'T1' | 'T2' | 'T3' | 'T5')[] {
  const allBuckets: ('T' | 'T1' | 'T2' | 'T3' | 'T5')[] = ['T', 'T1', 'T2', 'T3', 'T5'];
  const startIdx = allBuckets.indexOf(startBucket);
  return allBuckets.slice(startIdx);
}

// ============================================
// Rebalance Calculations (v2.1)
// ============================================

export function calculateRebalance(
  portfolio: Portfolio,
  config: RebalanceConfig,
  fxRates: FXRates,
  selectedTickers: Set<string>
): RebalanceResult {
  const { mode, investableCash, autoFX, fxExecutionType } = config;
  const nav = safeNum(portfolio.navUSD) || 1;

  // Filter positions based on mode
  let candidates: Position[] = [];
  const skipped: { ticker: string; reason: string }[] = [];

  for (const pos of portfolio.positions) {
    if (!pos.tradable) {
      skipped.push({ ticker: pos.ticker, reason: 'Not tradable' });
      continue;
    }
    if (pos.restricted) {
      skipped.push({ ticker: pos.ticker, reason: 'Restricted' });
      continue;
    }
    if (!pos.price || pos.price <= 0) {
      skipped.push({ ticker: pos.ticker, reason: 'Missing price' });
      continue;
    }

    switch (mode) {
      case 'everything':
        candidates.push(pos);
        break;
      case 'selected':
        if (selectedTickers.has(pos.ticker)) {
          candidates.push(pos);
        }
        break;
      case 'active':
        // Eligible universe: |diffBps| >= 10 (both over and underweights)
        if (Math.abs(pos.diffBps) >= 10) {
          candidates.push(pos);
        }
        break;
    }
  }

  if (candidates.length === 0) {
    return {
      allocations: [],
      fxOrders: [],
      totalInvested: 0,
      totalSold: 0,
      residual: investableCash,
      skipped,
      summary: {
        mode,
        ordersCount: 0,
        fxOrdersCount: 0,
        cashBefore: portfolio.currentCashUSD,
        cashAfter: portfolio.currentCashUSD,
        topReasons: ['No eligible securities for this mode'],
        largestAllocations: [],
      },
    };
  }

  // For active mode: generate both buys AND sells to track index
  if (mode === 'active') {
    return calculateActiveRebalance(portfolio, config, fxRates, candidates, skipped);
  }

  // For everything/selected modes: cash deployment only (buys)
  return calculateCashDeployment(portfolio, config, fxRates, candidates, skipped, selectedTickers);
}

// Active mode: buys and sells to minimize tracking error
function calculateActiveRebalance(
  portfolio: Portfolio,
  config: RebalanceConfig,
  fxRates: FXRates,
  candidates: Position[],
  skipped: { ticker: string; reason: string }[]
): RebalanceResult {
  const { investableCash, autoFX, fxExecutionType } = config;
  const nav = safeNum(portfolio.navUSD) || 1;

  const allocations: RebalanceAllocation[] = [];
  let totalBought = 0;
  let totalSold = 0;

  // Separate overweights (sell) and underweights (buy)
  const overweights = candidates.filter(p => p.diffBps >= 10).sort((a, b) => b.diffBps - a.diffBps);
  const underweights = candidates.filter(p => p.diffBps <= -10).sort((a, b) => a.diffBps - b.diffBps);

  // Calculate sell orders first (overweights → reduce to index weight)
  for (const pos of overweights) {
    const fx = getFX(fxRates, pos.currency);
    const localPrice = safeNum(pos.price);
    
    // Target: bring weight down to index weight
    const currentValue = pos.marketValue;
    const targetValue = (pos.indexWeight / 100) * nav;
    const sellValueUSD = currentValue - targetValue;
    
    if (sellValueUSD < 1000) continue; // Skip tiny sells
    
    const sellValueLocal = sellValueUSD / fx;
    const sellQty = Math.floor(sellValueLocal / localPrice);
    
    if (sellQty > 0) {
      const actualNotional = sellQty * localPrice * fx;
      totalSold += actualNotional;
      
      // Determine settlement bucket: US = T+1, Rest = T+2
      const settlementBucket = isUSEquity(pos.ticker) ? 'T1' : 'T2';
      
      allocations.push({
        ticker: pos.ticker,
        name: pos.name,
        currency: pos.currency,
        side: 'Sell',
        currentWeight: pos.weight,
        targetWeight: pos.indexWeight,
        deficitBps: pos.diffBps,
        allocation: -actualNotional,
        quantity: sellQty,
        price: localPrice,
        notionalUSD: actualNotional,
        reason: `Overweight by ${pos.diffBps} bps → sell to index`,
        settlementBucket,
      });
    }
  }

  // Available cash for buys = investable cash + proceeds from sells
  const availableForBuys = investableCash + totalSold;

  // Calculate buy orders (underweights → increase to index weight)
  // Sort by largest deficit first
  let remainingCash = availableForBuys;
  
  for (const pos of underweights) {
    if (remainingCash < 1000) break;
    
    const fx = getFX(fxRates, pos.currency);
    const localPrice = safeNum(pos.price);
    
    // Target: bring weight up to index weight
    const currentValue = pos.marketValue;
    const targetValue = (pos.indexWeight / 100) * nav;
    const buyValueUSD = Math.min(targetValue - currentValue, remainingCash);
    
    if (buyValueUSD < 1000) continue; // Skip tiny buys
    
    const buyValueLocal = buyValueUSD / fx;
    const buyQty = Math.floor(buyValueLocal / localPrice);
    
    if (buyQty > 0) {
      const actualNotional = buyQty * localPrice * fx;
      totalBought += actualNotional;
      remainingCash -= actualNotional;
      
      // Determine settlement bucket: US = T+1, Rest = T+2
      const settlementBucket = isUSEquity(pos.ticker) ? 'T1' : 'T2';
      
      allocations.push({
        ticker: pos.ticker,
        name: pos.name,
        currency: pos.currency,
        side: 'Buy',
        currentWeight: pos.weight,
        targetWeight: pos.indexWeight,
        deficitBps: Math.abs(pos.diffBps),
        allocation: actualNotional,
        quantity: buyQty,
        price: localPrice,
        notionalUSD: actualNotional,
        reason: `Underweight by ${Math.abs(pos.diffBps)} bps → buy to index`,
        settlementBucket,
      });
    }
  }

  // Generate FX orders for non-USD buys
  const fxOrders = generateFXOrders(allocations.filter(a => a.side === 'Buy'), fxRates, autoFX, fxExecutionType);

  // Build summary
  const buyAllocations = allocations.filter(a => a.side === 'Buy');
  const sellAllocations = allocations.filter(a => a.side === 'Sell');
  
  const topAllocations = [...allocations]
    .sort((a, b) => b.notionalUSD - a.notionalUSD)
    .slice(0, 4)
    .map((a) => `${a.side === 'Sell' ? '↓' : '↑'} ${a.ticker}: ${(a.notionalUSD / 1e6).toFixed(2)}M`);

  const topReasons: string[] = [
    `Active rebalance: ${sellAllocations.length} sells, ${buyAllocations.length} buys`,
    `Selling ${(totalSold / 1e6).toFixed(2)}M overweights`,
    `Buying ${(totalBought / 1e6).toFixed(2)}M underweights`,
  ];

  const netCashImpact = totalSold - totalBought;
  const cashAfter = portfolio.currentCashUSD + netCashImpact;

  return {
    allocations,
    fxOrders,
    totalInvested: totalBought,
    totalSold,
    residual: remainingCash,
    skipped,
    summary: {
      mode: 'active',
      ordersCount: allocations.length,
      fxOrdersCount: fxOrders.length,
      cashBefore: portfolio.currentCashUSD,
      cashAfter,
      topReasons,
      largestAllocations: topAllocations,
    },
  };
}

// Cash deployment mode (everything/selected): buys only
function calculateCashDeployment(
  portfolio: Portfolio,
  config: RebalanceConfig,
  fxRates: FXRates,
  candidates: Position[],
  skipped: { ticker: string; reason: string }[],
  selectedTickers: Set<string>
): RebalanceResult {
  const { mode, investableCash, autoFX, fxExecutionType } = config;
  const nav = safeNum(portfolio.navUSD) || 1;

  // Calculate allocation weights
  let totalWeight = 0;
  const candidateData: {
    pos: Position;
    weight: number;
    deficit: number;
  }[] = [];

  for (const pos of candidates) {
    // For everything/selected, weight by target (index) weight
    const deficit = Math.max(0, -pos.diffBps);
    const weight = safeNum(pos.indexWeight);

    totalWeight += weight;
    candidateData.push({ pos, weight, deficit });
  }

  if (totalWeight === 0) totalWeight = 1;

  // First pass: allocate proportionally
  const allocations: RebalanceAllocation[] = [];
  let totalAllocated = 0;

  for (const { pos, weight, deficit } of candidateData) {
    const proportion = weight / totalWeight;
    const allocation = investableCash * proportion;
    const fx = getFX(fxRates, pos.currency);
    const localPrice = safeNum(pos.price);
    const localAllocation = allocation / fx;
    const quantity = Math.floor(localAllocation / localPrice);
    const actualNotional = quantity * localPrice * fx;

    if (quantity > 0) {
      totalAllocated += actualNotional;

      let reason: string;
      if (mode === 'selected') {
        reason = 'User selected';
      } else {
        reason = `Target weight ${pos.indexWeight.toFixed(2)}%`;
      }

      // Determine settlement bucket: US = T+1, Rest = T+2
      const settlementBucket = isUSEquity(pos.ticker) ? 'T1' : 'T2';

      allocations.push({
        ticker: pos.ticker,
        name: pos.name,
        currency: pos.currency,
        side: 'Buy',
        currentWeight: pos.weight,
        targetWeight: pos.indexWeight,
        deficitBps: deficit,
        allocation,
        quantity,
        price: localPrice,
        notionalUSD: actualNotional,
        reason,
        settlementBucket,
      });
    }
  }

  // Second pass: allocate residual to largest weight/deficit
  let residual = investableCash - totalAllocated;
  const RESIDUAL_THRESHOLD = 1000; // $1000 tolerance

  if (residual > RESIDUAL_THRESHOLD && allocations.length > 0) {
    // Sort by notional (largest first)
    const sorted = [...allocations].sort((a, b) => b.notionalUSD - a.notionalUSD);

    for (const alloc of sorted) {
      if (residual <= RESIDUAL_THRESHOLD) break;

      const pos = candidates.find((p) => p.ticker === alloc.ticker);
      if (!pos) continue;

      const fx = getFX(fxRates, pos.currency);
      const localPrice = safeNum(pos.price);
      const additionalQty = Math.floor((residual / fx) / localPrice);

      if (additionalQty > 0) {
        const additionalNotional = additionalQty * localPrice * fx;
        alloc.quantity += additionalQty;
        alloc.notionalUSD += additionalNotional;
        totalAllocated += additionalNotional;
        residual -= additionalNotional;
      }
    }
  }

  // Generate FX orders if enabled
  const fxOrders = generateFXOrders(allocations, fxRates, autoFX, fxExecutionType);

  // Build summary
  const topAllocations = [...allocations]
    .sort((a, b) => b.notionalUSD - a.notionalUSD)
    .slice(0, 3)
    .map((a) => `${a.ticker}: ${(a.notionalUSD / 1e6).toFixed(2)}M`);

  const topReasons: string[] = [];
  if (mode === 'everything') {
    topReasons.push('Pro-rata to benchmark weights');
  } else if (mode === 'selected') {
    topReasons.push(`${selectedTickers.size} securities selected`);
  }
  topReasons.push(`Investing ${((totalAllocated / investableCash) * 100).toFixed(1)}% of investable cash`);

  const cashAfter = portfolio.currentCashUSD - totalAllocated;

  return {
    allocations,
    fxOrders,
    totalInvested: totalAllocated,
    totalSold: 0,
    residual,
    skipped,
    summary: {
      mode,
      ordersCount: allocations.length,
      fxOrdersCount: fxOrders.length,
      cashBefore: portfolio.currentCashUSD,
      cashAfter,
      topReasons,
      largestAllocations: topAllocations,
    },
  };
}

// Helper: determine if ticker is US equity (settles T+1)
function isUSEquity(ticker: string): boolean {
  return ticker.endsWith(' US');
}

// Helper: generate FX orders for non-USD allocations
function generateFXOrders(
  allocations: RebalanceAllocation[],
  fxRates: FXRates,
  autoFX: boolean,
  fxExecutionType: 'WMR' | 'SPOT'
): Omit<FXTrade, 'id' | 'createdAt'>[] {
  const fxOrders: Omit<FXTrade, 'id' | 'createdAt'>[] = [];

  if (!autoFX) return fxOrders;

  const fxByPair: Record<string, number> = {};

  for (const alloc of allocations) {
    if (alloc.currency === 'USD') continue;

    const key = alloc.currency;
    if (!fxByPair[key]) fxByPair[key] = 0;
    fxByPair[key] += alloc.notionalUSD;
  }

  const today = new Date();
  // Both WMR and SPOT settle T+2
  const settleDate = new Date(today);
  settleDate.setDate(settleDate.getDate() + 2);

  for (const [ccy, usdAmount] of Object.entries(fxByPair)) {
    if (usdAmount < 100) continue;

    const rate = getFX(fxRates, ccy);
    const localAmount = usdAmount / rate;

    fxOrders.push({
      sellCcy: 'USD',
      buyCcy: ccy as Currency,
      sellAmt: usdAmount,
      buyAmt: localAmount,
      fxRate: rate,
      tradeDate: today.toISOString(),
      settleDate: settleDate.toISOString(),
      executionType: fxExecutionType,
      settlementBucket: 'T2',
      status: 'Pending',
      source: 'Rebalance',
    });
  }

  return fxOrders;
}

// ============================================
// Break Cause Analysis (v2.1)
// ============================================

export function analyzeBreakCause(
  brk: PositionBreak | CashBreak,
  custodianPositions: CustodianPosition[],
  internalPositions: Position[]
): BreakCauseAnalysis {
  const isPosition = 'ticker' in brk;

  if (!isPosition) {
    // Cash break
    const cashBreak = brk as CashBreak;
    const delta = Math.abs(cashBreak.delta);

    // Check if it could be fees/taxes (small amounts)
    if (delta < 10000) {
      return {
        cause: 'Fees & taxes',
        confidence: 75,
        evidence: [
          `Delta amount (${delta.toLocaleString()}) is consistent with fee/tax range`,
          'Cash breaks under $10K often represent custodian fees or tax withholdings',
        ],
        suggestedFix: 'Review fee schedule and tax documentation',
      };
    }

    // Could be settlement timing
    return {
      cause: 'Settlement timing',
      confidence: 65,
      evidence: [
        `Cash delta of ${delta.toLocaleString()} ${cashBreak.currency}`,
        'May reflect trades settling at different times between systems',
        'Check T+1/T+2 trade queue',
      ],
      suggestedFix: 'Verify pending settlements in both systems',
    };
  }

  const posBreak = brk as PositionBreak;

  // Quantity mismatch
  if (posBreak.type === 'Quantity') {
    const qtyDelta = Math.abs(safeNum(posBreak.custodianQty) - safeNum(posBreak.internalQty));

    // Check if delta looks like standard lot sizes
    if (qtyDelta % 100 === 0 || qtyDelta % 1000 === 0) {
      return {
        cause: 'Missing trade',
        confidence: 85,
        evidence: [
          `Quantity difference of ${qtyDelta.toLocaleString()} shares`,
          'Delta is a round lot, suggesting a missed trade entry',
          `USD impact: ${Math.abs(posBreak.deltaUSD).toLocaleString()}`,
        ],
        suggestedFix: 'Search trade blotter for matching quantity',
      };
    }

    // Could be corporate action (odd lots from splits, etc.)
    if (qtyDelta < 100) {
      return {
        cause: 'Corporate action',
        confidence: 70,
        evidence: [
          `Small quantity difference of ${qtyDelta} shares`,
          'Fractional shares often result from stock splits or spin-offs',
          'Check recent corporate action calendar',
        ],
        suggestedFix: 'Verify corporate action processing',
      };
    }

    return {
      cause: 'Missing trade',
      confidence: 75,
      evidence: [
        `Quantity mismatch: Custodian ${posBreak.custodianQty}, Internal ${posBreak.internalQty}`,
        `Delta: ${qtyDelta.toLocaleString()} shares`,
      ],
      suggestedFix: 'Reconcile trade records',
    };
  }

  // Price mismatch
  if (posBreak.type === 'Price') {
    const priceDelta = Math.abs(safeNum(posBreak.custodianPrice) - safeNum(posBreak.internalPrice));
    const pricePct = (priceDelta / safeNum(posBreak.internalPrice)) * 100;

    if (pricePct < 0.5) {
      return {
        cause: 'Price discrepancy',
        confidence: 90,
        evidence: [
          `Price difference of ${priceDelta.toFixed(2)} (${pricePct.toFixed(2)}%)`,
          'Custodian: ' + posBreak.custodianPrice + ', Internal: ' + posBreak.internalPrice,
          'Small variance likely due to different pricing sources or timing',
        ],
        suggestedFix: 'Verify pricing source and timestamp',
      };
    }

    return {
      cause: 'Data mapping issue',
      confidence: 70,
      evidence: [
        `Large price variance of ${pricePct.toFixed(1)}%`,
        'May indicate wrong security mapped or stale price',
      ],
      suggestedFix: 'Verify security identifier mapping',
    };
  }

  // FX mismatch
  if (posBreak.type === 'FX') {
    const fxDelta = Math.abs(safeNum(posBreak.custodianFX) - safeNum(posBreak.internalFX));

    return {
      cause: 'FX missing/incorrect',
      confidence: 85,
      evidence: [
        `FX rate difference of ${fxDelta.toFixed(4)}`,
        `Custodian rate: ${posBreak.custodianFX}, Internal rate: ${posBreak.internalFX}`,
        'FX rates may be from different cut-off times',
      ],
      suggestedFix: 'Align FX rate sources and timestamps',
    };
  }

  // Missing position
  if (posBreak.type === 'Missing') {
    return {
      cause: 'Missing position',
      confidence: 95,
      evidence: [
        `Position ${posBreak.ticker} exists in one system but not the other`,
        'May indicate failed trade settlement or data feed issue',
      ],
      suggestedFix: 'Check trade status and data feed connectivity',
    };
  }

  // Default
  return {
    cause: 'Unknown',
    confidence: 50,
    evidence: ['Unable to determine root cause automatically'],
    suggestedFix: 'Manual investigation required',
  };
}

// ============================================
// NAV Reconciliation (v2.1)
// ============================================

export function calculateShadowNAV(
  custodianPositions: CustodianPosition[],
  cashUSD: number
): number {
  const positionsValue = (custodianPositions || []).reduce(
    (acc, pos) => acc + safeNum(pos.marketValueUSD),
    0
  );
  return positionsValue + safeNum(cashUSD);
}

export function reconcileNAV(
  custodianPositions: CustodianPosition[],
  internalPositions: Position[],
  custodianCashUSD: number,
  internalCashUSD: number,
  officialNAV: number,
  fxRates: FXRates,
  tolerance: { absoluteUSD: number; relativeBps: number }
): NAVReconciliation {
  const custodianCash = safeNum(custodianCashUSD);
  const internalCash = safeNum(internalCashUSD);
  const offNAV = safeNum(officialNAV) || 1;

  const shadowNAV = calculateShadowNAV(custodianPositions || [], custodianCash);
  const delta = shadowNAV - offNAV;
  const deltaBps = (delta / offNAV) * 10000;

  // Build lookup maps
  const custodianMap = new Map((custodianPositions || []).map((p) => [p.ticker, p]));
  const internalMap = new Map((internalPositions || []).map((p) => [p.ticker, p]));

  const positionBreaks: PositionBreak[] = [];
  let breakId = 0;

  // Check each internal position against custodian
  for (const internal of internalPositions || []) {
    const custodian = custodianMap.get(internal.ticker);

    if (!custodian) {
      // Missing from custodian
      const brk: PositionBreak = {
        id: `brk_${breakId++}`,
        ticker: internal.ticker,
        name: internal.name,
        type: 'Missing',
        internalQty: internal.quantity,
        internalValue: internal.marketValue,
        delta: -internal.quantity,
        deltaUSD: -internal.marketValue,
        resolution: 'unresolved',
        status: 'New',
      };

      // Check tolerance
      if (Math.abs(brk.deltaUSD) >= tolerance.absoluteUSD) {
        brk.causeAnalysis = analyzeBreakCause(brk, custodianPositions, internalPositions);
        positionBreaks.push(brk);
      }
      continue;
    }

    const custQty = safeNum(custodian.quantity);
    const intQty = safeNum(internal.quantity);
    const custPrice = safeNum(custodian.price);
    const intPrice = safeNum(internal.price);
    const custFX = safeNum(custodian.fxRate);
    const intFX = getFX(fxRates, custodian.currency);
    const custMV = safeNum(custodian.marketValueUSD);
    const intMV = safeNum(internal.marketValue);
    const deltaUSD = custMV - intMV;

    // Skip if within tolerance
    const deltaBpsPos = Math.abs((deltaUSD / offNAV) * 10000);
    if (Math.abs(deltaUSD) < tolerance.absoluteUSD && deltaBpsPos < tolerance.relativeBps) {
      continue;
    }

    // Determine break type
    let brk: PositionBreak | null = null;

    if (Math.abs(custQty - intQty) > 0.5) {
      brk = {
        id: `brk_${breakId++}`,
        ticker: internal.ticker,
        name: internal.name,
        type: 'Quantity',
        custodianQty: custQty,
        internalQty: intQty,
        custodianValue: custMV,
        internalValue: intMV,
        delta: custQty - intQty,
        deltaUSD,
        resolution: 'unresolved',
        status: 'New',
      };
    } else if (Math.abs(custPrice - intPrice) > 0.01) {
      brk = {
        id: `brk_${breakId++}`,
        ticker: internal.ticker,
        name: internal.name,
        type: 'Price',
        custodianPrice: custPrice,
        internalPrice: intPrice,
        custodianValue: custMV,
        internalValue: intMV,
        delta: custPrice - intPrice,
        deltaUSD,
        resolution: 'unresolved',
        status: 'New',
      };
    } else if (Math.abs(custFX - intFX) > 0.0001 && custodian.currency !== 'USD') {
      brk = {
        id: `brk_${breakId++}`,
        ticker: internal.ticker,
        name: internal.name,
        type: 'FX',
        custodianFX: custFX,
        internalFX: intFX,
        custodianValue: custMV,
        internalValue: intMV,
        delta: custFX - intFX,
        deltaUSD,
        resolution: 'unresolved',
        status: 'New',
      };
    }

    if (brk) {
      brk.causeAnalysis = analyzeBreakCause(brk, custodianPositions, internalPositions);
      positionBreaks.push(brk);
    }
  }

  // Cash breaks
  const cashBreaks: CashBreak[] = [];
  const cashDelta = custodianCash - internalCash;

  if (Math.abs(cashDelta) >= tolerance.absoluteUSD) {
    const cashBreak: CashBreak = {
      id: `cash_brk_0`,
      currency: 'USD',
      custodianAmount: custodianCash,
      internalAmount: internalCash,
      delta: cashDelta,
      deltaUSD: cashDelta,
      resolution: 'unresolved',
      status: 'New',
    };
    cashBreak.causeAnalysis = analyzeBreakCause(cashBreak, custodianPositions, internalPositions);
    cashBreaks.push(cashBreak);
  }

  // Group breaks by cause
  const breaksByCause: Record<BreakCause, { count: number; totalUSD: number }> = {
    'Settlement timing': { count: 0, totalUSD: 0 },
    'Missing trade': { count: 0, totalUSD: 0 },
    'Price discrepancy': { count: 0, totalUSD: 0 },
    'FX missing/incorrect': { count: 0, totalUSD: 0 },
    'Corporate action': { count: 0, totalUSD: 0 },
    'Fees & taxes': { count: 0, totalUSD: 0 },
    'Missing position': { count: 0, totalUSD: 0 },
    'Data mapping issue': { count: 0, totalUSD: 0 },
    'Unknown': { count: 0, totalUSD: 0 },
  };

  for (const brk of [...positionBreaks, ...cashBreaks]) {
    const cause = brk.causeAnalysis?.cause || 'Unknown';
    breaksByCause[cause].count++;
    breaksByCause[cause].totalUSD += Math.abs(brk.deltaUSD);
  }

  const unresolvedCount =
    positionBreaks.filter((b) => b.resolution === 'unresolved').length +
    cashBreaks.filter((b) => b.resolution === 'unresolved').length;

  // Determine status
  let status: 'aligned' | 'investigate' | 'critical' = 'aligned';
  if (Math.abs(deltaBps) > 50) {
    status = 'critical';
  } else if (Math.abs(deltaBps) > 10 || unresolvedCount > 0) {
    status = 'investigate';
  }

  return {
    shadowNAV,
    officialNAV: offNAV,
    delta,
    deltaBps,
    positionBreaks,
    cashBreaks,
    unresolvedCount,
    status,
    breaksByCause,
  };
}

// ============================================
// FX Helpers
// ============================================

export function getSettleDateFromType(
  tradeDate: Date,
  type: 'ON' | 'TOM' | 'SPOT'
): Date {
  const settle = new Date(tradeDate);
  const days = type === 'ON' ? 0 : type === 'TOM' ? 1 : 2;
  settle.setDate(settle.getDate() + days);
  return settle;
}

// ============================================
// v2.3 — Pending Equity Impact on Cash Ladder
// ============================================

export function applyPendingEquityToCashLadder(
  baseBuckets: CashBucket[],
  baskets: Basket[],
  fxRates: FXRates
): CashBucket[] {
  // Clone buckets
  const buckets = baseBuckets.map((b) => ({ ...b }));

  for (const basket of baskets) {
    // Only apply projected or routed orders, not filled/settled
    if (basket.orderState === 'filled' || basket.orderState === 'settled') continue;
    if (basket.status === 'Cancelled' || basket.status === 'Filled') continue;

    for (const order of basket.orders) {
      if (order.doNotTrade || order.status === 'Cancelled') continue;
      if (order.type === 'FX') continue; // FX handled separately

      // Determine settlement bucket (equity typically T+2)
      const bucketKey: 'T' | 'T1' | 'T2' | 'T3' | 'T5' = order.settlementBucket || 'T2';
      const currency = order.currency || 'USD';
      const fx = getFX(fxRates, currency);

      // Find the currency bucket
      const currencyBucket = buckets.find((b) => b.currency === currency);
      if (!currencyBucket) continue;

      const bucketsToUpdate = getBucketsFromHorizon(bucketKey);

      if (order.side === 'Buy') {
        // Buying reduces cash
        const localAmount = order.notionalUSD / fx;
        for (const bk of bucketsToUpdate) {
          currencyBucket[bk] -= localAmount;
        }
        currencyBucket.total -= localAmount;
        currencyBucket.equivUSD -= order.notionalUSD;
      } else {
        // Selling increases cash
        const localAmount = order.notionalUSD / fx;
        for (const bk of bucketsToUpdate) {
          currencyBucket[bk] += localAmount;
        }
        currencyBucket.total += localAmount;
        currencyBucket.equivUSD += order.notionalUSD;
      }
    }
  }

  return buckets;
}

// getBucketsFromHorizon reused from cash calculations (deduplicated in v2.4)

// ============================================
// v2.3 — Cash Projection for Status Bar
// ============================================

export function calculateCashProjection(
  portfolio: Portfolio,
  baskets: Basket[],
  fxTrades: FXTrade[],
  fxRates: FXRates,
  settlementHorizon: SettlementHorizon
): CashProjection {
  const nav = safeNum(portfolio.navUSD) || 1;

  // 1. Available cash at selected horizon (from base cash buckets)
  const availableCashUSD = getCumulativeCashAtHorizon(portfolio.cashBuckets, settlementHorizon, fxRates);
  const availableCashPct = (availableCashUSD / nav) * 100;

  // 2. Calculate pending equity impacts
  let pendingEquityBuysUSD = 0;
  let pendingEquitySellsUSD = 0;

  for (const basket of baskets) {
    if (basket.status === 'Cancelled' || basket.status === 'Filled') continue;
    if (basket.orderState === 'filled' || basket.orderState === 'settled') continue;

    for (const order of basket.orders) {
      if (order.doNotTrade || order.status === 'Cancelled' || order.type === 'FX') continue;
      
      if (order.side === 'Buy') {
        pendingEquityBuysUSD += safeNum(order.notionalUSD);
      } else {
        pendingEquitySellsUSD += safeNum(order.notionalUSD);
      }
    }
  }

  // 3. Calculate pending FX net impact (in USD terms)
  let pendingFXNetUSD = 0;
  for (const fx of fxTrades) {
    if (fx.status !== 'Pending') continue;
    // FX trades are currency neutral in USD terms, but track the flow
    // Selling non-USD to buy USD increases USD
    if (fx.buyCcy === 'USD') {
      pendingFXNetUSD += fx.buyAmt;
    } else if (fx.sellCcy === 'USD') {
      pendingFXNetUSD -= fx.sellAmt;
    }
  }

  // 4. Calculate projected cash after all pending activity
  const projectedCashUSD = availableCashUSD - pendingEquityBuysUSD + pendingEquitySellsUSD + pendingFXNetUSD;
  const projectedCashPct = (projectedCashUSD / nav) * 100;

  // 5. Determine status
  let status: CashProjection['status'] = 'current';
  const hasProjected = baskets.some(b => b.orderState === 'projected');
  const hasRouted = baskets.some(b => b.orderState === 'routed' || b.status === 'Routed' || b.status === 'PartialFill');
  const hasPending = baskets.some(b => b.status === 'Pending');

  if (hasRouted) {
    status = 'routed';
  } else if (hasProjected || hasPending) {
    status = pendingEquityBuysUSD > 0 || pendingEquitySellsUSD > 0 ? 'pending' : 'projected';
  }

  return {
    availableCashUSD,
    availableCashPct,
    projectedCashUSD,
    projectedCashPct,
    pendingEquityBuysUSD,
    pendingEquitySellsUSD,
    pendingFXNetUSD,
    status,
    settlementHorizon,
  };
}

// ============================================
// v2.3 — Shadow NAV Card with Bridge
// ============================================

export function calculateShadowNAVCard(
  portfolio: Portfolio,
  custodianPositions: CustodianPosition[],
  custodianCashUSD: number,
  fxRates: FXRates
): ShadowNAVCard {
  const nav = safeNum(portfolio.navUSD) || 1;
  const sharesOutstanding = safeNum(portfolio.sharesOutstanding) || 10_000_000;
  const managementFeeBps = safeNum(portfolio.managementFeeBps) || 25;
  const adminNAV = safeNum(portfolio.adminNAV) || nav;
  const adminNAVAsOf = portfolio.adminNAVAsOf || portfolio.dataAsOf || new Date().toISOString();

  // Calculate Shadow NAV from positions + cash
  const positionsValueUSD = portfolio.positions.reduce((acc, pos) => {
    return acc + safeNum(pos.marketValue);
  }, 0);
  const cashValueUSD = portfolio.cashBuckets.reduce((acc, bucket) => {
    const fx = getFX(fxRates, bucket.currency);
    return acc + safeNum(bucket.T) * fx;
  }, 0);

  const shadowNAV = positionsValueUSD + cashValueUSD;
  const navPerShare = shadowNAV / sharesOutstanding;

  // Delta calculations
  const deltaUSD = shadowNAV - adminNAV;
  const deltaBps = (deltaUSD / adminNAV) * 10000;

  // Daily accrual calculation
  const annualFeeRate = managementFeeBps / 10000;
  const dailyAccrual = (shadowNAV * annualFeeRate) / 365;

  // Build NAV Bridge breakdown
  const bridge: NAVBridgeItem[] = [];

  // 1. Price Effect — compare internal prices vs custodian prices
  let priceEffect = 0;
  if (custodianPositions && custodianPositions.length > 0) {
    const custodianMap = new Map(custodianPositions.map(p => [p.ticker, p]));
    for (const pos of portfolio.positions) {
      const custPos = custodianMap.get(pos.ticker);
      if (custPos) {
        const priceDiff = safeNum(custPos.price) - safeNum(pos.price);
        const fx = getFX(fxRates, pos.currency);
        priceEffect += priceDiff * safeNum(pos.quantity) * fx;
      }
    }
  }
  if (Math.abs(priceEffect) > 100) {
    bridge.push({
      label: 'Price Effect',
      valueUSD: priceEffect,
      valueBps: (priceEffect / nav) * 10000,
      description: 'Difference between internal and custodian prices',
    });
  }

  // 2. FX Effect — compare FX rates
  let fxEffect = 0;
  if (custodianPositions && custodianPositions.length > 0) {
    const custodianMap = new Map(custodianPositions.map(p => [p.ticker, p]));
    for (const pos of portfolio.positions) {
      const custPos = custodianMap.get(pos.ticker);
      if (custPos && pos.currency !== 'USD') {
        const internalFX = getFX(fxRates, pos.currency);
        const custodianFX = safeNum(custPos.fxRate) || internalFX;
        const fxDiff = custodianFX - internalFX;
        const localValue = safeNum(pos.price) * safeNum(pos.quantity);
        fxEffect += localValue * fxDiff;
      }
    }
  }
  if (Math.abs(fxEffect) > 100) {
    bridge.push({
      label: 'FX Effect',
      valueUSD: fxEffect,
      valueBps: (fxEffect / nav) * 10000,
      description: 'FX rate variance between systems',
    });
  }

  // 3. Cash/Timing Effect
  const cashEffect = cashValueUSD - safeNum(custodianCashUSD);
  if (Math.abs(cashEffect) > 100) {
    bridge.push({
      label: 'Cash/Timing',
      valueUSD: cashEffect,
      valueBps: (cashEffect / nav) * 10000,
      description: 'Cash position and settlement timing differences',
    });
  }

  // 4. Daily Accrual
  bridge.push({
    label: 'Mgmt Fee Accrual',
    valueUSD: -dailyAccrual,
    valueBps: (-dailyAccrual / nav) * 10000,
    description: `Daily accrual at ${managementFeeBps}bps annual`,
  });

  // 5. Residual — everything else
  const explainedDelta = priceEffect + fxEffect + cashEffect - dailyAccrual;
  const residual = deltaUSD - explainedDelta;
  if (Math.abs(residual) > 100) {
    bridge.push({
      label: 'Residual',
      valueUSD: residual,
      valueBps: (residual / nav) * 10000,
      description: 'Unexplained variance',
    });
  }

  return {
    shadowNAV,
    navPerShare,
    adminNAV,
    adminNAVAsOf,
    deltaUSD,
    deltaBps,
    fxMode: 'WMR 4pm London',
    asOfTimestamp: new Date().toISOString(),
    dailyAccrual,
    managementFeeBps,
    bridge,
  };
}
