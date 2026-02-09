import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PMS Cockpit v2.1 — MSCI World',
  description: 'Portfolio Management System — Middle Office Reconciliation & Rebalance',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('pms-theme');var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;var r=t||(d?'dark':'light');document.documentElement.classList.toggle('light-theme',r==='light');document.documentElement.dataset.theme=r}catch(e){}})();` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
