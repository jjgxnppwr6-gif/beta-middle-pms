import { create } from 'zustand';
import type {
  Portfolio, Position, CashBucket, FXRates, FXTrade, Basket, Order,
  RebalanceConfig, RebalanceResult, NAVReconciliation, CustodianPosition,
  MOState, AuditEntry, AuditAction, View, BreakResolution, BreakStatus,
  BreakTolerance, Currency, DemoScenario, PositionBreak, CashBreak,
  CashProjection, ShadowNAVCard,
} from '../types';
import {
  getCumulativeCashAtHorizon, getInvestableCash, applyPendingFXToCashLadder,
  calculateRebalance, reconcileNAV, getSettleDateFromType,
  calculateCashProjection, calculateShadowNAVCard, applyPendingEquityToCashLadder,
} from '../calculations';
import { uid } from '../fmt';

interface AppState {
  currentView: View;
  theme: 'dark' | 'light';
  portfolio: Portfolio;
  fxRates: FXRates;
  selectedTickers: Set<string>;
  fxTrades: FXTrade[];
  effectiveCashBuckets: CashBucket[];
  showPendingFX: boolean;
  rebalanceConfig: RebalanceConfig;
  rebalanceResult: RebalanceResult | null;
  rebalanceConfirmOpen: boolean;
  baskets: Basket[];
  moState: MOState;
  custodianPositions: CustodianPosition[];
  custodianCashUSD: number;
  reconciliation: NAVReconciliation | null;
  selectedBreakId: string | null;
  breakTolerance: BreakTolerance;
  demoUser: string;
  auditLog: AuditEntry[];
  analytics: { trackingErrorExPost: number; trackingErrorExAnte: number; cashDragBps: number; alpha: number; portfolioYTD: number; indexYTD: number; teContributors: { source: string; bps: number; comment: string }[] };
  scenarios: DemoScenario[];
  fxModalOpen: boolean;
  fxModalData: { currency: Currency; amount: number; bucket: string } | null;
  exportModalOpen: boolean;
  // v2.3 additions
  cashProjection: CashProjection | null;
  shadowNAVCard: ShadowNAVCard | null;

  setView: (view: View) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  initTheme: () => void;
  toggleTickerSelection: (ticker: string) => void;
  selectAllTickers: () => void;
  clearSelection: () => void;
  updateTradeQty: (ticker: string, qty: number) => void;
  clearAllTradeQty: () => void;
  openFxModal: (currency: Currency, amount: number, bucket: string) => void;
  closeFxModal: () => void;
  createFxTrade: (trade: Omit<FXTrade, 'id' | 'createdAt'>) => void;
  spotAllToBase: () => void;
  toggleShowPendingFX: () => void;
  recalculateEffectiveCash: () => void;
  setRebalanceConfig: (config: Partial<RebalanceConfig>) => void;
  runRebalance: () => void;
  openRebalanceConfirm: () => void;
  closeRebalanceConfirm: () => void;
  confirmRebalance: () => void;
  toggleBasketExpand: (basketId: string) => void;
  toggleDoNotTrade: (basketId: string, orderId: string) => void;
  routeBaskets: () => void;
  cancelBaskets: () => void;
  loadSampleData: () => Promise<void>;
  runReconciliation: () => void;
  selectBreak: (breakId: string | null) => void;
  resolveBreak: (breakId: string, resolution: BreakResolution, notes?: string) => void;
  updateBreakStatus: (breakId: string, status: BreakStatus) => void;
  updateBreakOwner: (breakId: string, owner: string) => void;
  updateBreakNotes: (breakId: string, notes: string) => void;
  overrideBreakCause: (breakId: string, cause: string, note: string) => void;
  setBreakTolerance: (tolerance: Partial<BreakTolerance>) => void;
  pushToPMS: () => void;
  resetMO: () => void;
  addAuditEntry: (action: AuditAction, details: Record<string, unknown>, entityType?: string, entityId?: string) => void;
  runScenarios: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  // v2.3 additions
  updateCashProjection: () => void;
  updateShadowNAVCard: () => void;
}

