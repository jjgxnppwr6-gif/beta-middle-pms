# PMS Cockpit — V0 Demo

A web-based portfolio management system demonstrating end-to-end asset management workflows: cash arrival → shadow NAV & reconciliation → rebalance proposal → OMS baskets (equities + FX) → expected cash & TE impact.

![PMS Cockpit](./screenshot.png)

## Features

### 📊 Portfolio Manager View
- **Portfolio positions** vs benchmark with real-time tracking
- **Weight differences** and tracking error visualization
- **Interactive rebalancing** with target cash slider
- **Preset strategies**: full basket, selected lines, underweights, active gaps (>10 bps)
- **Suggested quantities** automatically calculated from index weights
- **Live expected cash** calculation as trades are entered
- **Corporate actions** tracking (dividends, splits)

### 🏦 Middle Office View
- **Custodian data integration** (BNY Mellon mock data)
- **Shadow NAV calculation** from custodian positions + cash
- **Reconciliation engine** comparing shadow NAV vs official NAV
- **Position breaks** detection: Missing positions, Quantity differences, Price differences, FX rate differences
- **Cash breaks** by currency
- **Attribution analysis**: Price effect, FX effect, Missing positions, Cash effect

### 🧾 OMS (Order Management System)
- **Equity baskets** generated from rebalance
- **FX baskets** automatically created for non-USD flows
- **Order details**: Notional, % of investment, ADV%, compliance checks
- **Expandable basket view** showing individual orders
- **Mock routing** to EMSX (equities) / FXGO (FX)
- **Fill tracking** with progress bars and status badges

## Architecture

### Stack
- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: Zustand (single store pattern)
- **Data**: Mock JSON files (no backend required)

### Project Structure
```
pms-cockpit/
├── app/
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppLayout.tsx        # Main shell with navigation
│   │   └── views/
│   │       ├── PortfolioView.tsx    # PM view
│   │       ├── MiddleOfficeView.tsx # Reconciliation view
│   │       └── OMSView.tsx          # Order management view
│   ├── lib/
│   │   ├── store/
│   │   │   └── index.ts             # Zustand store (single source of truth)
│   │   ├── calculations/
│   │   │   └── index.ts             # Pure functions for all calculations
│   │   └── types/
│   │       └── index.ts             # TypeScript domain types
│   ├── globals.css                  # Global styles + custom components
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Main page
├── public/
│   └── data/
│       ├── portfolio.json           # Portfolio positions & metadata
│       └── custodian.json           # Custodian data for reconciliation
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

### State Architecture
All application state lives in a single Zustand store (`app/lib/store/index.ts`):
- **Portfolio state**: Positions, cash, NAV, benchmark
- **Rebalance config**: Target cash, preset, FX settings
- **OMS state**: Baskets, orders, execution status
- **Middle Office state**: Custodian positions, reconciliation results

### Calculation Layer
Pure functions in `app/lib/calculations/index.ts`:
- `calculateExpectedCash()` - Live cash after trades
- `calculateSuggestedQuantities()` - Rebalance quantities vs index
- `generateRebalanceOrders()` - Create equity + FX baskets
- `reconcileNAV()` - Shadow NAV vs official NAV with breaks
- `calculateTrackingError()` - Ex-ante TE from active weights

## Setup & Installation

### Prerequisites
- Node.js 18+ and npm

### Installation
```bash
# Clone the repository
cd pms-cockpit

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Build for Production
```bash
# Create optimized production build
npm run build

# Preview production build locally
npm start
```

### Deploy to Vercel/Netlify
```bash
# Build static export
npm run build

# The `out` directory contains the static site
# Upload to Vercel, Netlify, or any static host
```

The app is configured for static export (`output: 'export'` in `next.config.mjs`), so it can be deployed to any static hosting service.

## Mock Data

All data is stored in JSON files under `public/data/`:

### `portfolio.json`
- 10 positions (AAPL, MSFT, AMZN, NVDA, GOOGL, META, TSM, ASML, NESN, MC)
- Portfolio NAV: $1.25bn
- Current cash: 2.5% ($31.25m)
- Benchmark: MSCI World Net TR (USD)
- Corporate actions (dividends)

### `custodian.json`
- BNY Mellon custodian positions
- Intentionally includes breaks for demo:
  - AAPL: Price difference ($195.00 → $195.50)
  - NVDA: Quantity difference (60,000 → 59,500)
  - ASML: FX rate difference (1.0850 → 1.0860)
  - Cash difference ($31.25m → $31.5m)

## User Workflows

### 1. Portfolio Manager Flow
1. **View positions** vs benchmark (weight differences in bps)
2. **Adjust target cash** using slider (0% - 5%)
3. **Select rebalance scope** (all, selected, active gaps, underweights)
4. **Review suggested quantities** (auto-calculated from index weights)
5. **Generate rebalance** → Creates equity + FX baskets in OMS

### 2. Middle Office Flow
1. **View custodian data** from BNY Mellon
2. **Run reconciliation** → Compare shadow NAV vs official NAV
3. **Review position breaks** (missing, quantity, price, FX)
4. **Analyze attribution** (price effect, FX effect, cash effect)
5. **Investigate discrepancies** before EOD NAV publication

### 3. OMS Flow
1. **View generated baskets** (equity + FX)
2. **Expand baskets** to see individual orders
3. **Review compliance** checks (✓ = within policy)
4. **Route to broker** → Mock execution with fill % updates
5. **Monitor fills** via progress bars and status badges

## Assumptions & Simplifications

### Market Data
- **Prices**: Static mock prices (no live feeds)
- **FX rates**: Fixed rates (USD, EUR, GBP, CHF, JPY)
- **Corporate actions**: Single mock dividend batch

### Calculations
- **Tracking error**: Simplified quadrature of active weights
- **Rebalance logic**: Scales suggested quantities to match target cash
- **FX hedging**: Aggregates non-USD flows per currency

### Execution
- **No real routing**: Mock progress (70% equities, 50% FX)
- **No price impact**: Assumes unlimited liquidity
- **No EMS/FIX**: UI simulation only

### Middle Office
- **Perfect data quality**: No missing fields or corrupt records
- **Same-day settlement**: T+0 for all instruments
- **Single custodian**: BNY Mellon only

## What's Next (V1)

Out of scope for V0 but natural extensions:
- **Real market data** via Bloomberg/Refinitiv API
- **Optimization engine** for rebalance (minimize TE, turnover, costs)
- **Advanced analytics** (factor exposures, risk decomposition)
- **Pre-trade TCA** (transaction cost analysis)
- **Post-trade reporting** (slippage, venue analysis)
- **Multi-portfolio** support
- **User authentication** and permissions
- **Audit trail** and compliance reporting
- **Database backend** (PostgreSQL + Prisma)

## Technical Highlights

### State Management Pattern
Single Zustand store with clear separation:
- **Data**: Portfolio, positions, baskets
- **Config**: Rebalance settings, view state
- **Actions**: Pure functions + state updates

### Calculation Purity
All calculations are pure functions that:
- Take inputs explicitly (no hidden dependencies)
- Return new objects (immutable)
- Can be unit tested independently

### Component Architecture
- **Layout components**: AppLayout (shell + navigation)
- **View components**: Portfolio, MiddleOffice, OMS (full-page views)
- **UI components**: Inline (pills, cards, badges) for simplicity

### Styling Approach
- **Design tokens** from beta.html preserved as Tailwind config
- **Custom CSS** for complex components (slider, tables)
- **Responsive** grid layouts with Tailwind breakpoints

## License

MIT

## Support

For questions or issues, please open a GitHub issue or contact [your-email].

---

**Built with ❤️ as a V0 demo for asset management workflows**
