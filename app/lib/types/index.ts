// ============================================
// PMS Cockpit v2.3 — Type Definitions
// ============================================

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CHF' | 'JPY';

// ============================================
// Order State (v2.3) — Projected vs Routed
// ============================================

export type OrderState = 'projected' | 'routed' | 'filled' | 'settled';

export type Sector =
  | 'Information Technology'
  | 'Consumer Discretionary'
  | 'Communication Services'
  | 'Consumer Staples'
  | 'Financials'
  | 'Health Care'
  | 'Industrials'
  | 'Energy'
  | 'Materials'
  | 'Real Estate'
  | 'Utilities';

// ============================================
// Portfolio & Positions
// ============================================

export interface Position {
  ticker: string;
  name: string;
  exchange: string;
  sector: Sector;
  currency: Currency;
  quantity: number;
  price: number;
  marketValue: number;
  weight: number;
  indexWeight: number;
  diffBps: number;
  ytdPerformance: number;
  tradable: boolean;
  restricted?: boolean;
  // Calculated during rebalance
  suggestedQty?: number;
  tradeQty?: number;
  baseMV?: number;
}

export interface CashBucket {
  currency: Currency;
  T: number;
  T1: number;
  T2: number;
  T3: number;
  T5: number;
  total: number;
  equivUSD: number;
}

export interface CorporateAction {
  date: string;
  type: 'Dividend' | 'Split' | 'Merger';
  tickers: string[];
  amountUSD: number;
  description: string;
}

export interface Portfolio {
  name: string;
  benchmark: string;
  navUSD: number;
  baseCurrency: Currency;
  currentCashPct: number;
  currentCashUSD: number;
  positions: Position[];
  cashBuckets: CashBucket[];
  corporateActions: CorporateAction[];
  dataAsOf?: string;
  // v2.3 additions
  sharesOutstanding?: number;
  adminNAV?: number;
  adminNAVAsOf?: string;
  managementFeeBps?: number; // Annual fee in bps, default 25
}

// ============================================
// FX System (v2.1)
// ============================================

export type FXExecutionType = 'WMR' | 'SPOT';
export type FXStatus = 'Pending' | 'Settled' | 'Cancelled';
export type SettlementBucket = 'T' | 'T1' | 'T2' | 'T3' | 'T5';

export interface FXTrade {
  id: string;
  sellCcy: Currency;
  buyCcy: Currency;
  sellAmt: number;
  buyAmt: number;
  fxRate: number;
  tradeDate: string;
  settleDate: string;
  executionType: FXExecutionType;
  settlementBucket: SettlementBucket;
  status: FXStatus;
  source: 'Manual' | 'Rebalance' | 'SpotToBase';
  createdAt: string;
  // Legacy field for backwards compatibility
  settlementType?: 'ON' | 'TOM' | 'SPOT';
}

// ============================================
// Rebalance Configuration (v2.1)
// ============================================

export type SettlementHorizon = 'T' | 'T1' | 'T2';
export type RebalanceMode = 'everything' | 'selected' | 'active';

export interface RebalanceConfig {
  mode: RebalanceMode;
  settlementHorizon: SettlementHorizon;
  targetCashPct: number;
  autoFX: boolean;
  fxExecutionType: FXExecutionType;
  // Computed
  availableCash: number;
  investableCash: number;
}

export interface RebalanceAllocation {
  ticker: string;
  name: string;
  currency: Currency;
  side: 'Buy' | 'Sell';
  currentWeight: number;
  targetWeight: number;
  deficitBps: number;
  allocation: number;
  quantity: number;
  price: number;
  notionalUSD: number;
  reason: string;
  settlementBucket: SettlementBucket;
}

export interface RebalanceResult {
  allocations: RebalanceAllocation[];
  fxOrders: Omit<FXTrade, 'id' | 'createdAt'>[];
  totalInvested: number;
  totalSold: number;
  residual: number;
  skipped: { ticker: string; reason: string }[];
  summary: {
    mode: RebalanceMode;
    ordersCount: number;
    fxOrdersCount: number;
    cashBefore: number;
    cashAfter: number;
    topReasons: string[];
    largestAllocations: string[];
  };
}

// ============================================
// OMS
// ============================================

export type OrderSide = 'Buy' | 'Sell';
export type OrderType = 'Equity' | 'FX';
export type OrderStatus = 'Pending' | 'Routed' | 'PartialFill' | 'Filled' | 'Cancelled';

export interface Order {
  id: string;
  ticker: string;
  side: OrderSide;
  type: OrderType;
  currency: Currency;
  quantity?: number;
  notionalUSD: number;
  pctOfBasket: number;
  advPct?: number;
  fxMid?: string;
  fxExecutionType?: FXExecutionType;
  settlementBucket?: SettlementBucket;
  status: OrderStatus;
  fillPct: number;
  doNotTrade?: boolean;
}

export interface Basket {
  id: string;
  name: string;
  timestamp: string;
  type: 'Equity' | 'FX';
  orders: Order[];
  totalNotionalUSD: number;
  status: OrderStatus;
  fillPct: number;
  expanded?: boolean;
  // v2.3 additions
  orderState?: OrderState; // projected → routed → filled → settled
}

// ============================================
// Middle Office — Breaks (v2.1)
// ============================================