const defaultPortfolio: Portfolio = {
  name: 'MSCI World Core Fund', benchmark: 'MSCI World Net TR (USD)', navUSD: 309_571_230,
  baseCurrency: 'USD', currentCashPct: 2.5, currentCashUSD: 7_741_230, positions: [], cashBuckets: [], corporateActions: [],
};

const defaultFXRates: FXRates = { USD: 1.0, EUR: 1.085, GBP: 1.333, CHF: 1.12, JPY: 0.0067 };

export const useStore = create<AppState>((set, get) => ({
  currentView: 'middleOffice',
  theme: 'dark',
  portfolio: defaultPortfolio,
  fxRates: defaultFXRates,
  selectedTickers: new Set(),
  fxTrades: [],
  effectiveCashBuckets: [],
  showPendingFX: true,
  rebalanceConfig: { mode: 'everything', settlementHorizon: 'T2', targetCashPct: 0.5, autoFX: true, fxExecutionType: 'SPOT', availableCash: 0, investableCash: 0 },
  rebalanceResult: null,
  rebalanceConfirmOpen: false,
  baskets: [],
  moState: { currentStep: 'ingest', fileUploaded: false, filename: null, uploadTimestamp: null, normalized: false, reconciled: false, pushedToPMS: false },
  custodianPositions: [],
  custodianCashUSD: 0,
  reconciliation: null,
  selectedBreakId: null,
  breakTolerance: { absoluteUSD: 1000, relativeBps: 1 },
  demoUser: 'demo-user',
  auditLog: [],
  analytics: { trackingErrorExPost: 0.12, trackingErrorExAnte: 0.10, cashDragBps: 4, alpha: 0.10, portfolioYTD: 4.1, indexYTD: 4.0, teContributors: [
    { source: 'Cash (2.5% vs 0.5% target)', bps: 4, comment: 'Idle cash vs fully invested index' },
    { source: 'Country tilts', bps: 2, comment: 'US +10 bps' }, { source: 'Sector tilts', bps: 1, comment: 'Tech +5 bps' },
    { source: 'FX residual', bps: 1, comment: 'EUR/CHF exposures' }, { source: 'Idiosyncratic', bps: 2, comment: 'Single-name residuals' },
  ]},
  scenarios: [],
  fxModalOpen: false,
  fxModalData: null,
  exportModalOpen: false,
  // v2.3 additions
  cashProjection: null,
  shadowNAVCard: null,

  setView: (view) => set({ currentView: view }),
  setTheme: (theme) => { set({ theme }); if (typeof window !== 'undefined') { localStorage.setItem('pms-theme', theme); document.documentElement.classList.toggle('light-theme', theme === 'light'); document.documentElement.dataset.theme = theme; }},
  initTheme: () => { if (typeof window !== 'undefined') { const stored = localStorage.getItem('pms-theme'); const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches; const theme = (stored as 'dark' | 'light') || (prefersDark ? 'dark' : 'light'); set({ theme }); document.documentElement.classList.toggle('light-theme', theme === 'light'); document.documentElement.dataset.theme = theme; }},
  toggleTickerSelection: (ticker) => set((s) => { const n = new Set(s.selectedTickers); if (n.has(ticker)) n.delete(ticker); else n.add(ticker); return { selectedTickers: n }; }),
  selectAllTickers: () => set((s) => ({ selectedTickers: new Set(s.portfolio.positions.filter(p => p.tradable !== false).map(p => p.ticker)) })),
  clearSelection: () => set({ selectedTickers: new Set() }),
  updateTradeQty: (ticker, qty) => set((s) => ({ portfolio: { ...s.portfolio, positions: s.portfolio.positions.map(p => p.ticker === ticker ? { ...p, tradeQty: qty } : p) } })),
  clearAllTradeQty: () => set((s) => ({ portfolio: { ...s.portfolio, positions: s.portfolio.positions.map(p => ({ ...p, tradeQty: 0 })) } })),
  openFxModal: (currency, amount, bucket) => set({ fxModalOpen: true, fxModalData: { currency, amount, bucket } }),
  closeFxModal: () => set({ fxModalOpen: false, fxModalData: null }),
  createFxTrade: (trade) => set((s) => {
    const newTrade: FXTrade = { ...trade, id: uid(), createdAt: new Date().toISOString() };
    const fxTrades = [...s.fxTrades, newTrade];
    const effectiveCashBuckets = applyPendingFXToCashLadder(s.portfolio.cashBuckets, fxTrades.filter(t => t.status === 'Pending'), s.fxRates);
    return { fxTrades, effectiveCashBuckets, fxModalOpen: false, fxModalData: null };
  }),
  spotAllToBase: () => set((s) => {
    const today = new Date();
    const settleDate = new Date(today);
    settleDate.setDate(settleDate.getDate() + 2); // T+2 for SPOT
    const newTrades: FXTrade[] = [];
    for (const bucket of s.portfolio.cashBuckets) {
      if (bucket.currency === 'USD' || bucket.total <= 0) continue;
      const rate = s.fxRates[bucket.currency] || 1;
      newTrades.push({ id: uid(), sellCcy: bucket.currency, buyCcy: 'USD', sellAmt: bucket.total, buyAmt: bucket.total * rate, fxRate: rate, tradeDate: today.toISOString(), settleDate: settleDate.toISOString(), executionType: 'SPOT', settlementBucket: 'T2', status: 'Pending', source: 'SpotToBase', createdAt: today.toISOString() });
    }
    const fxTrades = [...s.fxTrades, ...newTrades];
    const effectiveCashBuckets = applyPendingFXToCashLadder(s.portfolio.cashBuckets, fxTrades.filter(t => t.status === 'Pending'), s.fxRates);
    return { fxTrades, effectiveCashBuckets, currentView: 'oms' as View };
  }),
  toggleShowPendingFX: () => set((s) => ({ showPendingFX: !s.showPendingFX })),
  recalculateEffectiveCash: () => set((s) => ({ effectiveCashBuckets: applyPendingFXToCashLadder(s.portfolio.cashBuckets, s.fxTrades.filter(t => t.status === 'Pending'), s.fxRates) })),
  setRebalanceConfig: (config) => set((s) => {
    const newConfig = { ...s.rebalanceConfig, ...config };
    const cashBuckets = s.showPendingFX && s.effectiveCashBuckets.length > 0 ? s.effectiveCashBuckets : s.portfolio.cashBuckets;
    const availableCash = getCumulativeCashAtHorizon(cashBuckets, newConfig.settlementHorizon, s.fxRates);
    const investableCash = getInvestableCash(availableCash, newConfig.targetCashPct, s.portfolio.navUSD);
    return { rebalanceConfig: { ...newConfig, availableCash, investableCash } };
  }),
  runRebalance: () => set((s) => ({ rebalanceResult: calculateRebalance(s.portfolio, s.rebalanceConfig, s.fxRates, s.selectedTickers) })),
  openRebalanceConfirm: () => { get().runRebalance(); set({ rebalanceConfirmOpen: true }); },
  closeRebalanceConfirm: () => set({ rebalanceConfirmOpen: false, rebalanceResult: null }),
  confirmRebalance: () => set((s) => {
    const result = s.rebalanceResult;
    if (!result || result.allocations.length === 0) return { rebalanceConfirmOpen: false };
    const timestamp = new Date().toISOString();
    const date = timestamp.slice(0, 10);
    const baskets: Basket[] = [];
    
    // Separate buy and sell allocations
    const buyAllocations = result.allocations.filter(a => a.side === 'Buy');
    const sellAllocations = result.allocations.filter(a => a.side === 'Sell');
    
    // Create equity basket with both buys and sells
    if (result.allocations.length > 0) {
      const totalNotional = result.totalInvested + result.totalSold;
      const orders: Order[] = result.allocations.map((alloc) => ({ 
        id: `eq_${uid()}`, 
        ticker: alloc.ticker, 
        side: alloc.side, 
        type: 'Equity' as const, 
        currency: alloc.currency, 
        quantity: alloc.quantity, 
        notionalUSD: alloc.notionalUSD, 
        pctOfBasket: totalNotional > 0 ? (alloc.notionalUSD / totalNotional) * 100 : 0, 
        advPct: 1 + Math.random() * 2, 
        status: 'Pending' as const, 
        fillPct: 0,
        settlementBucket: alloc.settlementBucket,
      }));
      
      const basketName = sellAllocations.length > 0 
        ? `MSCI World Active Rebalance — ${date}` 
        : `MSCI World Rebalance — ${date}`;
      
      baskets.push({ 
        id: `basket_eq_${uid()}`, 
        name: basketName, 
        timestamp, 
        type: 'Equity', 
        orders, 
        totalNotionalUSD: totalNotional, 
        status: 'Pending', 
        fillPct: 0, 
        expanded: false 
      });
    }
    
    const newFxTrades: FXTrade[] = result.fxOrders.map((fx) => ({ ...fx, id: uid(), createdAt: timestamp }));
    if (newFxTrades.length > 0) {
      const fxOrders: Order[] = newFxTrades.map((fx) => ({ 
        id: fx.id, 
        ticker: `${fx.sellCcy}/${fx.buyCcy}`, 
        side: 'Buy' as const, 
        type: 'FX' as const, 
        currency: fx.buyCcy, 
        notionalUSD: fx.sellAmt, 
        pctOfBasket: 0, 
        fxMid: `${fx.buyCcy}/USD ${fx.fxRate.toFixed(4)}`, 
        fxExecutionType: fx.executionType,
        status: 'Pending' as const, 
        fillPct: 0 
      }));
      baskets.push({ id: `basket_fx_${uid()}`, name: `FX Rebalance — ${date}`, timestamp, type: 'FX', orders: fxOrders, totalNotionalUSD: newFxTrades.reduce((a, t) => a + t.sellAmt, 0), status: 'Pending', fillPct: 0, expanded: false });
    }
    const fxTrades = [...s.fxTrades, ...newFxTrades];
    const effectiveCashBuckets = applyPendingFXToCashLadder(s.portfolio.cashBuckets, fxTrades.filter(t => t.status === 'Pending'), s.fxRates);
    return { baskets: [...s.baskets, ...baskets], fxTrades, effectiveCashBuckets, rebalanceConfirmOpen: false, rebalanceResult: null, currentView: 'oms' as View };
  }),
  toggleBasketExpand: (basketId) => set((s) => ({ baskets: s.baskets.map(b => b.id === basketId ? { ...b, expanded: !b.expanded } : b) })),
  toggleDoNotTrade: (basketId, orderId) => set((s) => ({ baskets: s.baskets.map(b => b.id === basketId ? { ...b, orders: b.orders.map(o => o.id === orderId ? { ...o, doNotTrade: !o.doNotTrade } : o) } : b) })),
  routeBaskets: () => set((s) => ({ baskets: s.baskets.map(b => ({ ...b, status: b.status === 'Pending' ? 'PartialFill' as const : b.status, fillPct: b.status === 'Pending' ? (b.type === 'Equity' ? 70 : 50) : b.fillPct, orders: b.orders.map(o => ({ ...o, status: o.doNotTrade ? 'Cancelled' as const : o.status === 'Pending' ? 'PartialFill' as const : o.status, fillPct: o.doNotTrade ? 0 : (b.type === 'Equity' ? 70 : 50) })) })) })),
  cancelBaskets: () => set((s) => ({ baskets: s.baskets.map(b => ({ ...b, status: 'Cancelled' as const, orders: b.orders.map(o => ({ ...o, status: 'Cancelled' as const })) })) })),
  loadSampleData: async () => {
    try {
      const [portfolioRes, custodianRes] = await Promise.all([fetch('/data/portfolio.json'), fetch('/data/custodian.json')]);
      const portfolioData = await portfolioRes.json();
      const custodianData = await custodianRes.json();
      const timestamp = new Date().toISOString();
      set((s) => {
        const portfolio = { ...portfolioData, positions: portfolioData.positions.map((p: Position) => ({ ...p, tradeQty: 0, suggestedQty: 0, baseMV: p.marketValue, tradable: p.tradable !== false, restricted: p.restricted === true })), dataAsOf: timestamp };
        const effectiveCashBuckets = applyPendingFXToCashLadder(portfolio.cashBuckets, s.fxTrades.filter(t => t.status === 'Pending'), s.fxRates);
        return { portfolio, custodianPositions: custodianData.positions, custodianCashUSD: custodianData.cashUSD || 8_015_000, effectiveCashBuckets, moState: { ...s.moState, fileUploaded: true, filename: 'BNYM_POS_20251110_093200.csv', uploadTimestamp: timestamp, normalized: true, currentStep: 'reconcile' } };
      });
      get().runReconciliation();
    } catch (e) { console.error('Failed to load sample data:', e); }
  },
  runReconciliation: () => set((s) => {
    const reconciliation = reconcileNAV(s.custodianPositions, s.portfolio.positions, s.custodianCashUSD, s.portfolio.currentCashUSD, s.portfolio.navUSD, s.fxRates, s.breakTolerance);
    return { reconciliation, moState: { ...s.moState, reconciled: true, currentStep: 'nav' } };
  }),
  selectBreak: (breakId) => set({ selectedBreakId: breakId }),
  resolveBreak: (breakId, resolution, notes) => set((s) => {
    if (!s.reconciliation) return s;
    const ticketId = resolution === 'ticket_opened' ? `TKT-${uid().toUpperCase()}` : undefined;
    const updateBreak = <T extends { id: string; resolution: BreakResolution; status: BreakStatus; ticketId?: string; notes?: string }>(brk: T): T => brk.id !== breakId ? brk : { ...brk, resolution, status: resolution === 'unresolved' ? 'New' : 'Resolved', ticketId, notes: notes || brk.notes };
    const positionBreaks = s.reconciliation.positionBreaks.map(updateBreak);
    const cashBreaks = s.reconciliation.cashBreaks.map(updateBreak);
    const unresolvedCount = positionBreaks.filter(b => b.resolution === 'unresolved').length + cashBreaks.filter(b => b.resolution === 'unresolved').length;
    return { reconciliation: { ...s.reconciliation, positionBreaks, cashBreaks, unresolvedCount }, selectedBreakId: null };
  }),
  updateBreakStatus: (breakId, status) => set((s) => {
    if (!s.reconciliation) return s;
    const update = <T extends { id: string; status: BreakStatus }>(brk: T): T => brk.id === breakId ? { ...brk, status } : brk;
    return { reconciliation: { ...s.reconciliation, positionBreaks: s.reconciliation.positionBreaks.map(update), cashBreaks: s.reconciliation.cashBreaks.map(update) } };
  }),
  updateBreakOwner: (breakId, owner) => set((s) => {
    if (!s.reconciliation) return s;
    const update = <T extends { id: string; owner?: string; status: BreakStatus }>(brk: T): T => brk.id === breakId ? { ...brk, owner, status: brk.status === 'New' ? 'Assigned' : brk.status } : brk;
    return { reconciliation: { ...s.reconciliation, positionBreaks: s.reconciliation.positionBreaks.map(update), cashBreaks: s.reconciliation.cashBreaks.map(update) } };
  }),
  updateBreakNotes: (breakId, notes) => set((s) => {
    if (!s.reconciliation) return s;
    const update = <T extends { id: string; notes?: string }>(brk: T): T => brk.id === breakId ? { ...brk, notes } : brk;
    return { reconciliation: { ...s.reconciliation, positionBreaks: s.reconciliation.positionBreaks.map(update), cashBreaks: s.reconciliation.cashBreaks.map(update) } };
  }),
  overrideBreakCause: (breakId, cause, note) => set((s) => {
    if (!s.reconciliation) return s;
    const update = (brk: any): any => brk.id === breakId ? { ...brk, overriddenCause: cause, overrideNote: note } : brk;
    return { reconciliation: { ...s.reconciliation, positionBreaks: s.reconciliation.positionBreaks.map(update), cashBreaks: s.reconciliation.cashBreaks.map(update) } };
  }),
  setBreakTolerance: (tolerance) => set((s) => ({ breakTolerance: { ...s.breakTolerance, ...tolerance } })),
  pushToPMS: () => set((s) => {
    if (!s.reconciliation) return s;
    let updatedPositions = [...s.portfolio.positions];
    let updatedCashUSD = s.portfolio.currentCashUSD;
    for (const brk of s.reconciliation.positionBreaks) {
      if (brk.resolution === 'accept_custodian') {
        const custPos = s.custodianPositions.find(p => p.ticker === brk.ticker);
        if (custPos) updatedPositions = updatedPositions.map(pos => pos.ticker === brk.ticker ? { ...pos, quantity: custPos.quantity, price: custPos.price, marketValue: custPos.marketValueUSD, weight: (custPos.marketValueUSD / s.portfolio.navUSD) * 100, baseMV: custPos.marketValueUSD } : pos);
      }
    }
    for (const brk of s.reconciliation.cashBreaks) { if (brk.resolution === 'accept_custodian') updatedCashUSD = brk.custodianAmount; }
    updatedPositions = updatedPositions.map(pos => ({ ...pos, diffBps: Math.round((pos.weight - pos.indexWeight) * 100) }));
    return { portfolio: { ...s.portfolio, positions: updatedPositions, currentCashUSD: updatedCashUSD, currentCashPct: (updatedCashUSD / s.portfolio.navUSD) * 100, dataAsOf: new Date().toISOString() }, moState: { ...s.moState, pushedToPMS: true }, currentView: 'portfolio' as View };
  }),
  resetMO: () => set({ moState: { currentStep: 'ingest', fileUploaded: false, filename: null, uploadTimestamp: null, normalized: false, reconciled: false, pushedToPMS: false }, reconciliation: null, custodianPositions: [], custodianCashUSD: 0, selectedBreakId: null }),
  addAuditEntry: (action, details, entityType, entityId) => set((s) => ({ auditLog: [...s.auditLog, { id: uid(), timestamp: new Date().toISOString(), user: s.demoUser, action, details, entityType, entityId }] })),
  runScenarios: () => set((s) => {
    const scenarios: DemoScenario[] = [
      { id: 'scenario_1', name: 'Base Currency Pro-Rata', description: 'USD-only, pro-rata, no constraints', checks: [], overallStatus: 'not_run' },
      { id: 'scenario_2', name: 'Multi-Currency with FX', description: 'EUR/CHF positions, auto FX', checks: [], overallStatus: 'not_run' },
      { id: 'scenario_3', name: 'Constrained Rebalance', description: 'Restricted list applied', checks: [], overallStatus: 'not_run' },
    ];
    for (const scenario of scenarios) {
      const checks = [];
      const hasNaN = s.portfolio.positions.some(p => !Number.isFinite(p.price) || !Number.isFinite(p.weight));
      checks.push({ name: 'No NaN values', description: 'All position values valid', status: hasNaN ? 'failed' as const : 'passed' as const });
      const totalWeight = s.portfolio.positions.reduce((a, p) => a + p.weight, 0);
      const weightOk = Math.abs(totalWeight + s.portfolio.currentCashPct - 100) < 5;
      checks.push({ name: 'Weights sanity', description: 'Weights + cash ≈ 100%', status: weightOk ? 'passed' as const : 'failed' as const });
      const negativeCash = s.portfolio.cashBuckets.some(b => b.total < 0);
      checks.push({ name: 'Cash ladder valid', description: 'No negative buckets', status: negativeCash ? 'failed' as const : 'passed' as const });
      const availCheck = s.rebalanceConfig.investableCash <= s.rebalanceConfig.availableCash + 1;
      checks.push({ name: 'Cash cap enforced', description: 'Investable ≤ Available', status: availCheck ? 'passed' as const : 'failed' as const });
      scenario.checks = checks;
      scenario.overallStatus = checks.every(c => c.status === 'passed') ? 'passed' : 'failed';
    }
    return { scenarios };
  }),
  openExportModal: () => set({ exportModalOpen: true }),
  closeExportModal: () => set({ exportModalOpen: false }),
  // v2.3 additions
  updateCashProjection: () => set((s) => {
    const cashProjection = calculateCashProjection(
      s.portfolio,
      s.baskets,
      s.fxTrades,
      s.fxRates,
      s.rebalanceConfig.settlementHorizon
    );
    return { cashProjection };
  }),
  updateShadowNAVCard: () => set((s) => {
    const shadowNAVCard = calculateShadowNAVCard(
      s.portfolio,
      s.custodianPositions,
      s.custodianCashUSD,
      s.fxRates
    );
    return { shadowNAVCard };
  }),
}));
