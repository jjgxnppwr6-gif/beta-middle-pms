// ============================================
// Safe Formatters — Never crash on bad input
// ============================================

const PLACEHOLDER = '—';

function safeNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(num)) return null;
  return num;
}

export function fmtNum(value: unknown, decimals = 0): string {
  const num = safeNum(value);
  if (num === null) return PLACEHOLDER;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtUSD(value: unknown, style: 'full' | 'compact' | 'millions' | 'billions' = 'full'): string {
  const num = safeNum(value);
  if (num === null) return PLACEHOLDER;

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  switch (style) {
    case 'compact':
      if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
      if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
      if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
      return `${sign}$${abs.toFixed(0)}`;
    case 'millions':
      return `${sign}$${(abs / 1e6).toFixed(2)}m`;
    case 'billions':
      return `${sign}$${(abs / 1e9).toFixed(2)}bn`;
    default:
      return `${sign}$${fmtNum(abs)}`;
  }
}

export function fmtPct(value: unknown, decimals = 2): string {
  const num = safeNum(value);
  if (num === null) return PLACEHOLDER;
  return `${num.toFixed(decimals)}%`;
}

export function fmtBps(value: unknown, showSign = true): string {
  const num = safeNum(value);
  if (num === null) return PLACEHOLDER;
  const rounded = Math.round(num);
  const sign = showSign && rounded > 0 ? '+' : '';
  return `${sign}${rounded}`;
}

export function fmtSigned(value: unknown, decimals = 0): string {
  const num = safeNum(value);
  if (num === null) return PLACEHOLDER;
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}`;
}

export function fmtSignedUSD(value: unknown, style: 'millions' | 'compact' = 'millions'): string {
  const num = safeNum(value);
  if (num === null) return PLACEHOLDER;
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  const abs = Math.abs(num);

  if (style === 'compact') {
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  return `${sign}$${(abs / 1e6).toFixed(2)}m`;
}

export function fmtFX(currency: string, rate: unknown): string {
  const num = safeNum(rate);
  if (num === null) return PLACEHOLDER;
  if (currency === 'JPY') {
    return `USD/JPY ${(1 / num).toFixed(2)}`;
  }
  return `${currency}/USD ${num.toFixed(4)}`;
}

export function fmtQty(value: unknown, showSign = false): string {
  const num = safeNum(value);
  if (num === null) return PLACEHOLDER;
  const formatted = Math.abs(num).toLocaleString('en-US');
  if (!showSign) return formatted;
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  return `${sign}${formatted}`;
}

export function fmtDateTime(value: unknown): string {
  if (!value) return PLACEHOLDER;
  try {
    const date = new Date(String(value));
    if (isNaN(date.getTime())) return PLACEHOLDER;
    return date.toISOString().slice(0, 16).replace('T', ' ');
  } catch {
    return PLACEHOLDER;
  }
}

export function fmtDate(value: unknown): string {
  if (!value) return PLACEHOLDER;
  try {
    const date = new Date(String(value));
    if (isNaN(date.getTime())) return PLACEHOLDER;
    return date.toISOString().slice(0, 10);
  } catch {
    return PLACEHOLDER;
  }
}

export function fmtTime(value: unknown): string {
  if (!value) return PLACEHOLDER;
  try {
    const date = new Date(String(value));
    if (isNaN(date.getTime())) return PLACEHOLDER;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return PLACEHOLDER;
  }
}

export function fmtConfidence(value: unknown): string {
  const num = safeNum(value);
  if (num === null) return PLACEHOLDER;
  return `${Math.round(num)}%`;
}

export function safeDivide(numerator: unknown, denominator: unknown): number | null {
  const num = safeNum(numerator);
  const den = safeNum(denominator);
  if (num === null || den === null || den === 0) return null;
  return num / den;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Generate unique IDs
export function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
