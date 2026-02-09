'use client';

import { useStore } from '@/app/lib/store';
import { fmtUSD, fmtNum, fmtPct, fmtDate } from '@/app/lib/fmt';
import { exportFXTradesCSV, exportFXTradesJSON, downloadFile } from '@/app/lib/export';
import { getCumulativeCashAtHorizon } from '@/app/lib/calculations';
import type { Currency, FXExecutionType, SettlementHorizon } from '@/app/lib/types';
import { useState } from 'react';
import {
  Droplets,
  DollarSign,
  Percent,
  Clock,
  Calendar,
  Download,
  Zap,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

export default function CashView() {
  const { portfolio, fxRates, fxTrades, effectiveCashBuckets, showPendingFX, toggleShowPendingFX,
    fxModalOpen, fxModalData, openFxModal, closeFxModal, createFxTrade, spotAllToBase } = useStore();

  const [selectedHorizon, setSelectedHorizon] = useState<SettlementHorizon>('T2');
  
  const cashBuckets = showPendingFX && effectiveCashBuckets.length > 0 ? effectiveCashBuckets : portfolio.cashBuckets;
  const totalCashUSD = cashBuckets.reduce((acc, b) => acc + (b.equivUSD || 0), 0);
  const tCashUSD = getCumulativeCashAtHorizon(cashBuckets, 'T', fxRates);
  const horizonCashUSD = getCumulativeCashAtHorizon(cashBuckets, selectedHorizon, fxRates);
  const cashPctNAV = (totalCashUSD / portfolio.navUSD) * 100;
  const pendingFX = fxTrades.filter(t => t.status === 'Pending');

  const handleExport = (format: 'csv' | 'json') => {
    const content = format === 'csv' ? exportFXTradesCSV(fxTrades) : exportFXTradesJSON(fxTrades);
    downloadFile(content, `fx_trades_${new Date().toISOString().slice(0,10)}.${format}`, format === 'csv' ? 'text/csv' : 'application/json');
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Droplets size={20} className="text-accent" />
            Cash & Settlement Ladder
          </h1>
          <p className="text-sm text-muted">Cumulative cash available at each settlement horizon</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="pill">NAV {fmtUSD(portfolio.navUSD, 'billions')}</span>
          <span className={`pill ${cashPctNAV > 2 ? 'warn' : 'success'}`}>Cash {fmtPct(cashPctNAV, 1)}</span>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-4 gap-4">
        <KPITile 
          icon={<DollarSign size={14} />}
          label="Total Cash" 
          value={fmtUSD(totalCashUSD, 'millions')} 
          sublabel="All currencies, USD equiv"
        />
        <KPITile 
          icon={<Percent size={14} />}
          label="Cash % of NAV" 
          value={fmtPct(cashPctNAV, 2)} 
          sublabel={cashPctNAV > 2 ? 'Above target' : 'Within target'}
          sublabelIcon={cashPctNAV > 2 ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
          warn={cashPctNAV > 2}
        />
        <KPITile 
          icon={<Clock size={14} />}
          label="Available Now (T)" 
          value={fmtUSD(tCashUSD, 'millions')} 
          sublabel="Settled cash"
          accent
        />
        <div className="card p-4">
          <div className="text-xs text-muted uppercase tracking-wide mb-1 flex items-center gap-1">
            <TrendingUp size={12} />
            Available at Horizon
          </div>
          <div className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{fmtUSD(horizonCashUSD, 'millions')}</div>
          <div className="toggle-group toggle-group-sm mt-2">
            {(['T', 'T1', 'T2'] as SettlementHorizon[]).map(h => (
              <button 
                key={h} 
                className={`toggle-option ${selectedHorizon === h ? 'active' : ''}`} 
                onClick={() => setSelectedHorizon(h)}
              >
                {h === 'T' ? 'T' : h === 'T1' ? 'T+1' : 'T+2'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {portfolio.corporateActions.length > 0 && (
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Calendar size={12} />
            Recent Corporate Actions
          </div>
          <div className="card-value">{portfolio.corporateActions[0].date} — {fmtUSD(portfolio.corporateActions[0].amountUSD, 'millions')}</div>
          <p className="text-xs text-muted mt-1">{portfolio.corporateActions[0].description}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showPendingFX} onChange={toggleShowPendingFX} />
          <span className="text-sm">Include pending FX ({pendingFX.length})</span>
        </label>
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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Currency</th>
              <th>T (Now)</th>
              <th>T+1</th>
              <th>T+2</th>
              <th>T+3</th>
              <th>T+5</th>
              <th>Equiv USD</th>
            </tr>
          </thead>
          <tbody>
            {cashBuckets.map((bucket) => (
              <tr key={bucket.currency}>
                <td className="font-bold">{bucket.currency}</td>
                <td className="cursor-pointer hover:text-accent transition" onClick={() => openFxModal(bucket.currency, bucket.T, 'T')}>{fmtNum(bucket.T)}</td>
                <td className="cursor-pointer hover:text-accent transition" onClick={() => openFxModal(bucket.currency, bucket.T1, 'T+1')}>{fmtNum(bucket.T1)}</td>
                <td className="cursor-pointer hover:text-accent transition" onClick={() => openFxModal(bucket.currency, bucket.T2, 'T+2')}>{fmtNum(bucket.T2)}</td>
                <td className="cursor-pointer hover:text-accent transition" onClick={() => openFxModal(bucket.currency, bucket.T3, 'T+3')}>{fmtNum(bucket.T3)}</td>
                <td className="cursor-pointer hover:text-accent transition" onClick={() => openFxModal(bucket.currency, bucket.T5, 'T+5')}>{fmtNum(bucket.T5)}</td>
                <td className="font-semibold">{fmtUSD(bucket.equivUSD, 'compact')}</td>
              </tr>
            ))}
            <tr style={{ background: 'var(--panel-soft)' }}>
              <td className="font-bold">Total (USD)</td>
              <td className="font-semibold">{fmtUSD(getCumulativeCashAtHorizon(cashBuckets, 'T', fxRates), 'compact')}</td>
              <td className="font-semibold">{fmtUSD(getCumulativeCashAtHorizon(cashBuckets, 'T1', fxRates), 'compact')}</td>
              <td className="font-semibold">{fmtUSD(getCumulativeCashAtHorizon(cashBuckets, 'T2', fxRates), 'compact')}</td>
              <td colSpan={2}></td>
              <td className="font-bold">{fmtUSD(totalCashUSD, 'compact')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted">Click any cell to open FX ticket. Or consolidate:</p>
        <button className="btn-route" onClick={spotAllToBase}>
          <Zap size={14} />
          Spot All to USD (T+2)
        </button>
      </div>

      {pendingFX.length > 0 && (
        <div className="card">
          <div className="card-title mb-3 flex items-center gap-2">
            <ArrowRightLeft size={12} />
            Pending FX Trades ({pendingFX.length})
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Trade</th><th>Sell</th><th>Buy</th><th>Rate</th><th>Execution</th><th>Settle</th><th>Source</th><th>Status</th></tr></thead>
              <tbody>
                {pendingFX.map(fx => (
                  <tr key={fx.id}>
                    <td className="font-mono text-xs">{fx.id.slice(0,8)}</td>
                    <td className="num-negative">{fmtNum(fx.sellAmt)} {fx.sellCcy}</td>
                    <td className="num-positive">{fmtNum(fx.buyAmt, 0)} {fx.buyCcy}</td>
                    <td className="text-muted">{fx.fxRate.toFixed(4)}</td>
                    <td><span className={`badge ${fx.executionType === 'WMR' ? 'accent' : ''}`}>{fx.executionType || 'SPOT'}</span></td>
                    <td>{fmtDate(fx.settleDate)} ({fx.settlementBucket || 'T2'})</td>
                    <td className="text-muted">{fx.source}</td>
                    <td><span className="badge yellow">{fx.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {fxModalOpen && fxModalData && <FXModal data={fxModalData} rates={fxRates} onClose={closeFxModal} onCreate={createFxTrade} />}
    </div>
  );
}

function KPITile({ icon, label, value, sublabel, sublabelIcon, accent, warn }: { icon?: React.ReactNode; label: string; value: string; sublabel?: string; sublabelIcon?: React.ReactNode; accent?: boolean; warn?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted uppercase tracking-wide mb-1 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-bold ${accent ? 'text-accent' : ''} ${warn ? 'text-yellow' : ''}`}>{value}</div>
      {sublabel && (
        <div className={`text-xs mt-1 flex items-center gap-1 ${warn ? 'text-yellow' : 'text-muted'}`}>
          {sublabelIcon}
          {sublabel}
        </div>
      )}
    </div>
  );
}

function FXModal({ data, rates, onClose, onCreate }: { data: { currency: Currency; amount: number; bucket: string }; rates: any; onClose: () => void; onCreate: (t: any) => void }) {
  const [executionType, setExecutionType] = useState<FXExecutionType>('SPOT');
  const rate = rates[data.currency] || 1;
  const usdAmount = data.amount * rate;
  const today = new Date();
  // Both WMR and SPOT settle T+2
  const settleDate = new Date(today);
  settleDate.setDate(settleDate.getDate() + 2);

  const handleCreate = () => {
    onCreate({
      sellCcy: data.currency,
      buyCcy: 'USD' as Currency,
      sellAmt: data.amount,
      buyAmt: usdAmount,
      fxRate: rate,
      tradeDate: today.toISOString(),
      settleDate: settleDate.toISOString(),
      executionType,
      settlementBucket: 'T2',
      status: 'Pending',
      source: 'Manual',
    });
  };

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">FX Ticket — Sell {data.currency} / Buy USD</div>
        <div className="modal-row"><label>Pair</label><input className="input" value={`${data.currency}/USD`} readOnly /></div>
        <div className="modal-row"><label>Execution Type</label>
          <div className="toggle-group">
            {(['WMR', 'SPOT'] as FXExecutionType[]).map(t => (
              <button key={t} className={`toggle-option ${executionType === t ? 'active' : ''}`} onClick={() => setExecutionType(t)}>
                {t === 'WMR' ? 'WMR (4pm Fix)' : 'SPOT (Market)'}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-row"><label>Settlement</label><input className="input" value={`T+2 (${fmtDate(settleDate)})`} readOnly /></div>
        <div className="modal-row"><label>Amount ({data.currency})</label><input className="input" value={fmtNum(data.amount)} readOnly /></div>
        <div className="modal-row"><label>Indicative Rate</label><input className="input" value={`${rate.toFixed(4)} ${data.currency}/USD`} readOnly /></div>
        <div className="modal-row"><label>Result (USD)</label><input className="input" value={fmtUSD(usdAmount, 'compact')} readOnly /></div>
        <div className="text-xs text-muted mt-2 mb-4">
          {executionType === 'WMR' 
            ? '📊 WMR: Execute at WM/Reuters 4pm London fix. Best for benchmark tracking.' 
            : '⚡ SPOT: Execute at current interbank rate. Best for immediate execution.'}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleCreate}>Create FX Order</button>
        </div>
      </div>
    </div>
  );
}
