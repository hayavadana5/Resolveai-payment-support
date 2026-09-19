import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Empty, Loading, Status, rupees, shortTime } from '../components/primitives';
import type { EscalationRecord } from '../api/types';

export function Escalations() {
  const { user } = useAuth();
  const [items, setItems] = useState<EscalationRecord[] | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get<{ escalations: EscalationRecord[] }>('/escalations').then((d) => setItems(d.escalations));
  }, []);

  useEffect(load, [load]);

  async function decide(escalationId: string, decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO') {
    setBusy(escalationId);
    setError('');
    try {
      await api.post(`/escalations/${escalationId}/decision`, { decision, note: note[escalationId] ?? '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That decision could not be recorded.');
    } finally {
      setBusy('');
    }
  }

  if (!items) return <Loading what="escalations" />;

  const pending = items.filter((e) => e.status === 'PENDING');
  const decided = items.filter((e) => e.status !== 'PENDING');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Escalations</h1>
        <p className="text-sm text-muted">
          Cases the teammate would not close on its own, with the evidence it gathered before stopping.
        </p>
      </div>

      {error ? (
        <p className="rounded border border-blocked/30 bg-blocked/5 px-4 py-3 text-sm text-blocked">{error}</p>
      ) : null}

      {pending.length === 0 ? (
        <Empty title="Nothing needs a decision" action="Escalated cases will appear here with full context." />
      ) : (
        <div className="space-y-4">
          {pending.map((e) => (
            <article key={e.escalationId} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/cases/${e.caseId}`} className="figure text-sm underline underline-offset-2">
                      {e.caseId}
                    </Link>
                    <Status value={e.riskLevel} />
                    {e.case ? <Status value={e.case.category} /> : null}
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed">{e.case?.issue}</p>
                </div>
                <div className="text-right text-sm">
                  {e.case?.transactionId ? <p className="figure text-xs text-muted">{e.case.transactionId}</p> : null}
                  {typeof (e.evidence as { transaction?: { amount?: number } })?.transaction?.amount === 'number' ? (
                    <p className="figure mt-0.5 text-lg font-semibold">
                      {rupees((e.evidence as { transaction: { amount: number } }).transaction.amount)}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-micro text-muted">{shortTime(e.createdAt)}</p>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
                <div>
                  <dt className="text-micro text-muted">AI confidence</dt>
                  <dd className="figure mt-0.5 text-sm">
                    {e.case?.aiConfidence ? `${(e.case.aiConfidence * 100).toFixed(0)}%` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-micro text-muted">Actions attempted</dt>
                  <dd className="mt-0.5 text-sm">{e.case?.actions?.length ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-micro text-muted">Recommended</dt>
                  <dd className="mt-0.5 text-sm">{e.recommendedAction.replace(/_/g, ' ').toLowerCase()}</dd>
                </div>
              </dl>

              <div className="mt-4 rounded border border-line bg-canvas/60 p-3">
                <p className="text-micro text-muted">Why it stopped</p>
                <p className="mt-1 text-sm leading-relaxed">{e.reason}</p>
                {e.aiSummary ? <p className="mt-2 text-sm leading-relaxed text-muted">{e.aiSummary}</p> : null}
              </div>

              <label className="mt-4 block text-micro text-muted" htmlFor={`note-${e.escalationId}`}>
                Decision note
              </label>
              <input
                id={`note-${e.escalationId}`}
                className="field mt-1"
                value={note[e.escalationId] ?? ''}
                onChange={(ev) => setNote((prev) => ({ ...prev, [e.escalationId]: ev.target.value }))}
                placeholder="What you checked and why you decided this way"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy === e.escalationId}
                  onClick={() => decide(e.escalationId, 'APPROVE')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy === e.escalationId}
                  onClick={() => decide(e.escalationId, 'REJECT')}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy === e.escalationId}
                  onClick={() => decide(e.escalationId, 'REQUEST_INFO')}
                >
                  Request more information
                </button>
              </div>

              {e.recommendedAction === 'INITIATE_REFUND' && user?.role !== 'ADMIN' ? (
                <p className="mt-2 text-micro text-escalated">
                  Approving this refund needs an admin. Your decision will be refused.
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {decided.length > 0 ? (
        <section className="panel">
          <header className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Already decided</h2>
          </header>
          <ul className="divide-y divide-line">
            {decided.map((e) => (
              <li key={e.escalationId} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <Link to={`/cases/${e.caseId}`} className="figure text-xs underline underline-offset-2">
                    {e.caseId}
                  </Link>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted">{e.humanDecision?.note || e.reason}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Status value={e.status} />
                  <p className="mt-1 text-micro text-muted">{e.humanDecision?.decidedBy}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
