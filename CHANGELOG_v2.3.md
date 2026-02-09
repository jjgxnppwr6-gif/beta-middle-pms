# CHANGELOG v2.3 — Investor Demo Release

**Release Date:** February 2026  
**Focus:** Cash Projection, Shadow NAV Card, UI Polish for Institutional Demo

---

## 🎯 Summary

Version 2.3 is the **investor demo release**, optimized for presenting to CEOs and institutional investors. Key additions include real-time cash projection in the status bar, a comprehensive Shadow NAV Card with bridge breakdown, and a full UI refresh replacing emojis with professional Lucide icons.

---

## ✨ New Features

### 1. Cash Status Pills (Status Bar)

**Location:** Global header, visible on all views

- **Available Cash @ Horizon**: Shows current cash at selected settlement horizon (T/T+1/T+2)
- **Projected Cash (After OMS)**: Dynamically updates as orders are generated/routed
- **Status Indicator**: Visual states — Current → Projected → Pending → Routed
- **Live Updates**: Recalculates when:
  - Settlement horizon changes
  - Baskets are created/modified
  - FX trades are booked
  - Orders are routed

### 2. Shadow NAV Card (Middle Office Step 4)

**Location:** Middle Office → Step 4

- **Shadow NAV**: Computed from positions × prices × FX + cash
- **NAV/Share**: Shadow NAV ÷ shares outstanding
- **Admin NAV Comparison**: Shows admin NAV with as-of date
- **Delta Display**: USD and bps variance with color-coded severity
- **Daily Accrual**: Management fee accrual at configurable bps (default 25bps)

**NAV Bridge Breakdown:**
- Price Effect — variance from internal vs custodian prices
- FX Effect — FX rate differences
- Cash/Timing — settlement timing differences  
- Mgmt Fee Accrual — daily fee accrual
- Residual — unexplained variance

### 3. Enhanced Portfolio Data

**New fields in `portfolio.json`:**
- `sharesOutstanding`: 10,000,000 shares
- `adminNAV`: Official administrator NAV
- `adminNAVAsOf`: Admin NAV timestamp
- `managementFeeBps`: Annual fee rate in bps (default 25)

---

## 🎨 UI Refresh

### Lucide Icons

All emojis replaced with professional Lucide React icons:

| View | Icons Used |
|------|------------|
| Sidebar | Building2, PieChart, Droplets, BarChart3, Target, FileText |
| Middle Office | Upload, CheckCircle2, AlertTriangle, Calculator, Sparkles |
| Portfolio | PieChart, Globe, Building, Calendar, TrendingUp/Down |
| Cash & FX | Droplets, DollarSign, Percent, Clock, Zap, ArrowRightLeft |
| Rebalance | Target, Settings, Clock, Sparkles, Play |
| OMS | Send, Inbox, ChevronDown/Right, TrendingUp/Down |
| Analytics | BarChart3, Target, Crosshair, Award |

### Spacing & Density

- **Tables**: Reduced padding (10px → 8px), smaller headers (11px → 10px)
- **Cards**: Tighter padding (16px → 14px), smaller titles (11px → 10px)
- **Badges**: More compact with icon support
- **Toggle Groups**: Added `toggle-group-sm` variant

### Typography Hierarchy

- KPI tiles with clear label/value/sublabel structure
- Consistent card titles with icon support
- Improved section headers with separators

---

## 🔧 Technical Changes

### Types (types/index.ts)

New types added:
- `OrderState`: 'projected' | 'routed' | 'filled' | 'settled'
- `CashProjection`: Real-time cash status for status bar
- `ShadowNAVCard`: Full NAV reconciliation with bridge
- `NAVBridgeItem`: Individual bridge line item

### Calculations (calculations/index.ts)

New functions:
- `applyPendingEquityToCashLadder()` — Projects equity order cash impact
- `calculateCashProjection()` — Computes status bar cash metrics
- `calculateShadowNAVCard()` — Full NAV reconciliation with bridge

### Store (store/index.ts)

New state:
- `cashProjection: CashProjection | null`
- `shadowNAVCard: ShadowNAVCard | null`

New actions:
- `updateCashProjection()` — Recalculates cash projection
- `updateShadowNAVCard()` — Recalculates shadow NAV

---

## 📦 Dependencies

Added:
- `lucide-react@^0.309.0` — Professional icon library

---

## 🚀 Demo Flow

Recommended demo sequence for investors:

1. **Middle Office** → Load demo data → Show reconciliation with AI cause analysis
2. **Shadow NAV Card** → Explain bridge breakdown, show delta is within tolerance
3. **Rebalance** → Adjust target cash, generate orders
4. **Status Bar** → Highlight cash pills updating in real-time
5. **OMS** → Route orders, show status transition
6. **Cash View** → Show settlement ladder with pending FX

---

## 📋 Known Limitations

- Bridge breakdown is approximate (simplified attribution)
- FX effect calculation requires custodian FX rates
- Shares outstanding must be manually configured in JSON

---

## 🔜 Roadmap (v2.4)

- Order state persistence (projected → routed → filled)
- Enhanced audit logging for compliance
- Export Shadow NAV Card to PDF
- Real-time WebSocket price feeds
