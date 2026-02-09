'use client';

import { useEffect } from 'react';
import { useStore } from '@/app/lib/store';
import { fmtUSD, fmtPct } from '@/app/lib/fmt';
import type { View, CashProjection } from '@/app/lib/types';
import {
  Building2,
  PieChart,
  Droplets,
  BarChart3,
  Target,
  FileText,
  Moon,
  Sun,
  TrendingUp,
  ArrowRight,
  Clock,
  Send,
  CheckCircle2,
} from 'lucide-react';

const NAV_ITEMS: { id: View; icon: React.ReactNode; label: string }[] = [
  { id: 'middleOffice', icon: <Building2 size={18} />, label: 'Middle Office' },
  { id: 'portfolio', icon: <PieChart size={18} />, label: 'Portfolio' },
  { id: 'cash', icon: <Droplets size={18} />, label: 'Cash & FX' },
  { id: 'analytics', icon: <BarChart3 size={18} />, label: 'Analytics' },
  { id: 'rebalance', icon: <Target size={18} />, label: 'Rebalance' },
  { id: 'oms', icon: <FileText size={18} />, label: 'OMS' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { 
    currentView, setView, portfolio, theme, setTheme, initTheme, 
    reconciliation, baskets, cashProjection, updateCashProjection,
    rebalanceConfig,
  } = useStore();

  useEffect(() => { initTheme(); }, [initTheme]);
  
  // Update cash projection when relevant state changes
  useEffect(() => {
    updateCashProjection();
  }, [portfolio, baskets, rebalanceConfig.settlementHorizon, updateCashProjection]);

  const unresolvedBreaks = reconciliation?.unresolvedCount || 0;
  const pendingOrders = baskets.filter(b => b.status === 'Pending' || b.status === 'PartialFill').length;

  return (
    <div className="min-h-screen p-4">
      <div className="app-shell flex" style={{ minHeight: 'calc(100vh - 32px)' }}>
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: 'radial-gradient(circle at 30% 0, #5eead4, #0ea5e9 60%, #1d2437 90%)', boxShadow: '0 0 18px rgba(45,212,191,.6)' }} />
              <div>
                <div className="font-bold text-sm uppercase tracking-wide">PMS Project</div>
                <div className="text-xs text-muted uppercase" style={{ letterSpacing: '0.12em' }}>Cockpit v2.4</div>
              </div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setView(item.id)} className={`nav-item ${currentView === item.id ? 'active' : ''}`}>
                <span className="nav-item-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.id === 'middleOffice' && unresolvedBreaks > 0 && <span className="nav-badge">{unresolvedBreaks}</span>}
                {item.id === 'oms' && pendingOrders > 0 && <span className="nav-badge" style={{ background: 'var(--blue)' }}>{pendingOrders}</span>}
              </button>
            ))}
          </nav>

          <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition hover:bg-panel-soft" style={{ background: 'var(--panel-soft)' }}>
              {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              <span className="text-xs text-muted">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </aside>

        <div className="main-content">
          <header className="content-header">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="pill"><strong>{portfolio.name}</strong></span>
              <span className="pill">NAV <strong>{fmtUSD(portfolio.navUSD, 'billions')}</strong></span>
            </div>
            
            {/* Cash Status Pills - v2.3 */}
            <CashStatusPills 
              cashProjection={cashProjection} 
              currentCashPct={portfolio.currentCashPct}
              navUSD={portfolio.navUSD}
            />
            
            <div className="flex items-center gap-3" style={{ fontSize: '12px' }}>
              <MarketChip flag="🇫🇷" market="Paris" status="open" />
              <MarketChip flag="🇩🇪" market="Xetra" status="open" />
              <MarketChip flag="🇬🇧" market="LSE" status="closed" />
              <MarketChip flag="🇺🇸" market="NYSE" status="preopen" />
            </div>
          </header>
          <div className="content-body">{children}</div>
          <footer className="px-6 py-3 text-right border-t" style={{ borderColor: 'var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>
            Custodian: BNY Mellon · <span style={{ color: 'var(--green)', fontWeight: 700 }}>Live</span> · Last sync {portfolio.dataAsOf ? new Date(portfolio.dataAsOf).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '09:32'} CET
          </footer>
        </div>
      </div>
    </div>
  );
}

function CashStatusPills({ cashProjection, currentCashPct, navUSD }: { 
  cashProjection: CashProjection | null; 
  currentCashPct: number;
  navUSD: number;
}) {
  // Fallback values when no projection
  const availPct = cashProjection?.availableCashPct ?? currentCashPct;
  const availUSD = cashProjection?.availableCashUSD ?? (currentCashPct / 100) * navUSD;
  const projPct = cashProjection?.projectedCashPct ?? availPct;
  const projUSD = cashProjection?.projectedCashUSD ?? availUSD;
  const status = cashProjection?.status ?? 'current';
  const horizon = cashProjection?.settlementHorizon ?? 'T2';

  const hasPendingActivity = status !== 'current' && Math.abs(availUSD - projUSD) > 1000;
  const isWarning = availPct > 3;
  const projIsWarning = projPct > 3;

  // Status indicator
  const StatusIcon = status === 'routed' ? Send : status === 'pending' ? Clock : status === 'projected' ? TrendingUp : CheckCircle2;
  const statusLabel = status === 'routed' ? 'Routed' : status === 'pending' ? 'Pending' : status === 'projected' ? 'Projected' : 'Current';
  const statusColor = status === 'routed' ? 'var(--blue)' : status === 'pending' ? 'var(--yellow)' : status === 'projected' ? 'var(--accent)' : 'var(--green)';

  return (
    <div className="cash-status-pills">
      {/* Available Cash */}
      <div className={`cash-pill ${isWarning ? 'warn' : ''}`}>
        <div className="cash-pill-label">
          <Droplets size={12} />
          <span>Cash @ {horizon}</span>
        </div>
        <div className="cash-pill-value">
          <strong>{fmtPct(availPct, 1)}</strong>
          <span className="cash-pill-usd">{fmtUSD(availUSD, 'millions')}</span>
        </div>
      </div>

      {/* Arrow indicator if there's pending activity */}
      {hasPendingActivity && (
        <>
          <ArrowRight size={14} className="cash-pill-arrow" style={{ color: statusColor }} />
          
          {/* Projected Cash */}
          <div className={`cash-pill projected ${projIsWarning ? 'warn' : ''}`} style={{ borderColor: statusColor }}>
            <div className="cash-pill-label">
              <StatusIcon size={12} style={{ color: statusColor }} />
              <span style={{ color: statusColor }}>{statusLabel}</span>
            </div>
            <div className="cash-pill-value">
              <strong>{fmtPct(projPct, 1)}</strong>
              <span className="cash-pill-usd">{fmtUSD(projUSD, 'millions')}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MarketChip({ flag, market, status }: { flag: string; market: string; status: 'open' | 'closed' | 'preopen' }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'var(--panel-soft)', border: '1px solid var(--border)' }}>
      <span>{flag}</span>
      <span className="text-muted">{market}</span>
      <span className={`dot ${status}`} />
    </div>
  );
}
