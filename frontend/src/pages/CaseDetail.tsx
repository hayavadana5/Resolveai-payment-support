import { LiveActivity } from '../components/LiveActivity';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Loading, Status, rupees, shortTime } from '../components/primitives';
import type { AuditEntry, Customer, EscalationRecord, SupportCase, Transaction } from '../api/types';

interface CaseDetailResponse {
  case: SupportCase;
  customer: Customer | null;
  transaction: Transaction | null;
  auditTrail: AuditEntry[];
  escalation: EscalationRecord | null;
}

const STAGES = ['Understand', 'Investigate', 'Decide', 'Act', 'Verify', 'Resolve'] as const;

function stageIndex(c: SupportCase): number {
  if (c.status === 'RESOLVED' || c.status === 'ESCALATED' || c.status === 'CLOSED') return 5;
  if (c.status === 'VERIFYING') return 4;
  if (c.status === 'ACTING') return 3;
  if (c.decision?.intent && c.decision.intent !== 'UNKNOWN') return 2;
  if (c.status === 'INVESTIGATING') return 1;
  return 0;
}

export function CaseDetail() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<CaseDetailResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!caseId) return;
    api.get<CaseDetailResponse>(`/cases/${caseId}`).then(setData).catch(() => undefined);
  }, [caseId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!caseId) return;
    const timer = window.setInterval(load, 2500);
    return () => window.clearInterval(timer);
  }, [caseId, load]);

  async function resolveWithAi() {
    if (!caseId) return;
    setRunning(true);
    setError('');
    try {
      await api.post(`/cases/${caseId}/resolve`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The teammate could not finish this case.');
    } finally {
      setRunning(false);
    }
  }

  if (!data) return <Loading what="this case" />;
  const { case: c, customer, transaction, auditTrail, escalation } = data;
  const current = stageIndex(c);
  const settled = ['RESOLVED', 'ESCALATED', 'CLOSED'].includes(c.status);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="figure text-sm text-muted">{c.caseId}</span>
            <Status value={c.status} />
            <Status value={c.priority} />
          </div>
          <h1 className="mt-2 max-w-2xl text-xl font-semibold leading-snug">{c.caseName}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{c.issue}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-line px-2.5 py-1 text-xs">AI teammate: <strong>{c.aiTeammate.name}</strong></span>
            <span className="rounded-full border border-line px-2.5 py-1 text-xs">{c.aiTeammate.status.replace(/_/g, ' ').toLowerCase()}</span>
            <span className="rounded-full border border-line px-2.5 py-1 text-xs">Authority: <strong>{c.autonomy.mode.replace(/_/g, ' ')}</strong></span>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            {customer?.name ?? c.customerId}
            {transaction ? (
              <>
                {' · '}
                <span className="figure">{transaction.transactionId}</span>
                {' · '}
                <span className="figure">{rupees(transaction.amount)}</span>
                {' · '}
                {transaction.paymentMethod.toLowerCase()}
              </>
            ) : null}
          </p>
        </div>

        {!settled ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={async () => { if (!caseId) return; setRunning(true); try { await api.post(`/cases/${caseId}/collaborate`); load(); } catch (err) { setError(err instanceof Error ? err.message : 'Team review failed.'); } finally { setRunning(false); } }} disabled={running}>
              {running ? 'Running team review…' : 'Run team review'}
            </button>
            <button type="button" className="btn-primary" onClick={resolveWithAi} disabled={running}>
              {running ? 'Working the case…' : 'Resolve with AI'}
            </button>
          </div>
        ) : null}
      </header>

      {error ? (
        <p className="rounded border border-blocked/30 bg-blocked/5 px-4 py-3 text-sm text-blocked">{error}</p>
      ) : null}

      {/* The spine: the six stages the teammate moves through, as an actual sequence. */}
      <ol className="panel flex flex-col gap-0 overflow-x-auto p-4 sm:flex-row sm:items-center">
        {STAGES.map((stage, index) => {
          const done = index < current || (settled && index === 5);
          const active = index === current && !settled;
          return (
            <li key={stage} className="flex flex-1 items-center gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`figure flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-micro ${
                    done
                      ? 'bg-ink text-white'
                      : active
                        ? 'border border-acting bg-acting/10 text-acting'
                        : 'border border-line text-muted'
                  }`}
                >
                  {index + 1}
                </span>
                <span className={`text-sm ${done || active ? 'text-ink' : 'text-muted'}`}>
                  {index === 5 && c.status === 'ESCALATED' ? 'Escalate' : stage}
                </span>
              </div>
              {index < STAGES.length - 1 ? (
                <span className={`hidden h-px flex-1 sm:block ${done ? 'bg-ink' : 'bg-line'}`} />
              ) : null}
            </li>
          );
        })}
      </ol>

      <LiveActivity caseId={caseId} />
      {c.collaboration?.findings?.length ? (
        <section className="panel p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-sm font-semibold">AI teammate collaboration</h2><p className="mt-1 text-xs text-muted">Specialists independently assess the case; the orchestrator coordinates their evidence and keeps actions behind backend policy controls.</p></div>
            <div className="flex items-center gap-2"><Status value={c.collaboration.status}/><span className="figure text-xs">{Math.round(c.collaboration.agreementScore*100)}% agreement</span></div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {c.collaboration.findings.map((f) => <article key={f.teammateId} className="rounded border border-line p-3">
              <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium">{f.teammateName}</p><p className="mt-0.5 text-micro text-muted">{f.specialty}</p></div><span className="figure text-xs">{Math.round(f.confidence*100)}%</span></div>
              <p className="mt-3 text-xs font-medium">{f.recommendation}</p>
              <ul className="mt-2 space-y-1">{f.evidence.map(e=><li key={e.label} className="text-micro text-muted"><span className="text-ink">{e.label}:</span> {e.value}</li>)}</ul>
            </article>)}
          </div>
          <div className="mt-4 border-t border-line pt-3 text-xs text-muted">Orchestrator consensus: <strong className="text-ink">{c.collaboration.consensus.replace(/_/g,' ')}</strong> · next owner <strong className="text-ink">{c.collaboration.nextOwner}</strong></div>
        </section>
      ) : null}

      <section className="panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-sm font-semibold">AI teammate lifecycle</h2><p className="mt-1 text-xs text-muted">A case is owned by the teammate from intake through verified outcome or human handoff.</p></div>
          <span className="text-micro text-muted">{c.lifecycle.length} recorded events</span>
        </div>
        <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {c.lifecycle.map((event, index) => <li key={`${event.createdAt}-${index}`} className="rounded border border-line p-3">
            <div className="flex items-center justify-between gap-2"><span className="figure text-micro">{event.stage}</span><Status value={event.status}/></div>
            <p className="mt-2 text-sm font-medium">{event.title}</p><p className="mt-1 text-xs leading-relaxed text-muted">{event.detail}</p>
          </li>)}
        </ol>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          {c.decision?.reasoningSummary ? (
            <section className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">What the teammate concluded</h2>
                <span
                  className={`rounded border px-2 py-0.5 text-micro ${
                    c.decision.aiMode === 'GEMINI'
                      ? 'border-resolved/30 bg-resolved/5 text-resolved'
                      : 'border-escalated/40 bg-escalated/5 text-escalated'
                  }`}
                >
                  {c.decision.aiMode === 'GEMINI' ? 'Reasoned by Gemini' : 'Rule-based fallback'}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed">{c.decision.reasoningSummary}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-micro text-muted">Intent</dt>
                  <dd className="mt-0.5">{c.decision.intent.replace(/_/g, ' ').toLowerCase()}</dd>
                </div>
                <div>
                  <dt className="text-micro text-muted">Confidence</dt>
                  <dd className="figure mt-0.5">{(c.decision.confidence * 100).toFixed(0)}%</dd>
                </div>
                <div>
                  <dt className="text-micro text-muted">Risk</dt>
                  <dd className="mt-0.5">
                    <Status value={c.decision.risk} />
                  </dd>
                </div>
                <div>
                  <dt className="text-micro text-muted">Proposed</dt>
                  <dd className="mt-0.5">{c.decision.recommendedAction.replace(/_/g, ' ').toLowerCase()}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {c.riskIntelligence ? (
            <section className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-sm font-semibold">Risk intelligence</h2><p className="mt-1 text-xs text-muted">A deterministic risk profile combines transaction, customer, merchant, action and historical signals.</p></div>
                <div className="text-right"><p className="figure text-3xl font-semibold">{c.riskIntelligence.overallScore}<span className="text-sm text-muted">/100</span></p><Status value={c.riskIntelligence.level}/></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[['Transaction',c.riskIntelligence.transactionScore],['Customer',c.riskIntelligence.customerScore],['Merchant',c.riskIntelligence.merchantScore],['Action',c.riskIntelligence.actionScore],['History',c.riskIntelligence.historicalScore]].map(([label,value])=>(<div key={String(label)} className="rounded border border-line p-3"><p className="text-micro text-muted">{label}</p><p className="figure mt-1 text-lg">{String(value)}</p></div>))}
              </div>
              {c.riskIntelligence.signals.length ? <ul className="mt-4 space-y-2">{c.riskIntelligence.signals.map((signal)=><li key={signal.signal} className="flex items-start justify-between gap-3 rounded border border-line px-3 py-2"><div><p className="text-sm font-medium">{signal.signal.replace(/_/g,' ')}</p><p className="text-xs text-muted">{signal.explanation}</p></div><span className="figure text-xs">+{signal.score}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted">No elevated risk signals were detected.</p>}
            </section>
          ) : null}

          {c.actionPlan?.length ? (
            <section className="panel p-4">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">AI action plan</h2><p className="mt-1 text-xs text-muted">The teammate converts its recommendation into an ordered, controlled execution plan.</p></div><span className="text-micro text-muted">{c.actionPlan.length} step(s)</span></div>
              <ol className="mt-4 space-y-2">{c.actionPlan.map((step)=><li key={step.step} className="flex items-center gap-3 rounded border border-line p-3"><span className="figure flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas text-xs">{step.step}</span><div className="min-w-0 flex-1"><p className="figure text-sm">{step.tool}</p><p className="mt-0.5 text-xs text-muted">{step.purpose}</p></div><Status value={step.status}/></li>)}</ol>
            </section>
          ) : null}

          {c.verification ? (
            <section className="panel p-4">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Execution proof</h2><p className="mt-1 text-xs text-muted">The teammate compares the state before and after execution instead of trusting an action success response.</p></div><Status value={c.verification.passed ? 'VERIFIED' : 'FAILED'} /></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded border border-line p-3"><p className="text-micro text-muted">Before</p><pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(c.verification.beforeState, null, 2)}</pre></div>
                <div className="rounded border border-line p-3"><p className="text-micro text-muted">After</p><pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(c.verification.afterState, null, 2)}</pre></div>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">{c.verification.checks.map((check) => <li key={check.name} className="rounded border border-line p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{check.name}</span><span className="text-micro">{check.passed ? 'PASS' : 'FAIL'}</span></div><p className="mt-1 text-xs text-muted">Expected: {check.expected}</p><p className="text-xs text-muted">Actual: {check.actual}</p></li>)}</ul>
            </section>
          ) : null}

          {c.memoryOutcome ? <section className="panel border-resolved/30 bg-resolved/5 p-4"><h2 className="text-sm font-semibold">Outcome memory</h2><p className="mt-1 text-sm text-muted">{c.memoryOutcome}</p></section> : null}

          {c.retrievedKnowledge.length > 0 ? (
            <section className="panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">What it remembered</h2>
                <span
                  className={`rounded border px-2 py-0.5 text-micro ${
                    c.memoryMode === 'COGNEE'
                      ? 'border-resolved/30 bg-resolved/5 text-resolved'
                      : 'border-escalated/40 bg-escalated/5 text-escalated'
                  }`}
                >
                  {c.memoryMode === 'COGNEE' ? 'Retrieved from Cognee' : 'Local knowledge fallback'}
                </span>
              </div>
              <ul className="mt-3 space-y-3">
                {c.retrievedKnowledge.map((item, index) => (
                  <li key={index} className="border-l-2 border-line pl-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium">{item.title}</p>
                      <span className="figure text-micro text-muted">{(item.relevance * 100).toFixed(0)}% match</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.content}</p>
                    <p className="mt-1 text-micro text-muted">{item.source}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {c.actions.length > 0 ? (
            <section className="panel p-4">
              <h2 className="text-sm font-semibold">What it did</h2>
              <ul className="mt-3 divide-y divide-line">
                {c.actions.map((action, index) => (
                  <li key={index} className="flex items-start justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="figure text-sm">{action.tool}</p>
                      <p className="mt-0.5 break-words text-micro text-muted">
                        {JSON.stringify(action.result).slice(0, 180)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Status value={action.status} />
                      <p className="mt-1 text-micro text-muted">attempt {action.attempt}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {c.verification?.checks?.length ? (
            <section className="panel p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Proof the change landed</h2>
                <Status value={c.verification.passed ? 'SUCCESS' : 'FAILED'} />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(['beforeState', 'afterState'] as const).map((key) => (
                  <div key={key} className="rounded border border-line p-3">
                    <p className="text-micro text-muted">{key === 'beforeState' ? 'Before' : 'After'}</p>
                    <dl className="mt-1.5 space-y-1 text-sm">
                      {Object.entries(c.verification?.[key] ?? {}).map(([field, value]) => (
                        <div key={field} className="flex justify-between gap-3">
                          <dt className="text-muted">{field.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
                          <dd className="figure text-xs">{String(value ?? '—')}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>

              <ul className="mt-3 space-y-1.5">
                {c.verification.checks.map((check, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 text-sm">
                    <span className={check.passed ? '' : 'text-blocked'}>{check.name}</span>
                    <span className="figure text-xs text-muted">
                      expected {check.expected} · got {check.actual}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {escalation ? (
            <section className="panel border-escalated/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Why it stopped</h2>
                <Status value={escalation.status} />
              </div>
              <p className="mt-2 text-sm leading-relaxed">{escalation.reason}</p>
              <p className="mt-2 text-sm text-muted">
                Recommended next step: {escalation.recommendedAction.replace(/_/g, ' ').toLowerCase()}
              </p>
              {escalation.humanDecision ? (
                <p className="mt-3 border-t border-line pt-3 text-sm">
                  {escalation.humanDecision.decision} by {escalation.humanDecision.decidedBy}.{' '}
                  {escalation.humanDecision.note}
                </p>
              ) : null}
            </section>
          ) : null}

          {c.resolution ? (
            <section className="panel border-resolved/40 p-4">
              <h2 className="text-sm font-semibold">Resolution</h2>
              <p className="mt-2 text-sm leading-relaxed">{c.resolution}</p>
              {c.customerNotified ? <p className="mt-2 text-micro text-muted">The customer has been told.</p> : null}
            </section>
          ) : null}
        </div>

        <section className="panel h-fit">
          <header className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Audit trail</h2>
          </header>
          <ol className="max-h-[42rem] divide-y divide-line overflow-y-auto">
            {auditTrail.map((entry) => (
              <li key={entry._id} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-micro text-muted">{entry.actor}</span>
                  <span className="text-micro text-muted">{shortTime(entry.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-sm">{entry.summary}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Status value={entry.outcome} />
                  {entry.durationMs ? <span className="figure text-micro text-muted">{entry.durationMs}ms</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
