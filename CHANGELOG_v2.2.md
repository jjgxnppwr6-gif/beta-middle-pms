# PMS Cockpit v2.2.0 — Demo Readiness Release (2025-02-05)

## Summary
This release addresses all P0/P1/P2 issues from the feedback review, making the demo coherent and investor-ready.

---

## P0 Fixes — Cash Ladder Single Source of Truth

### Fixed `getCumulativeCashAtHorizon()`
- **Before**: Summed T + T1 + T2 (triple-counting with cumulative data)
- **After**: Reads horizon column directly (T2 column = cash available by T+2)

### Updated Sample Data (`portfolio.json`)
- Cash buckets are now properly cumulative:
  - USD: T=20M → T1=21.5M → T2=22.2M
  - EUR: T=5.5M → T1=6M → T2=6.5M
  - GBP: T=1.2M → T1=1.35M → T2=1.5M

### FX Settlement Robustness
- FX trades now store explicit `settlementBucket` (not derived from date math)
- Eliminates timezone/weekend drift issues

---

## P1 — Cash View Improvements

### KPI Tiles at Top
- **Total Cash** (USD equiv, all currencies)
- **Cash % of NAV** (with warning if >2%)
- **Available Now (T)** (settled cash)
- **Available at Horizon** (with T/T+1/T+2 selector)

### Table Improvements
- Footer row shows USD totals for T, T+1, T+2 columns
- Clear "cumulative" labeling

---

## P1 — Active Mode Redesign

### New Behavior
- **Eligible universe**: |diffBps| ≥ 10 (both over and underweights)
- **Generates sells**: Overweights → reduce to index weight
- **Generates buys**: Underweights → increase to index weight
- **Cash flow**: Sell proceeds + investable cash fund buys

### UI Updates
- Mode description: "Sell overweights + buy underweights to track index"
- Shows count: "(X eligible: Y↑ Z↓)"
- Confirmation modal shows separate sell/buy totals

---

## P1 — FX Execution Type (WMR vs SPOT)

### Replaced Settlement Timing with Execution Type
- **Before**: ON / TOM / SPOT (settlement timing)
- **After**: WMR / SPOT (execution type)

### Execution Types
- **WMR**: WM/Reuters 4pm London fix (T+2 settlement)
- **SPOT**: Live interbank rate (T+2 settlement)

### Visible In
- FX Modal (with description)
- Pending FX table
- OMS FX orders
- Export payloads

---

## P2 — Equity Settlement Buckets

### Settlement Rules
- **US equities** (ticker ends " US"): T+1
- **Rest of world**: T+2

### Implementation
- Each order tagged with `settlementBucket`
- Visible in OMS order details
- Included in exports

---

## P2 — Middle Office KPIs

### Step 2 Improvements
- Now shows 6 metrics in 2 rows:
  - Row 1: File, Positions, Timestamp
  - Row 2: **Custodian Cash**, **Internal Cash**, **Cash Delta**
- Cash Delta highlighted if >$100k

---

## Data Model Changes

### Types Updated
```typescript
// FXTrade
+ executionType: 'WMR' | 'SPOT'
+ settlementBucket: 'T' | 'T1' | 'T2' | 'T3' | 'T5'

// RebalanceAllocation
+ side: 'Buy' | 'Sell'
+ settlementBucket: SettlementBucket

// RebalanceResult
+ totalSold: number

// RebalanceConfig
- fxSettlementType → fxExecutionType

// Order
+ fxExecutionType?: FXExecutionType
+ settlementBucket?: SettlementBucket
```

### Export Schema Versions
- Baskets: v1 → v2
- FX Trades: v1 → v2

---

## Sample Data Updates

### Position Active Weights
Updated to create demo-ready active rebalance scenarios:
- NVDA: -15 bps (underweight)
- TSM: -15 bps (underweight)
- NESN: -12 bps (underweight)
- META: +15 bps (overweight)
- MC: +12 bps (overweight)
- AAPL: +10 bps (at threshold)

---

## How to Test

1. **Cash Ladder**: Go to Cash tab → verify KPI tiles show correct values
2. **Rebalance Everything**: Generate orders → verify cash calculations
3. **Rebalance Active**: Select Active mode → verify both buys and sells generated
4. **FX**: Click cell in Cash ladder → verify WMR/SPOT toggle works
5. **Export**: Download JSON → verify new fields present
