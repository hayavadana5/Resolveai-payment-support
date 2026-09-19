import type { ReactNode } from 'react';

export const rupees = (value: number) =>
  `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const shortTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const duration = (ms: number) => {
  if (!ms) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};

const STATUS_STYLES: Record<string, string> = {
  RESOLVED: 'bg-resolved/10 text-resolved border-resolved/30',
  ESCALATED: 'bg-escalated/10 text-escalated border-escalated/30',
  CLOSED: 'bg-muted/10 text-muted border-muted/30',
  OPEN: 'bg-acting/10 text-acting border-acting/30',
  INVESTIGATING: 'bg-acting/10 text-acting border-acting/30',
  ACTING: 'bg-acting/10 text-acting border-acting/30',
  VERIFYING: 'bg-acting/10 text-acting border-acting/30',
  HIGH: 'bg-blocked/10 text-blocked border-blocked/30',
  MEDIUM: 'bg-escalated/10 text-escalated border-escalated/30',
  LOW: 'bg-resolved/10 text-resolved border-resolved/30',
  CRITICAL: 'bg-blocked/10 text-blocked border-blocked/30',
  SUCCESS: 'bg-resolved/10 text-resolved border-resolved/30',
  FAILED: 'bg-blocked/10 text-blocked border-blocked/30',
  FAILURE: 'bg-blocked/10 text-blocked border-blocked/30',
  BLOCKED: 'bg-blocked/10 text-blocked border-blocked/30',
  PENDING: 'bg-escalated/10 text-escalated border-escalated/30',
  APPROVED: 'bg-resolved/10 text-resolved border-resolved/30',
  REJECTED: 'bg-blocked/10 text-blocked border-blocked/30',
};

export function Status({ value }: { value: string }) {
  const style = STATUS_STYLES[value] ?? 'bg-muted/10 text-muted border-muted/30';
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-micro font-medium ${style}`}>
      {value.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}

/** Says which engine actually did the work, never what we wish had done it. */
export function ModeTag({ label, value, live }: { label: string; value: string; live: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-micro ${
        live ? 'border-resolved/30 bg-resolved/5 text-resolved' : 'border-escalated/40 bg-escalated/5 text-escalated'
      }`}
      title={live ? `${label} is live` : `${label} is running on a local fallback`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-resolved' : 'bg-escalated'}`} />
      {label}: {value.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}

export function Metric({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-micro text-muted">{label}</p>
      <p className="figure mt-1 text-2xl font-semibold">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export function Empty({ title, action }: { title: string; action?: string }) {
  return (
    <div className="panel p-10 text-center">
      <p className="font-medium">{title}</p>
      {action ? <p className="mt-1 text-sm text-muted">{action}</p> : null}
    </div>
  );
}

export function Loading({ what }: { what: string }) {
  return <p className="p-10 text-center text-sm text-muted">Loading {what}…</p>;
}
