'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/app/lib/store';
import {
  fmtUSD,
  fmtBps,
  fmtDateTime,
  fmtConfidence,
  fmtNum,
  fmtSignedUSD,
} from '@/app/lib/fmt';
import type {
  BreakCause,
  BreakResolution,
  BreakStatus,
  CashBreak,
  MOState,
  MOStep,
  NAVBridgeItem,
  PositionBreak,
} from '@/app/lib/types';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  Sparkles,
  FileText,
  X,
  User,
  ClipboardCheck,
  Tag,
  Info,
  ArrowRight,
} from 'lucide-react';

const CAUSE_OPTIONS: BreakCause[] = [
  'Settlement timing',
  'Missing trade',
  'Price discrepancy',
  'FX missing/incorrect',
  'Corporate action',
  'Fees & taxes',
  'Missing position',
  'Data mapping issue',
  'Unknown',
];

export default function MiddleOfficeView() {
  const {
    moState,
    portfolio,
    custodianPositions,
    custodianCashUSD,
    reconciliation,
    selectedBreakId,
    breakTolerance,
    shadowNAVCard,
    loadSampleData,
    runReconciliation,
    selectBreak,
    resolveBreak,
    updateBreakOwner,
    updateBreakStatus,
    updateBreakNotes,
    overrideBreakCause,
    pushToPMS,
    resetMO,
    updateShadowNAVCard,
  } = useStore();

  // Auto-compute Shadow NAV card once we reach Step 4 (NAV)
  useEffect(() => {
    if (moState.currentStep === 'nav' && portfolio.positions.length > 0) {
      updateShadowNAVCard();
    }
  }, [moState.currentStep, portfolio.positions.length, updateShadowNAVCard]);

  const steps = useMemo(
    () =>
      [
        {
          key: 'ingest' as MOStep,
          label: 'Ingest Custodian File',
          icon: <Upload size={14} />,
          complete: moState.fileUploaded,
        },
        {
          key: 'normalize' as MOStep,
          label: 'Normalize & Map',
          icon: <ClipboardCheck size={14} />,
          complete: moState.normalized,
        },
        {
          key: 'reconcile' as MOStep,
          label: 'Reconcile Breaks',
          icon: <CheckCircle2 size={14} />,
          complete: moState.reconciled,
        },
        {
          key: 'nav' as MOStep,
          label: 'Shadow NAV Card',
          icon: <Calculator size={14} />,
          complete: moState.currentStep === 'nav' && !!shadowNAVCard,
        },
      ],
    [moState.fileUploaded, moState.normalized, moState.reconciled, moState.currentStep, shadowNAVCard]
  );

  const allBreaks = useMemo(() => {
    const pos = (reconciliation?.positionBreaks || []).map((b) => ({ kind: 'position' as const, id: b.id, brk: b }));
    const cash = (reconciliation?.cashBreaks || []).map((b) => ({ kind: 'cash' as const, id: b.id, brk: b }));
    return [...pos, ...cash].sort((a, b) => Math.abs(b.brk.deltaUSD) - Math.abs(a.brk.deltaUSD));
  }, [reconciliation]);

  const selected = useMemo(() => {
    if (!selectedBreakId || !reconciliation) return null;
    const pos = reconciliation.positionBreaks.find((b) => b.id === selectedBreakId);
    if (pos) return { kind: 'position' as const, brk: pos };
    const cash = reconciliation.cashBreaks.find((b) => b.id === selectedBreakId);
    if (cash) return { kind: 'cash' as const, brk: cash };
    return null;
  }, [selectedBreakId, reconciliation]);

  const statusBadge = reconciliation?.status === 'aligned'
    ? { cls: 'green', label: 'Aligned' }
    : reconciliation?.status === 'critical'
      ? { cls: 'red', label: 'Critical' }
      : reconciliation
        ? { cls: 'yellow', label: 'Investigate' }
        : { cls: '', label: 'Not run' };

  return (
    <>
      <div className="space-y-5 animate-fadeIn">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileText size={20} className="text-accent" />
              Middle Office — Reconciliation
            </h1>
            <p className="text-sm text-muted">
              Custodian ingest → normalization → break resolution → shadow NAV validation
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="pill">Tolerance <strong>{fmtUSD(breakTolerance.absoluteUSD, 'compact')}</strong> / <strong>{fmtBps(breakTolerance.relativeBps)}</strong> bps</span>
            {reconciliation && (
              <span className={`pill ${reconciliation.status === 'aligned' ? 'success' : reconciliation.status === 'critical' ? 'error' : 'warn'}`}>
                {statusBadge.label} • Δ {fmtBps(reconciliation.deltaBps)} bps
              </span>
            )}
          </div>
        </div>

        {/* Step Indicator */}
        <div className="card">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="step-indicator">
              {steps.map((s, idx) => {
                const active = moState.currentStep === s.key;
                const complete = s.complete;
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className={`step ${complete ? 'complete' : active ? 'active' : ''}`} title={s.label}>
                      {complete ? <CheckCircle2 size={16} /> : idx + 1}
                    </div>
                    {idx < steps.length - 1 && <div className={`step-line ${steps[idx].complete ? 'complete' : ''}`} />}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button className="btn btn-sm btn-accent" onClick={loadSampleData}>
                <Upload size={12} />
                Load demo custodian file
              </button>
              <button className="btn btn-sm" onClick={runReconciliation} disabled={custodianPositions.length === 0 || portfolio.positions.length === 0}>
                <Sparkles size={12} />
                Run reconciliation
              </button>
              <button className="btn btn-sm btn-danger" onClick={resetMO}>
                <X size={12} />
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-4">
            <StepCard
              title="Step 1"
              icon={<Upload size={12} />}
              label="Ingest"
              active={moState.currentStep === 'ingest'}
              complete={moState.fileUploaded}
            >
              <DetailRow label="File">
                <span className="text-sm font-semibold">{moState.filename || '—'}</span>
              </DetailRow>
              <DetailRow label="Uploaded">
                <span className="text-sm text-muted">{fmtDateTime(moState.uploadTimestamp)}</span>
              </DetailRow>
              <DetailRow label="Custodian positions">
                <span className="text-sm font-semibold">{custodianPositions.length.toLocaleString('en-US')}</span>
              </DetailRow>
              <DetailRow label="Custodian cash">
                <span className="text-sm font-semibold">{fmtUSD(custodianCashUSD, 'millions')}</span>
              </DetailRow>
            </StepCard>

            <StepCard
              title="Step 2"
              icon={<ClipboardCheck size={12} />}
              label="Normalize"
              active={moState.currentStep === 'normalize'}
              complete={moState.normalized}
            >
              <DetailRow label="Schema">
                <span className="badge accent"><Tag size={10} /> Internal v0.1</span>
              </DetailRow>
              <DetailRow label="Mapping">
                <span className="text-sm text-muted">BNYM → unified positions + cash ladder</span>
              </DetailRow>
              <DetailRow label="Internal positions">
                <span className="text-sm font-semibold">{portfolio.positions.length.toLocaleString('en-US')}</span>
              </DetailRow>
              <DetailRow label="As of">
                <span className="text-sm text-muted">{fmtDateTime(portfolio.dataAsOf)}</span>
              </DetailRow>
            </StepCard>

            <StepCard
              title="Step 3"
              icon={<CheckCircle2 size={12} />}
              label="Reconcile"
              active={moState.currentStep === 'reconcile'}
              complete={moState.reconciled}
            >
              <DetailRow label="Status">
                <span className={`badge ${statusBadge.cls}`}>{statusBadge.label}</span>
              </DetailRow>
              <DetailRow label="Shadow NAV (custodian)">
                <span className="text-sm font-semibold">{fmtUSD(reconciliation?.shadowNAV, 'billions')}</span>
              </DetailRow>
              <DetailRow label="Official NAV">
                <span className="text-sm font-semibold">{fmtUSD(reconciliation?.officialNAV, 'billions')}</span>
              </DetailRow>
              <DetailRow label="Δ vs official">
                <span className={`text-sm font-semibold ${reconciliation && Math.abs(reconciliation.deltaBps) > 10 ? 'text-yellow' : 'text-accent'}`}>{fmtSignedUSD(reconciliation?.delta, 'compact')} ({fmtBps(reconciliation?.deltaBps)} bps)</span>
              </DetailRow>
              <DetailRow label="Unresolved">
                <span className={`badge ${reconciliation && reconciliation.unresolvedCount > 0 ? 'yellow' : 'green'}`}>{reconciliation?.unresolvedCount ?? 0}</span>
              </DetailRow>
            </StepCard>

            <StepCard
              title="Step 4"
              icon={<Calculator size={12} />}
              label="Shadow NAV"
              active={moState.currentStep === 'nav'}
              complete={!!shadowNAVCard}
            >
              <DetailRow label="Compute">
                <button className="btn btn-sm" onClick={updateShadowNAVCard} disabled={portfolio.positions.length === 0}>
                  <Calculator size={12} />
                  Refresh
                </button>
              </DetailRow>
              <DetailRow label="Admin NAV">
                <span className="text-sm font-semibold">{fmtUSD(shadowNAVCard?.adminNAV, 'billions')}</span>
              </DetailRow>
              <DetailRow label="Shadow NAV">
                <span className="text-sm font-semibold">{fmtUSD(shadowNAVCard?.shadowNAV, 'billions')}</span>
              </DetailRow>
              <DetailRow label="Δ vs admin">
                <span className={`text-sm font-semibold ${shadowNAVCard && Math.abs(shadowNAVCard.deltaBps) > 10 ? 'text-yellow' : 'text-accent'}`}>{fmtSignedUSD(shadowNAVCard?.deltaUSD, 'compact')} ({fmtBps(shadowNAVCard?.deltaBps)} bps)</span>
              </DetailRow>
              <DetailRow label="Action">
                <button className="btn btn-sm btn-primary" onClick={pushToPMS} disabled={!reconciliation || reconciliation.unresolvedCount > 0}>
                  Push to PMS <ArrowRight size={12} />
                </button>
              </DetailRow>
            </StepCard>
          </div>
        </div>

        {/* Breaks Table */}
        <div className="card">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="card-title flex items-center gap-2">
                <AlertTriangle size={12} />
                Breaks & Exceptions
              </div>
              <div className="text-sm text-muted">Click a row to open the resolution panel.</div>
            </div>
            {reconciliation && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="pill">Position breaks <strong>{reconciliation.positionBreaks.length}</strong></span>
                <span className="pill">Cash breaks <strong>{reconciliation.cashBreaks.length}</strong></span>
              </div>
            )}
          </div>

          <div className="table-wrap mt-3">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Ticker / CCY</th>
                  <th>Break</th>
                  <th>Δ USD</th>
                  <th>Cause</th>
                  <th>Conf</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Resolution</th>
                </tr>
              </thead>
              <tbody>
                {allBreaks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-muted">
                      {custodianPositions.length === 0
                        ? 'Load demo data to generate breaks.'
                        : 'No breaks above tolerance.'}
                    </td>
                  </tr>
                ) : (
                  allBreaks.map((row) => {
                    const brk: any = row.brk;
                    const cause = brk.overriddenCause || brk.causeAnalysis?.cause || 'Unknown';
                    const conf = brk.causeAnalysis?.confidence;
                    const selectedRow = selectedBreakId === row.id;
                    return (
                      <tr key={row.id} className={selectedRow ? 'selected' : ''} onClick={() => selectBreak(row.id)} style={{ cursor: 'pointer' }}>
                        <td>
                          <span className={`badge ${row.kind === 'cash' ? 'blue' : ''}`}>{row.kind === 'cash' ? 'Cash' : 'Position'}</span>
                        </td>
                        <td className="cell-ticker">
                          {row.kind === 'cash' ? (row.brk as CashBreak).currency : (row.brk as PositionBreak).ticker}
                        </td>
                        <td className="text-muted">{row.kind === 'cash' ? 'Cash' : (row.brk as PositionBreak).type}</td>
                        <td className={`${brk.deltaUSD >= 0 ? 'num-positive' : 'num-negative'}`}>{fmtSignedUSD(brk.deltaUSD, 'compact')}</td>
                        <td className="text-muted">{cause}</td>
                        <td className="text-muted">{conf !== undefined ? fmtConfidence(conf) : '—'}</td>
                        <td>
                          <span className={`badge ${brk.status === 'Resolved' ? 'green' : brk.status === 'In Progress' ? 'blue' : 'yellow'}`}>{brk.status}</span>
                        </td>
                        <td className="text-muted">{brk.owner || '—'}</td>
                        <td>
                          <span className={`badge ${brk.resolution === 'unresolved' ? 'yellow' : 'green'}`}>{brk.resolution}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shadow NAV Card */}
        {shadowNAVCard && (
          <div className="grid grid-cols-3 gap-4">
            <div className="card">
              <div className="card-title">Shadow NAV</div>
              <div className="card-value">{fmtUSD(shadowNAVCard.shadowNAV, 'billions')}</div>
              <p className="text-xs text-muted mt-2 flex items-center gap-1"><Info size={12} /> As of {fmtDateTime(shadowNAVCard.asOfTimestamp)}</p>
            </div>
            <div className="card">
              <div className="card-title">Admin NAV</div>
              <div className="card-value">{fmtUSD(shadowNAVCard.adminNAV, 'billions')}</div>
              <p className="text-xs text-muted mt-2">As of {fmtDateTime(shadowNAVCard.adminNAVAsOf)}</p>
            </div>
            <div className="card">
              <div className="card-title">Delta</div>
              <div className={`card-value ${Math.abs(shadowNAVCard.deltaBps) > 10 ? 'text-yellow' : 'text-accent'}`}>
                {fmtSignedUSD(shadowNAVCard.deltaUSD, 'compact')} ({fmtBps(shadowNAVCard.deltaBps)} bps)
              </div>
              <p className="text-xs text-muted mt-2">Daily accrual: {fmtSignedUSD(-shadowNAVCard.dailyAccrual, 'compact')} @ {fmtNum(shadowNAVCard.managementFeeBps)} bps</p>
            </div>

            <div className="card col-span-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="card-title flex items-center gap-2">
                    <Calculator size={12} />
                    NAV Bridge
                  </div>
                  <div className="text-sm text-muted">Attribution of delta vs admin NAV (simplified).</div>
                </div>
                <span className="pill accent">FX mode: <strong>{shadowNAVCard.fxMode}</strong></span>
              </div>

              <div className="table-wrap mt-3">
                <table>
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>USD</th>
                      <th>bps</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shadowNAVCard.bridge.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-muted">No bridge items (delta within noise).</td>
                      </tr>
                    ) : (
                      shadowNAVCard.bridge.map((it: NAVBridgeItem) => (
                        <tr key={it.label}>
                          <td className="font-semibold">{it.label}</td>
                          <td className={`${it.valueUSD >= 0 ? 'num-positive' : 'num-negative'}`}>{fmtSignedUSD(it.valueUSD, 'compact')}</td>
                          <td className="text-muted">{fmtBps(it.valueBps)}</td>
                          <td className="text-muted">{it.description || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Break Side Panel */}
      <BreakPanel
        open={!!selected}
        onClose={() => selectBreak(null)}
        selected={selected}
        onResolve={resolveBreak}
        onUpdateOwner={updateBreakOwner}
        onUpdateStatus={updateBreakStatus}
        onUpdateNotes={updateBreakNotes}
        onOverrideCause={overrideBreakCause}
      />
    </>
  );
}

function StepCard({
  title,
  icon,
  label,
  active,
  complete,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  complete?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`card ${active ? 'ring-1 ring-[var(--accent)]' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="card-title">{title}</div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <span className="text-accent">{icon}</span>
            {label}
          </div>
        </div>
        {complete ? <span className="badge green"><CheckCircle2 size={10} /> Done</span> : <span className="badge">Pending</span>}
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted flex items-center gap-2">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

function BreakPanel({
  open,
  onClose,
  selected,
  onResolve,
  onUpdateOwner,
  onUpdateStatus,
  onUpdateNotes,
  onOverrideCause,
}: {
  open: boolean;
  onClose: () => void;
  selected: { kind: 'position' | 'cash'; brk: PositionBreak | CashBreak } | null;
  onResolve: (breakId: string, resolution: BreakResolution, notes?: string) => void;
  onUpdateOwner: (breakId: string, owner: string) => void;
  onUpdateStatus: (breakId: string, status: BreakStatus) => void;
  onUpdateNotes: (breakId: string, notes: string) => void;
  onOverrideCause: (breakId: string, cause: BreakCause, note: string) => void;
}) {
  const [localNotes, setLocalNotes] = useState('');
  const [localOwner, setLocalOwner] = useState('');
  const [localStatus, setLocalStatus] = useState<BreakStatus>('New');
  const [overrideCause, setOverrideCause] = useState<BreakCause>('Unknown');
  const [overrideNote, setOverrideNote] = useState('');

  useEffect(() => {
    if (!selected) return;
    const brk: any = selected.brk;
    setLocalNotes(brk.notes || '');
    setLocalOwner(brk.owner || '');
    setLocalStatus(brk.status || 'New');
    setOverrideCause((brk.overriddenCause || brk.causeAnalysis?.cause || 'Unknown') as BreakCause);
    setOverrideNote(brk.overrideNote || '');
  }, [selected]);

  if (!selected) return null;

  const brk: any = selected.brk;
  const breakId: string = brk.id;
  const cause: BreakCause = (brk.overriddenCause || brk.causeAnalysis?.cause || 'Unknown') as BreakCause;

  return (
    <div className={`break-panel ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="break-panel-header">
        <div>
          <div className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow" />
            Break {breakId}
          </div>
          <div className="text-xs text-muted mt-1">
            {selected.kind === 'cash'
              ? `Cash — ${(selected.brk as CashBreak).currency}`
              : `Position — ${(selected.brk as PositionBreak).ticker} (${(selected.brk as PositionBreak).type})`}
          </div>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="break-panel-content space-y-4">
        <div className="card">
          <div className="card-title">Summary</div>
          <div className="space-y-2">
            <DetailRow label="Delta USD">
              <span className={`text-sm font-semibold ${brk.deltaUSD >= 0 ? 'text-accent' : 'text-red-400'}`}>{fmtSignedUSD(brk.deltaUSD, 'compact')}</span>
            </DetailRow>
            <DetailRow label="Status" icon={<CheckCircle2 size={12} />}>
              <select
                className="input input-sm"
                value={localStatus}
                onChange={(e) => {
                  const v = e.target.value as BreakStatus;
                  setLocalStatus(v);
                  onUpdateStatus(breakId, v);
                }}
                style={{ width: 160 }}
              >
                {(['New', 'Assigned', 'In Progress', 'Resolved', 'Waived'] as BreakStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </DetailRow>
            <DetailRow label="Owner" icon={<User size={12} />}>
              <input
                className="input input-sm"
                value={localOwner}
                onChange={(e) => {
                  setLocalOwner(e.target.value);
                  onUpdateOwner(breakId, e.target.value);
                }}
                placeholder="e.g. MO-Paris"
                style={{ width: 160 }}
              />
            </DetailRow>
            <DetailRow label="Resolution">
              <span className={`badge ${brk.resolution === 'unresolved' ? 'yellow' : 'green'}`}>{brk.resolution}</span>
            </DetailRow>
            {brk.ticketId && (
              <DetailRow label="Ticket">
                <span className="badge blue">{brk.ticketId}</span>
              </DetailRow>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">AI Cause Analysis</div>
          <div className="text-sm font-semibold">{cause}</div>
          <div className="text-xs text-muted mt-1">
            Confidence: {brk.causeAnalysis?.confidence !== undefined ? fmtConfidence(brk.causeAnalysis.confidence) : '—'}
          </div>

          {brk.causeAnalysis?.evidence?.length > 0 && (
            <ul className="text-xs text-muted mt-3 space-y-1 list-disc pl-4">
              {brk.causeAnalysis.evidence.slice(0, 6).map((ev: string, i: number) => (
                <li key={i}>{ev}</li>
              ))}
            </ul>
          )}

          {brk.causeAnalysis?.suggestedFix && (
            <p className="text-xs mt-3 text-muted">
              <span className="font-semibold" style={{ color: 'var(--accent)' }}>Suggested:</span> {brk.causeAnalysis.suggestedFix}
            </p>
          )}
        </div>

        <div className="card">
          <div className="card-title">Override Cause</div>
          <div className="grid" style={{ gridTemplateColumns: '160px 1fr', gap: 10, alignItems: 'center' }}>
            <span className="text-xs text-muted">Cause</span>
            <select className="input input-sm" value={overrideCause} onChange={(e) => setOverrideCause(e.target.value as BreakCause)}>
              {CAUSE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <span className="text-xs text-muted">Note</span>
            <input className="input input-sm" value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} placeholder="Why override?" />
          </div>
          <div className="mt-3">
            <button
              className="btn btn-sm btn-accent"
              onClick={() => onOverrideCause(breakId, overrideCause, overrideNote || 'Override applied')}
            >
              <Tag size={12} />
              Apply override
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Notes</div>
          <textarea
            className="input"
            value={localNotes}
            onChange={(e) => {
              setLocalNotes(e.target.value);
              onUpdateNotes(breakId, e.target.value);
            }}
            placeholder="Add context, checks performed, next steps…"
            rows={4}
          />
        </div>
      </div>

      <div className="break-panel-actions">
        <button className="btn btn-primary" onClick={() => onResolve(breakId, 'accept_custodian', localNotes)}>
          <CheckCircle2 size={14} /> Accept custodian
        </button>
        <button className="btn btn-accent" onClick={() => onResolve(breakId, 'keep_internal', localNotes)}>
          <Sparkles size={14} /> Keep internal
        </button>
        <button className="btn" onClick={() => onResolve(breakId, 'adjustment_created', localNotes)}>
          <Calculator size={14} /> Create adjustment
        </button>
        <button className="btn" onClick={() => onResolve(breakId, 'ticket_opened', localNotes)}>
          <AlertTriangle size={14} /> Open ticket
        </button>
        <button className="btn btn-ghost" onClick={() => onResolve(breakId, 'unresolved', localNotes)}>
          Unmark resolution
        </button>
      </div>
    </div>
  );
}
