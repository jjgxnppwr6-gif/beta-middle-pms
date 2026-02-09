'use client';

import { useEffect } from 'react';
import { useStore } from '@/app/lib/store';
import { fmtUSD, fmtPct, fmtNum } from '@/app/lib/fmt';
import type { RebalanceMode, SettlementHorizon, FXExecutionType } from '@/app/lib/types';
import {
  Target,
  Zap,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  Settings,
  Clock,
  DollarSign,
  Percent,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Play,
  Send,
} from 'lucide-react';

const MODES: { id: RebalanceMode; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'everything', label: 'Everything', desc: 'Pro-rata to all benchmark weights (buys only)', icon: <Target size={16} /> },
  { id: 'selected', label: 'Selected', desc: 'Only user-selected securities (buys only)', icon: <CheckSquare size={16} /> },
  { id: 'active', label: 'Active >10bps', desc: 'Sell overweights + buy underweights to track index', icon: <Zap size={16} /> },
];

export default function RebalanceView() {
  const { portfolio, rebalanceConfig, setRebalanceConfig, selectedTickers, rebalanceResult, rebalanceConfirmOpen,
    openRebalanceConfirm, closeRebalanceConfirm, confirmRebalance, runScenarios, scenarios, cashProjection } = useStore();

  // Initialize config on mount
  useEffect(() => { setRebalanceConfig({}); }, [setRebalanceConfig]);

  const { availableCash, investableCash, targetCashPct, settlementHorizon, mode, autoFX, fxExecutionType } = rebalanceConfig;
  const currentCashUSD = portfolio.currentCashUSD;
  const targetCashUSD = (targetCashPct / 100) * portfolio.navUSD;
  const teBefore = 0.10;
  const teAfter = investableCash > 0 ? Math.max(0.06, teBefore - (investableCash / portfolio.navUSD) * 0.5) : teBefore;

  const sliderPct = ((targetCashPct) / 5) * 100;

  // Count eligible positions for active mode
  const activeEligibleCount = portfolio.positions.filter(p => Math.abs(p.diffBps) >= 10).length;
  const overweightCount = portfolio.positions.filter(p => p.diffBps >= 10).length;
  const underweightCount = portfolio.positions.filter(p => p.diffBps <= -10).length;
  const modeDisabled = mode === 'selected' && selectedTickers.size === 0;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Target size={20} className="text-accent" />
            Quick Rebalance
          </h1>
          <p className="text-sm text-muted">Deploy excess cash or reduce tracking error. Cash-constrained by settlement horizon.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill">NAV {fmtUSD(portfolio.navUSD, 'billions')}</span>
          <span className={`pill ${portfolio.currentCashPct > 2 ? 'warn' : ''}`}>Cash {fmtPct(portfolio.currentCashPct, 1)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="card">
          <div className="card-title mb-4 flex items-center gap-2">
            <Clock size={14} />
            Settlement Horizon & Cash Target
          </div>

          <div className="mb-5">
            <label className="text-sm text-muted mb-2 block">Settlement Horizon</label>
            <div className="toggle-group w-full">
              {(['T', 'T1', 'T2'] as SettlementHorizon[]).map(h => (
                <button key={h} className={`toggle-option flex-1 ${settlementHorizon === h ? 'active' : ''}`} onClick={() => setRebalanceConfig({ settlementHorizon: h })}>
                  {h === 'T' ? 'T (Today)' : h === 'T1' ? 'T+1' : 'T+2 (Default)'}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted flex items-center gap-1">
                <Percent size={12} />
                Target Cash After Rebalance
              </span>
              <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{fmtPct(targetCashPct, 1)}</span>
            </div>
            <input type="range" min={0} max={5} step={0.5} value={targetCashPct}
              style={{ '--pct': `${sliderPct}%` } as any}
              onChange={(e) => setRebalanceConfig({ targetCashPct: parseFloat(e.target.value) })} className="w-full" />
            <div className="flex justify-between text-xs text-muted mt-1">
              <span>0% (fully invested)</span><span>5% (max cash)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 rounded-lg" style={{ background: 'var(--panel-soft)' }}>
            <Metric icon={<DollarSign size={14} />} label="Available Cash" value={fmtUSD(availableCash, 'millions')} sublabel={`at ${settlementHorizon}`} />
            <Metric icon={<Target size={14} />} label="Target Cash" value={fmtUSD(targetCashUSD, 'millions')} />
            <Metric icon={<TrendingUp size={14} />} label="Investable Cash" value={fmtUSD(investableCash, 'millions')} accent sublabel="= Available − Target" />
            <Metric icon={<RefreshCw size={14} />} label="TE Impact" value={`${fmtPct(teBefore)} → ${fmtPct(teAfter)}`} sublabel="ex-ante" />
          </div>

          {/* Live Cash Projection */}
          {cashProjection && (cashProjection.pendingEquityBuysUSD > 0 || cashProjection.pendingEquitySellsUSD > 0) && (
            <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
              <div className="text-xs text-muted uppercase tracking-wide mb-2 flex items-center gap-1">
                <Sparkles size={12} style={{ color: 'var(--accent)' }} />
                Live Cash Projection
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-xs text-muted">Current</div>
                  <div className="font-bold">{fmtPct(cashProjection.availableCashPct, 1)}</div>
                </div>
                <ArrowRight size={16} style={{ color: 'var(--accent)' }} />
                <div className="flex-1">
                  <div className="text-xs text-muted">After Orders</div>
                  <div className="font-bold" style={{ color: 'var(--accent)' }}>{fmtPct(cashProjection.projectedCashPct, 1)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title mb-4 flex items-center gap-2">
            <Settings size={14} />
            Rebalance Mode
          </div>

          <div className="space-y-3 mb-5">
            {MODES.map(m => (
              <button key={m.id} onClick={() => setRebalanceConfig({ mode: m.id })}
                disabled={m.id === 'selected' && selectedTickers.size === 0}
                className={`w-full p-4 rounded-lg text-left transition ${mode === m.id ? 'ring-2' : ''}`}
                style={{ background: mode === m.id ? 'var(--accent-soft)' : 'var(--panel-soft)', borderColor: 'var(--accent)', opacity: m.id === 'selected' && selectedTickers.size === 0 ? 0.5 : 1 }}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-2">
                    <span className={mode === m.id ? 'text-accent' : 'text-muted'}>{m.icon}</span>
                    {m.label}
                  </span>
                  {m.id === 'selected' && <span className="text-xs text-muted">({selectedTickers.size} selected)</span>}
                  {m.id === 'active' && <span className="text-xs text-muted">({activeEligibleCount} eligible: {overweightCount}↑ {underweightCount}↓)</span>}
                </div>
                <p className="text-xs text-muted mt-1">{m.desc}</p>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-lg" style={{ background: 'var(--panel-soft)' }}>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" checked={autoFX} onChange={(e) => setRebalanceConfig({ autoFX: e.target.checked })} />
              <span className="text-sm font-medium flex items-center gap-1">
                <ArrowRightLeft size={14} />
                Auto-generate FX for non-USD flows
              </span>
            </label>
            {autoFX && (
              <div>
                <div className="text-xs text-muted mb-2">FX Execution Type</div>
                <div className="toggle-group">
                  {(['WMR', 'SPOT'] as FXExecutionType[]).map(t => (
                    <button key={t} className={`toggle-option ${fxExecutionType === t ? 'active' : ''}`} onClick={() => setRebalanceConfig({ fxExecutionType: t })}>
                      {t === 'WMR' ? 'WMR (4pm Fix)' : 'SPOT (Market)'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted mt-2">
                  {fxExecutionType === 'WMR' 
                    ? 'Benchmark fix for passive/index tracking' 
                    : 'Live interbank rate for immediate execution'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted">
          {modeDisabled && (
            <span className="text-yellow flex items-center gap-1">
              <AlertTriangle size={14} />
              Select securities in Portfolio tab first
            </span>
          )}
          {mode === 'active' && activeEligibleCount === 0 && (
            <span className="text-yellow flex items-center gap-1">
              <AlertTriangle size={14} />
              No positions with |active weight| ≥ 10bps
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button className="btn" onClick={runScenarios}>
            <Play size={14} />
            Run Checks
          </button>
          <button className="btn-route" onClick={openRebalanceConfirm} disabled={investableCash < 1000 || modeDisabled || (mode === 'active' && activeEligibleCount === 0)}>
            <Target size={14} />
            Generate Rebalance Orders
          </button>
        </div>
      </div>

      {scenarios.length > 0 && (
        <div className="card">
          <div className="card-title mb-3 flex items-center gap-2">
            <Sparkles size={14} />
            Demo Scenario Checks
          </div>
          <div className="grid grid-cols-3 gap-3">
            {scenarios.map(s => (
              <div key={s.id} className="p-3 rounded-lg" style={{ background: 'var(--panel-soft)', border: `1px solid ${s.overallStatus === 'passed' ? 'var(--green)' : s.overallStatus === 'failed' ? 'var(--red)' : 'var(--border)'}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{s.name}</span>
                  <span className={`badge ${s.overallStatus === 'passed' ? 'green' : s.overallStatus === 'failed' ? 'red' : ''}`}>
                    {s.overallStatus === 'passed' ? <CheckCircle2 size={10} /> : s.overallStatus === 'failed' ? <XCircle size={10} /> : '—'}
                  </span>
                </div>
                <div className="space-y-1">
                  {s.checks.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={c.status === 'passed' ? 'text-green' : c.status === 'failed' ? 'text-red' : 'text-muted'}>
                        {c.status === 'passed' ? <CheckCircle2 size={10} /> : c.status === 'failed' ? <XCircle size={10} /> : '○'}
                      </span>
                      <span className="text-muted">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rebalanceConfirmOpen && rebalanceResult && (
        <div className="modal-backdrop open" onClick={closeRebalanceConfirm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title flex items-center gap-2">
              <Target size={18} style={{ color: 'var(--accent)' }} />
              Confirm Rebalance
            </div>

            {rebalanceResult.allocations.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle size={48} className="mx-auto mb-3 text-yellow" strokeWidth={1.5} />
                <p className="font-semibold text-yellow">No eligible securities</p>
                <p className="text-sm text-muted">{rebalanceResult.summary.topReasons[0]}</p>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-4">
                  {/* Summary for active mode (buys + sells) */}
                  {rebalanceResult.totalSold > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-lg" style={{ background: 'var(--red-soft)', border: '1px solid var(--red)' }}>
                        <div className="text-xs text-muted uppercase tracking-wide flex items-center gap-1">
                          <TrendingDown size={12} />
                          Total Sells
                        </div>
                        <div className="text-xl font-bold text-red">{fmtUSD(rebalanceResult.totalSold, 'millions')}</div>
                        <div className="text-xs text-muted">{rebalanceResult.allocations.filter(a => a.side === 'Sell').length} orders</div>
                      </div>
                      <div className="p-4 rounded-lg" style={{ background: 'var(--green-soft)', border: '1px solid var(--green)' }}>
                        <div className="text-xs text-muted uppercase tracking-wide flex items-center gap-1">
                          <TrendingUp size={12} />
                          Total Buys
                        </div>
                        <div className="text-xl font-bold text-green">{fmtUSD(rebalanceResult.totalInvested, 'millions')}</div>
                        <div className="text-xs text-muted">{rebalanceResult.allocations.filter(a => a.side === 'Buy').length} orders</div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg" style={{ background: 'var(--accent-soft)', border: '2px solid var(--accent)' }}>
                      <div className="text-xs text-muted uppercase tracking-wide flex items-center gap-1">
                        <TrendingUp size={12} />
                        Total Investment
                      </div>
                      <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{fmtUSD(rebalanceResult.totalInvested, 'millions')}</div>
                      <div className="text-sm text-muted mt-1">{rebalanceResult.summary.ordersCount} equity orders · {rebalanceResult.summary.fxOrdersCount} FX orders</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="Cash Before" value={fmtUSD(rebalanceResult.summary.cashBefore, 'millions')} />
                    <Metric label="Cash After" value={fmtUSD(rebalanceResult.summary.cashAfter, 'millions')} accent />
                    <Metric label="TE Before" value={fmtPct(teBefore)} />
                    <Metric label="TE After" value={fmtPct(teAfter)} accent />
                  </div>

                  <div className="p-3 rounded-lg" style={{ background: 'var(--panel-soft)' }}>
                    <div className="text-xs text-muted uppercase tracking-wide mb-2">Why This Basket</div>
                    {rebalanceResult.summary.topReasons.map((r, i) => <p key={i} className="text-sm">• {r}</p>)}
                  </div>

                  <div className="p-3 rounded-lg" style={{ background: 'var(--panel-soft)' }}>
                    <div className="text-xs text-muted uppercase tracking-wide mb-2">Largest Orders</div>
                    <div className="flex gap-2 flex-wrap">
                      {rebalanceResult.summary.largestAllocations.map((a, i) => <span key={i} className="badge">{a}</span>)}
                    </div>
                  </div>

                  {rebalanceResult.skipped.length > 0 && (
                    <div className="p-3 rounded-lg" style={{ background: 'var(--yellow-soft)', border: '1px solid var(--yellow)' }}>
                      <div className="text-xs text-muted uppercase tracking-wide mb-2 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Skipped ({rebalanceResult.skipped.length})
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {rebalanceResult.skipped.slice(0, 5).map((s, i) => <span key={i} className="text-xs text-muted">{s.ticker}: {s.reason}</span>)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-actions">
                  <button className="btn" onClick={closeRebalanceConfirm}>Cancel</button>
                  <button className="btn-primary" onClick={confirmRebalance}>
                    <CheckCircle2 size={14} />
                    Confirm & Create Orders
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value, sublabel, accent }: { icon?: React.ReactNode; label: string; value: string; sublabel?: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted uppercase tracking-wide flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`font-bold ${accent ? 'text-accent' : ''}`}>{value}</div>
      {sublabel && <div className="text-xs text-muted">{sublabel}</div>}
    </div>
  );
}
