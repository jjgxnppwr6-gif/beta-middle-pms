'use client';

import { useStore } from '@/app/lib/store';
import { fmtUSD, fmtPct, fmtBps, fmtNum, fmtQty } from '@/app/lib/fmt';
import {
  PieChart,
  CheckSquare,
  Square,
  TrendingUp,
  TrendingDown,
  Globe,
  Building,
  Calendar,
  Sparkles,
  X,
  CheckCircle2,
} from 'lucide-react';

function calcSuggested(pos: any, navUSD: number, fxRates: any): { qty: number; tooltip: string } {
  const fx = fxRates[pos.currency] || 1;
  const targetMV = (pos.indexWeight / 100) * navUSD;
  const currentMV = pos.marketValue || 0;
  const deltaMV = targetMV - currentMV;
  const deltaLocal = deltaMV / fx;
  const qty = pos.price > 0 ? Math.round(deltaLocal / pos.price) : 0;
  const tooltip = `Target: ${(targetMV/1e6).toFixed(2)}M | Current: ${(currentMV/1e6).toFixed(2)}M | Suggested: ${qty > 0 ? '+' : ''}${qty}`;
  return { qty, tooltip };
}

export default function PortfolioView() {
  const { portfolio, fxRates, selectedTickers, toggleTickerSelection, selectAllTickers, clearSelection, updateTradeQty, clearAllTradeQty } = useStore();

  const hasSelections = selectedTickers.size > 0;
  const hasTrades = portfolio.positions.some(p => (p.tradeQty || 0) !== 0);

  const applySuggested = () => {
    portfolio.positions.forEach(pos => {
      const { qty } = calcSuggested(pos, portfolio.navUSD, fxRates);
      updateTradeQty(pos.ticker, qty);
    });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <PieChart size={20} className="text-accent" />
            {portfolio.name}
          </h1>
          <p className="text-sm text-muted">Tracking {portfolio.benchmark}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="pill">NAV {fmtUSD(portfolio.navUSD, 'billions')}</span>
          <span className={`pill ${portfolio.currentCashPct > 2 ? 'warn' : 'success'}`}>Cash {fmtPct(portfolio.currentCashPct, 1)}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Globe size={12} />
            Country Allocation
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="card-value">US 60% · Others 40%</span>
            <span className="badge green">
              <CheckCircle2 size={10} />
              Aligned
            </span>
          </div>
          <div className="flex gap-1 flex-wrap">
            <span className="badge">🇺🇸 60%</span><span className="badge">🇯🇵 7%</span><span className="badge">🇬🇧 4.5%</span><span className="badge">🇪🇺 13%</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Building size={12} />
            Top Sectors
          </div>
          <div className="card-value mb-2">Tech, Consumer</div>
          <div className="flex gap-1 flex-wrap">
            <span className="badge">Info Tech</span><span className="badge">Cons. Disc.</span><span className="badge">Financials</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Calendar size={12} />
            Corporate Actions
          </div>
          <div className="card-value">{fmtUSD(25000000, 'millions')}</div>
          <p className="text-xs text-muted mt-1">AAPL, MSFT, NESN dividends credited</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button className="btn btn-sm" onClick={selectAllTickers}>
            <CheckSquare size={12} />
            Select All
          </button>
          <button className="btn btn-sm" onClick={clearSelection} disabled={!hasSelections}>
            <X size={12} />
            Clear
          </button>
          <span className="text-sm text-muted">{selectedTickers.size} selected</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm btn-accent" onClick={applySuggested}>
            <Sparkles size={12} />
            Apply Suggested Qty
          </button>
          <button className="btn btn-sm" onClick={clearAllTradeQty} disabled={!hasTrades}>Clear Trades</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{width:'40px'}}>Sel</th>
              <th>Security</th><th>Sector</th><th>CCY</th>
              <th>Weight</th><th>Index</th><th>Diff</th>
              <th>MV</th><th>Price</th><th>Qty</th>
              <th>Trade Qty</th><th>YTD</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.positions.map(pos => {
              const { qty: suggested, tooltip } = calcSuggested(pos, portfolio.navUSD, fxRates);
              const isSelected = selectedTickers.has(pos.ticker);
              return (
                <tr key={pos.ticker} className={isSelected ? 'selected' : ''}>
                  <td><input type="checkbox" checked={isSelected} onChange={() => toggleTickerSelection(pos.ticker)} /></td>
                  <td>
                    <div className="cell-ticker">{pos.ticker}</div>
                    <div className="cell-subtitle">{pos.name} · {pos.exchange}</div>
                  </td>
                  <td className="text-muted text-xs">{pos.sector}</td>
                  <td>{pos.currency}</td>
                  <td>{fmtPct(pos.weight, 2)}</td>
                  <td className="text-muted">{fmtPct(pos.indexWeight, 2)}</td>
                  <td className={pos.diffBps > 0 ? 'num-positive' : pos.diffBps < 0 ? 'num-negative' : 'num-neutral'}>
                    <span className="flex items-center gap-1">
                      {pos.diffBps > 5 && <TrendingUp size={10} />}
                      {pos.diffBps < -5 && <TrendingDown size={10} />}
                      {fmtBps(pos.diffBps)}
                    </span>
                  </td>
                  <td>{fmtUSD(pos.marketValue, 'compact')}</td>
                  <td>{fmtNum(pos.price, 2)}</td>
                  <td>{fmtQty(pos.quantity)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input type="number" value={pos.tradeQty || ''} onChange={(e) => updateTradeQty(pos.ticker, Number(e.target.value) || 0)} className="input input-sm" style={{ width: '80px' }} placeholder="0" />
                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => updateTradeQty(pos.ticker, suggested)} title={tooltip}>
                        {suggested > 0 ? '+' : ''}{fmtQty(suggested)}
                      </button>
                    </div>
                  </td>
                  <td className={pos.ytdPerformance >= 0 ? 'num-positive' : 'num-negative'}>
                    <span className="flex items-center gap-1">
                      {pos.ytdPerformance >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {fmtPct(pos.ytdPerformance, 1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasSelections && (
        <div className="p-3 rounded-lg flex items-center gap-4 flex-wrap" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
          <span className="font-semibold flex items-center gap-2" style={{ color: 'var(--accent)' }}>
            <CheckSquare size={14} />
            {selectedTickers.size} positions selected
          </span>
          <span className="text-sm text-muted">Active weight sum: {fmtBps(portfolio.positions.filter(p => selectedTickers.has(p.ticker)).reduce((a, p) => a + p.diffBps, 0))} bps</span>
        </div>
      )}

      <p className="text-xs text-muted text-right">Data as of {portfolio.dataAsOf ? new Date(portfolio.dataAsOf).toLocaleString() : '—'}</p>
    </div>
  );
}
