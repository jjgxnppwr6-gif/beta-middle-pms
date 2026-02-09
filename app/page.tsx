'use client';

import { useEffect } from 'react';
import AppLayout from './components/layout/AppLayout';
import MiddleOfficeView from './components/views/MiddleOfficeView';
import PortfolioView from './components/views/PortfolioView';
import CashView from './components/views/CashView';
import AnalyticsView from './components/views/AnalyticsView';
import RebalanceView from './components/views/RebalanceView';
import OMSView from './components/views/OMSView';
import { useStore } from './lib/store';

export default function Home() {
  const { currentView, portfolio, initTheme } = useStore();

  useEffect(() => { initTheme(); }, [initTheme]);

  useEffect(() => {
    async function loadInitialData() {
      if (portfolio.positions.length > 0) return;
      try {
        const res = await fetch('/data/portfolio.json');
        const data = await res.json();
        useStore.setState((s) => ({
          portfolio: { ...data, positions: data.positions.map((p: any) => ({ ...p, tradeQty: 0, suggestedQty: 0, baseMV: p.marketValue, tradable: true, restricted: false })), dataAsOf: new Date().toISOString() },
          effectiveCashBuckets: data.cashBuckets,
        }));
        // Initialize rebalance config with correct cash values
        useStore.getState().setRebalanceConfig({});
      } catch (e) { console.error('Failed to load portfolio:', e); }
    }
    loadInitialData();
  }, [portfolio.positions.length]);

  return (
    <AppLayout>
      {currentView === 'middleOffice' && <MiddleOfficeView />}
      {currentView === 'portfolio' && <PortfolioView />}
      {currentView === 'cash' && <CashView />}
      {currentView === 'analytics' && <AnalyticsView />}
      {currentView === 'rebalance' && <RebalanceView />}
      {currentView === 'oms' && <OMSView />}
    </AppLayout>
  );
}
