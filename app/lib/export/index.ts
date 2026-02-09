// ============================================
// PMS Cockpit v2.1 — Export Utilities
// ============================================

import type {
  Basket,
  FXTrade,
  NAVReconciliation,
  PositionBreak,
  CashBreak,
  AuditEntry,
  Position,
  CashBucket,
} from '../types';

// ============================================
// CSV Export
// ============================================

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map((row) => row.map(escapeCSV).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// ============================================
// Basket Export
// ============================================

export function exportBasketsCSV(baskets: Basket[]): string {
  const headers = [
    'Basket ID',
    'Basket Name',
    'Timestamp',
    'Type',
    'Order ID',
    'Ticker',
    'Side',
    'Currency',
    'Quantity',
    'Notional USD',
    '% of Basket',
    'Settlement Bucket',
    'Status',
  ];

  const rows: unknown[][] = [];

  for (const basket of baskets) {
    for (const order of basket.orders) {
      rows.push([
        basket.id,
        basket.name,
        basket.timestamp,
        basket.type,
        order.id,
        order.ticker,
        order.side,
        order.currency,
        order.quantity || '',
        order.notionalUSD,
        order.pctOfBasket.toFixed(2),
        order.settlementBucket || (basket.type === 'FX' ? 'T2' : ''),
        order.status,
      ]);
    }
  }

  return toCSV(headers, rows);
}

export function exportBasketsJSON(baskets: Basket[]): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    schema: 'pms-cockpit/baskets/v2',
    baskets: baskets.map((b) => ({
      id: b.id,
      name: b.name,
      timestamp: b.timestamp,
      type: b.type,
      totalNotionalUSD: b.totalNotionalUSD,
      status: b.status,
      orders: b.orders.map((o) => ({
        id: o.id,
        ticker: o.ticker,
        side: o.side,
        type: o.type,
        currency: o.currency,
        quantity: o.quantity,
        notionalUSD: o.notionalUSD,
        pctOfBasket: o.pctOfBasket,
        settlementBucket: o.settlementBucket,
        fxExecutionType: o.fxExecutionType,
        status: o.status,
      })),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

// ============================================
// FX Export
// ============================================

export function exportFXTradesCSV(trades: FXTrade[]): string {
  const headers = [
    'Trade ID',
    'Sell CCY',
    'Buy CCY',
    'Sell Amount',
    'Buy Amount',
    'FX Rate',
    'Trade Date',
    'Settle Date',
    'Execution Type',
    'Settlement Bucket',
    'Status',
    'Source',
  ];

  const rows: unknown[][] = trades.map((t) => [
    t.id,
    t.sellCcy,
    t.buyCcy,
    t.sellAmt,
    t.buyAmt,
    t.fxRate,
    t.tradeDate,
    t.settleDate,
    t.executionType || 'SPOT',
    t.settlementBucket || 'T2',
    t.status,
    t.source,
  ]);

  return toCSV(headers, rows);
}

export function exportFXTradesJSON(trades: FXTrade[]): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    schema: 'pms-cockpit/fx-trades/v2',
    trades: trades.map((t) => ({
      id: t.id,
      sellCurrency: t.sellCcy,
      buyCurrency: t.buyCcy,
      sellAmount: t.sellAmt,
      buyAmount: t.buyAmt,
      fxRate: t.fxRate,
      tradeDate: t.tradeDate,
      settleDate: t.settleDate,
      executionType: t.executionType || 'SPOT',
      settlementBucket: t.settlementBucket || 'T2',
      status: t.status,
      source: t.source,
      createdAt: t.createdAt,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

// ============================================
// Reconciliation Export
// ============================================

export function exportReconciliationCSV(
  recon: NAVReconciliation,
  auditLog: AuditEntry[]
): string {
  const headers = [
    'Break ID',
    'Type',
    'Item',
    'Cause',
    'Confidence',
    'Custodian Value',
    'Internal Value',
    'Delta USD',
    'Status',
    'Owner',
    'Notes',
    'Resolution',
    'Suggested Fix',
  ];

  const rows: unknown[][] = [];

  const allBreaks: (PositionBreak | CashBreak)[] = [
    ...recon.positionBreaks,
    ...recon.cashBreaks,
  ];

  for (const brk of allBreaks) {
    const isPosition = 'ticker' in brk;
    const item = isPosition ? (brk as PositionBreak).ticker : (brk as CashBreak).currency;
    const type = isPosition ? (brk as PositionBreak).type : 'Cash';
    const custVal = isPosition
      ? (brk as PositionBreak).custodianValue
      : (brk as CashBreak).custodianAmount;
    const intVal = isPosition
      ? (brk as PositionBreak).internalValue
      : (brk as CashBreak).internalAmount;

    rows.push([
      brk.id,
      type,
      item,
      brk.causeAnalysis?.cause || 'Unknown',
      brk.causeAnalysis?.confidence || 0,
      custVal,
      intVal,
      brk.deltaUSD,
      brk.status,
      brk.owner || '',
      brk.notes || '',
      brk.resolution,
      brk.causeAnalysis?.suggestedFix || '',
    ]);
  }

  let csv = toCSV(headers, rows);

  // Add summary section
  csv += '\n\n--- SUMMARY ---\n';
  csv += `Shadow NAV,${recon.shadowNAV}\n`;
  csv += `Official NAV,${recon.officialNAV}\n`;
  csv += `Delta,${recon.delta}\n`;
  csv += `Delta (bps),${recon.deltaBps.toFixed(2)}\n`;
  csv += `Unresolved Breaks,${recon.unresolvedCount}\n`;
  csv += `Status,${recon.status}\n`;

  // Add audit log
  if (auditLog.length > 0) {
    csv += '\n\n--- AUDIT LOG ---\n';
    csv += 'Timestamp,User,Action,Details\n';
    for (const entry of auditLog) {
      csv += `${entry.timestamp},${entry.user},${entry.action},"${JSON.stringify(entry.details)}"\n`;
    }
  }

  return csv;
}

export function exportReconciliationJSON(
  recon: NAVReconciliation,
  auditLog: AuditEntry[]
): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    schema: 'pms-cockpit/reconciliation/v1',
    summary: {
      shadowNAV: recon.shadowNAV,
      officialNAV: recon.officialNAV,
      delta: recon.delta,
      deltaBps: recon.deltaBps,
      unresolvedCount: recon.unresolvedCount,
      status: recon.status,
    },
    breaksByCause: recon.breaksByCause,
    positionBreaks: recon.positionBreaks.map((b) => ({
      id: b.id,
      ticker: b.ticker,
      name: b.name,
      type: b.type,
      causeAnalysis: b.causeAnalysis,
      custodianValue: b.custodianValue,
      internalValue: b.internalValue,
      deltaUSD: b.deltaUSD,
      resolution: b.resolution,
      status: b.status,
      owner: b.owner,
      notes: b.notes,
    })),
    cashBreaks: recon.cashBreaks.map((b) => ({
      id: b.id,
      currency: b.currency,
      causeAnalysis: b.causeAnalysis,
      custodianAmount: b.custodianAmount,
      internalAmount: b.internalAmount,
      deltaUSD: b.deltaUSD,
      resolution: b.resolution,
      status: b.status,
      owner: b.owner,
      notes: b.notes,
    })),
    auditLog: auditLog.map((e) => ({
      timestamp: e.timestamp,
      user: e.user,
      action: e.action,
      details: e.details,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

// ============================================
// Positions Export
// ============================================

export function exportPositionsJSON(
  positions: Position[],
  cashBuckets: CashBucket[],
  navUSD: number
): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    schema: 'pms-cockpit/positions/v1',
    navUSD,
    positions: positions.map((p) => ({
      ticker: p.ticker,
      name: p.name,
      exchange: p.exchange,
      sector: p.sector,
      currency: p.currency,
      quantity: p.quantity,
      price: p.price,
      marketValueUSD: p.marketValue,
      weightPct: p.weight,
      indexWeightPct: p.indexWeight,
      activeWeightBps: p.diffBps,
      ytdPerformancePct: p.ytdPerformance,
      tradable: p.tradable,
      restricted: p.restricted || false,
    })),
    cashBuckets: cashBuckets.map((b) => ({
      currency: b.currency,
      T: b.T,
      T1: b.T1,
      T2: b.T2,
      T3: b.T3,
      T5: b.T5,
      total: b.total,
      equivUSD: b.equivUSD,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

// ============================================
// Download Helper
// ============================================

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
