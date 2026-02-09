'use client';

import { useStore } from '@/app/lib/store';
import { fmtUSD, fmtPct, fmtNum, fmtDateTime } from '@/app/lib/fmt';
import { exportBasketsCSV, exportBasketsJSON, downloadFile } from '@/app/lib/export';
import type { Basket, Order, OrderStatus } from '@/app/lib/types';
import {
  Send,
  Sparkles,
  XCircle,
  Download,
  Inbox,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  FileText,
} from 'lucide-react';

const STATUS_COLORS: Record<OrderStatus, string> = { Pending: 'yellow', Routed: 'blue', PartialFill: 'accent', Filled: 'green', Cancelled: 'red' };
const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  Pending: <Clock size={10} />,
  Routed: <Send size={10} />,
  PartialFill: <TrendingUp size={10} />,
  Filled: <CheckCircle2 size={10} />,
  Cancelled: <XCircle size={10} />,
};

export default function OMSView() {
  const { baskets, toggleBasketExpand, toggleDoNotTrade, routeBaskets, cancelBaskets } = useStore();

  const equityBaskets = baskets.filter(b => b.type === 'Equity');
  const fxBaskets = baskets.filter(b => b.type === 'FX');
  const totalNotional = baskets.reduce((acc, b) => acc + b.totalNotionalUSD, 0);
  const pendingCount = baskets.filter(b => b.status === 'Pending').length;

  const handleExport = (format: 'csv' | 'json') => {
    const content = format === 'csv' ? exportBasketsCSV(baskets) : exportBasketsJSON(baskets);
    downloadFile(content, `orders_${new Date().toISOString().slice(0,10)}.${format}`, format === 'csv' ? 'text/csv' : 'application/json');
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText size={20} className="text-accent" />
            Order Management System
          </h1>
          <p className="text-sm text-muted">Equity & FX baskets from Rebalance and FX tickets</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && <span className="pill warn">{pendingCount} pending</span>}
          <span className="pill">Total {fmtUSD(totalNotional, 'millions')}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button className="btn-route" onClick={routeBaskets} disabled={pendingCount === 0}>
            <Send size={14} />
            Route to Broker
          </button>
          <button className="btn-accent" onClick={() => alert('AI: Close-heavy schedule recommended.\n• 30-40% passive intraday via TWAP\n• 60-80% at MOC\n• FX at WMR 4pm London fix')}>
            <Sparkles size={14} />
            Ask AI
          </button>
          <button className="btn-danger" onClick={cancelBaskets} disabled={pendingCount === 0}>
            <XCircle size={14} />
            Cancel All
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm" onClick={() => handleExport('csv')}>
            <Download size={12} />
            CSV
          </button>
          <button className="btn btn-sm" onClick={() => handleExport('json')}>
            <Download size={12} />
            JSON
          </button>
        </div>
      </div>

      {baskets.length === 0 ? (
        <div className="card text-center py-16">
          <Inbox size={56} className="mx-auto mb-3 opacity-30" strokeWidth={1} />
          <p className="font-semibold text-lg mb-1">No orders yet</p>
          <p className="text-sm text-muted">Use Rebalance or Cash tabs to generate orders</p>
        </div>
      ) : (
        <div className="space-y-4">
          {equityBaskets.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2 flex items-center gap-2">
                <TrendingUp size={12} />
                Equity Baskets ({equityBaskets.length})
              </h3>
              {equityBaskets.map(basket => <BasketCard key={basket.id} basket={basket} onToggle={() => toggleBasketExpand(basket.id)} onToggleDNT={toggleDoNotTrade} />)}
            </div>
          )}
          {fxBaskets.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2 flex items-center gap-2">
                <ArrowRightLeft size={12} />
                FX Baskets ({fxBaskets.length})
              </h3>
              {fxBaskets.map(basket => <BasketCard key={basket.id} basket={basket} onToggle={() => toggleBasketExpand(basket.id)} onToggleDNT={toggleDoNotTrade} />)}
            </div>
          )}
        </div>
      )}

      {baskets.length > 0 && (
        <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'var(--panel-soft)' }}>
          <span className="text-sm text-muted">Total Notional</span>
          <span className="text-lg font-bold">{fmtUSD(totalNotional, 'millions')}</span>
        </div>
      )}
    </div>
  );
}

function BasketCard({ basket, onToggle, onToggleDNT }: { basket: Basket; onToggle: () => void; onToggleDNT: (bid: string, oid: string) => void }) {
  return (
    <div className="card mb-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <span className="text-muted">
            {basket.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </span>
          <div>
            <div className="font-semibold">{basket.name}</div>
            <div className="text-xs text-muted">{fmtDateTime(basket.timestamp)} · {basket.orders.length} orders</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-bold">{fmtUSD(basket.totalNotionalUSD, 'millions')}</span>
          <span className={`badge ${STATUS_COLORS[basket.status]}`}>
            {STATUS_ICONS[basket.status]}
            {basket.status}
          </span>
          {basket.fillPct > 0 && (
            <div style={{ width: '100px' }}>
              <div className="progress-bar"><div className="progress-inner" style={{ width: `${basket.fillPct}%` }} /></div>
              <div className="text-xs text-muted text-center mt-1">{basket.fillPct}% filled</div>
            </div>
          )}
        </div>
      </div>

      {basket.expanded && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted uppercase">
                <th className="text-left py-2">#</th>
                <th className="text-left py-2">Order</th>
                <th className="text-left py-2">Side</th>
                <th className="text-left py-2">CCY</th>
                <th className="text-right py-2">Notional</th>
                <th className="text-right py-2">%</th>
                {basket.type === 'Equity' && <th className="text-right py-2">ADV%</th>}
                {basket.type === 'FX' && <th className="text-right py-2">Mid</th>}
                <th className="text-center py-2">Status</th>
                <th className="text-center py-2">DNT</th>
              </tr>
            </thead>
            <tbody>
              {basket.orders.map((order, idx) => (
                <tr key={order.id} className={order.doNotTrade ? 'opacity-40' : ''}>
                  <td className="py-2 text-muted">{idx + 1}</td>
                  <td className="py-2 font-medium">{order.ticker}</td>
                  <td className="py-2">
                    <span className={`flex items-center gap-1 ${order.side === 'Buy' ? 'num-positive' : 'num-negative'}`}>
                      {order.side === 'Buy' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {order.side}
                    </span>
                  </td>
                  <td className="py-2">{order.currency}</td>
                  <td className="py-2 text-right">{fmtUSD(order.notionalUSD, 'compact')}</td>
                  <td className="py-2 text-right text-muted">{fmtPct(order.pctOfBasket, 1)}</td>
                  {basket.type === 'Equity' && <td className="py-2 text-right text-muted">{fmtPct(order.advPct, 1)}</td>}
                  {basket.type === 'FX' && <td className="py-2 text-right text-muted">{order.fxMid || '—'}</td>}
                  <td className="py-2 text-center">
                    <span className={`badge ${STATUS_COLORS[order.status]}`}>
                      {STATUS_ICONS[order.status]}
                      {order.status}
                    </span>
                  </td>
                  <td className="py-2 text-center">
                    <input type="checkbox" checked={order.doNotTrade || false} onChange={() => onToggleDNT(basket.id, order.id)} disabled={order.status !== 'Pending'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