export type BreakCause =
  | 'Settlement timing'
  | 'Missing trade'
  | 'Price discrepancy'
  | 'FX missing/incorrect'
  | 'Corporate action'
  | 'Fees & taxes'
  | 'Missing position'
  | 'Data mapping issue'
  | 'Unknown';

export type BreakStatus = 'New' | 'Assigned' | 'In Progress' | 'Resolved' | 'Waived';

export type BreakResolution =
  | 'unresolved'
  | 'accept_custodian'
  | 'keep_internal'
  | 'adjustment_created'
  | 'ticket_opened';

export interface BreakCauseAnalysis {
  cause: BreakCause;
  confidence: number;
  evidence: string[];
  suggestedFix: string;
}

export interface PositionBreak {
  id: string;
  ticker: string;
  name?: string;
  type: 'Missing' | 'Quantity' | 'Price' | 'FX';
  custodianQty?: number;
  internalQty?: number;
  custodianPrice?: number;
  internalPrice?: number;
  custodianFX?: number;
  internalFX?: number;
  custodianValue?: number;
  internalValue?: number;
  delta: number;
  deltaUSD: number;
  // v2.1 fields
  causeAnalysis?: BreakCauseAnalysis;
  resolution: BreakResolution;
  status: BreakStatus;
  owner?: string;
  sla?: string;
  notes?: string;
  ticketId?: string;
  overriddenCause?: BreakCause;
  overrideNote?: string;
}

export interface CashBreak {
  id: string;
  currency: Currency;
  custodianAmount: number;
  internalAmount: number;
  delta: number;
  deltaUSD: number;
  // v2.1 fields
  causeAnalysis?: BreakCauseAnalysis;
  resolution: BreakResolution;
  status: BreakStatus;
  owner?: string;
  sla?: string;
  notes?: string;
  ticketId?: string;
}

export interface BreakTolerance {
  absoluteUSD: number;
  relativeBps: number;
}

export interface NAVReconciliation {
  shadowNAV: number;
  officialNAV: number;
  delta: number;
  deltaBps: number;
  positionBreaks: PositionBreak[];
  cashBreaks: CashBreak[];
  unresolvedCount: number;
  status: 'aligned' | 'investigate' | 'critical';
  // v2.1 groupings
  breaksByCause: Record<BreakCause, { count: number; totalUSD: number }>;
}

// ============================================
// Audit Log (v2.1)
// ============================================

export type AuditAction =
  | 'import_file'
  | 'mapping_change'
  | 'override_price'
  | 'override_cause'
  | 'book_fx'
  | 'resolve_break'
  | 'waive_break'
  | 'create_basket'
  | 'route_basket'
  | 'cancel_basket'
  | 'push_to_pms';

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: AuditAction;
  details: Record<string, unknown>;
  entityType?: 'break' | 'fx' | 'basket' | 'position';
  entityId?: string;
}

// ============================================
// Middle Office State
// ============================================

export type MOStep = 'ingest' | 'normalize' | 'reconcile' | 'nav';

export interface MOState {
  currentStep: MOStep;
  fileUploaded: boolean;
  filename: string | null;
  uploadTimestamp: string | null;
  normalized: boolean;
  reconciled: boolean;
  pushedToPMS: boolean;
}

export interface CustodianPosition {
  ticker: string;
  quantity: number;
  price: number;
  currency: Currency;
  marketValueLocal: number;
  fxRate: number;
  marketValueUSD: number;
}

// ============================================
// FX Rates
// ============================================

export interface FXRates {
  USD: number;
  EUR: number;
  GBP: number;
  CHF: number;
  JPY: number;
  [key: string]: number;
}

// ============================================
// Analytics
// ============================================

export interface TEContributor {
  source: string;
  bps: number;
  comment: string;
}

export interface Analytics {
  trackingErrorExPost: number;
  trackingErrorExAnte: number;
  cashDragBps: number;
  alpha: number;
  portfolioYTD: number;
  indexYTD: number;
  teContributors: TEContributor[];
}

// ============================================
// Demo Scenarios (v2.1)
// ============================================

export type ScenarioStatus = 'passed' | 'failed' | 'not_run';

export interface ScenarioCheck {
  name: string;
  description: string;
  status: ScenarioStatus;
  message?: string;
}

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  checks: ScenarioCheck[];
  overallStatus: ScenarioStatus;
}

// ============================================
// App View
// ============================================

export type View = 'middleOffice' | 'portfolio' | 'cash' | 'analytics' | 'rebalance' | 'oms';

// ============================================
// Cash Projection (v2.3) — Live Status Bar
// ============================================

export interface CashProjection {
  availableCashUSD: number;
  availableCashPct: number;
  projectedCashUSD: number;
  projectedCashPct: number;
  pendingEquityBuysUSD: number;
  pendingEquitySellsUSD: number;
  pendingFXNetUSD: number;
  status: 'current' | 'projected' | 'pending' | 'routed';
  settlementHorizon: SettlementHorizon;
}

// ============================================
// Shadow NAV Card (v2.3)
// ============================================

export interface NAVBridgeItem {
  label: string;
  valueUSD: number;
  valueBps: number;
  description?: string;
}

export interface ShadowNAVCard {
  shadowNAV: number;
  navPerShare: number;
  adminNAV: number;
  adminNAVAsOf: string;
  deltaUSD: number;
  deltaBps: number;
  fxMode: string;
  asOfTimestamp: string;
  dailyAccrual: number;
  managementFeeBps: number;
  bridge: NAVBridgeItem[];
}
