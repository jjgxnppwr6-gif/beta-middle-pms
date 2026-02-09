'use client';

import { useStore } from '@/app/lib/store';
import { fmtPct, fmtBps } from '@/app/lib/fmt';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Crosshair,
  Droplets,
  PieChart,
  Award,
} from 'lucide-react';

export default function AnalyticsView() {
  const { portfolio, analytics } = useStore();

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 size={20} className="text-accent" />
            Analytics & Tracking
          </h1>
          <p className="text-sm text-muted">Benchmark: {portfolio.benchmark}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="pill">
            <TrendingUp size={12} />
            Portfolio YTD <strong className="num-positive">+{fmtPct(analytics.portfolioYTD, 2)}</strong>
          </span>
          <span className="pill">Index YTD <strong>+{fmtPct(analytics.indexYTD, 2)}</strong></span>
          <span className="pill accent">
            <Award size={12} />
            Alpha <strong>+{fmtBps(analytics.alpha * 100)} bps</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Target size={12} />
            Tracking Error — Ex-Post
          </div>
          <div className="card-value">{fmtPct(analytics.trackingErrorExPost)}</div>
          <p className="text-xs text-muted mt-1">Realised over recent window</p>
        </div>
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Crosshair size={12} />
            Tracking Error — Ex-Ante
          </div>
          <div className="card-value">{fmtPct(analytics.trackingErrorExAnte)}</div>
          <p className="text-xs text-muted mt-1">Model forecast, current weights</p>
        </div>
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Droplets size={12} />
            Cash Drag
          </div>
          <div className="card-value" style={{ color: 'var(--yellow)' }}>Cash: {fmtPct(portfolio.currentCashPct, 1)}</div>
          <p className="text-xs text-muted mt-1">At +10% market move → ~{Math.round(portfolio.currentCashPct * 10)} bps lag</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title mb-3 flex items-center gap-2">
          <BarChart3 size={12} />
          TE Contributors (Ex-Ante)
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Contributor</th><th>bps</th><th>Comment</th></tr></thead>
            <tbody>
              {analytics.teContributors.map((c, i) => (
                <tr key={i}>
                  <td className="font-medium">{c.source}</td>
                  <td className="num-positive flex items-center gap-1">
                    <TrendingUp size={10} />
                    {c.bps}
                  </td>
                  <td className="text-muted">{c.comment}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--panel-soft)' }}>
                <td className="font-bold">Total (quadrature)</td>
                <td className="font-bold">~{Math.round(Math.sqrt(analytics.teContributors.reduce((a, c) => a + c.bps * c.bps, 0)))}</td>
                <td className="text-muted">≈ {fmtPct(analytics.trackingErrorExAnte)} ex-ante TE</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title mb-3 flex items-center gap-2">
          <PieChart size={12} />
          Performance Attribution
        </div>
        <div className="grid grid-cols-4 gap-3">
          <MetricBox label="Selection" value="+8 bps" positive />
          <MetricBox label="Allocation" value="+3 bps" positive />
          <MetricBox label="Currency" value="-1 bps" negative />
          <MetricBox label="Residual" value="0 bps" />
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="p-3 rounded-lg text-center" style={{ background: 'var(--panel-soft)' }}>
      <div className="text-xs text-muted uppercase tracking-wide mb-1">{label}</div>
      <div className={`font-bold flex items-center justify-center gap-1 ${positive ? 'num-positive' : negative ? 'num-negative' : ''}`}>
        {positive && <TrendingUp size={12} />}
        {negative && <TrendingDown size={12} />}
        {value}
      </div>
    </div>
  );
}
