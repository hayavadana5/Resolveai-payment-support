import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Empty, Loading, Metric, Status, duration, shortTime } from '../components/primitives';
import type { Analytics, AuditEntry, EscalationRecord, SupportCase } from '../api/types';

interface Teammate { id:string; name:string; specialty:string; activeCases:number; status:string; }

interface DashboardData {
  recentCases: SupportCase[];
  recentActivity: AuditEntry[];
  openEscalations: EscalationRecord[];
  teammates: Teammate[];
  recentRecommendations: SupportCase[];
}

export function Dashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const load = () => Promise.all([api.get<Analytics>('/analytics'), api.get<DashboardData>('/analytics/dashboard')])
      .then(([a, d]) => {
        setAnalytics(a);
        setData(d);
      })
      .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, []);

  if (!analytics || !data) return <Loading what="the operations picture" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
          <p className="text-sm text-muted">Every figure below is computed from stored case records.</p>
        </div>
        <Link to="/cases" className="btn-primary">
          Open a case
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Verified customer resolutions"
          value={analytics.totals.verifiedCustomerResolutions}
          sub="Resolved, verified against live state, customer told"
        />
        <Metric label="Total cases" value={analytics.totals.cases} sub={`${analytics.totals.openCases} still open`} />
        <Metric
          label="Closed without a human"
          value={analytics.totals.autonomousResolutions}
          sub={`${analytics.rates.automationRate}% automation rate`}
        />
        <Metric
          label="Sent to a human"
          value={analytics.totals.humanEscalations}
          sub={`${analytics.rates.escalationRate}% escalation rate`}
        />
        <Metric label="Average time to resolve" value={duration(analytics.averageResolutionMs)} />
        <Metric label="Action success rate" value={`${analytics.rates.actionSuccessRate}%`} />
        <Metric label="First-time resolution" value={`${analytics.rates.firstTimeResolutionRate}%`} />
        <Metric
          label="Actions blocked by policy"
          value={analytics.totals.blockedActions}
          sub="Refused before anything changed"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="panel">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Recent cases</h2>
            <Link to="/cases" className="text-xs text-muted underline underline-offset-2 hover:text-ink">
              All cases
            </Link>
          </header>
          {data.recentCases.length === 0 ? (
            <Empty title="No cases yet" action="Open one from the Cases page to watch the teammate work." />
          ) : (
            <ul className="divide-y divide-line">
              {data.recentCases.map((c) => (
                <li key={c.caseId}>
                  <Link to={`/cases/${c.caseId}`} className="block px-4 py-3 hover:bg-canvas">
                    <div className="flex items-center justify-between gap-3">
                      <span className="figure text-xs text-muted">{c.caseId}</span>
                      <Status value={c.status} />
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm">{c.issue}</p>
                    <p className="mt-1 text-micro text-muted">{shortTime(c.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel mt-6">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">AI recommendations</h2>
            <Link to="/recommendations" className="text-xs text-muted underline underline-offset-2 hover:text-ink">
              All recommendations
            </Link>
          </header>
          {data.recentRecommendations?.length === 0 ? (
            <Empty title="No recommendations" action="AI recommendations will appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {data.recentRecommendations?.map((r) => (
                <li key={r.caseId}>
                  <Link to={`/cases/${r.caseId}`} className="block px-4 py-3 hover:bg-canvas">
                    <div className="flex items-center justify-between gap-3">
                      <span className="figure text-xs text-muted">{r.caseId}</span>
                      <Status value={r.riskLevel} />
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm font-medium">{r.decision?.recommendedAction?.replace(/_/g, ' ')}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">{r.decision?.reasoningSummary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>

        <div className="space-y-6">
          <section className="panel">
            <header className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Waiting on you</h2>
            </header>
            {data.openEscalations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">Nothing is waiting for a human decision.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.openEscalations.map((e) => (
                  <li key={e.escalationId} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <Link to="/escalations" className="figure text-xs underline underline-offset-2">
                        {e.caseId}
                      </Link>
                      <Status value={e.riskLevel} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{e.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <header className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Teammate activity</h2>
            </header>
            <ul className="divide-y divide-line">
              {data.recentActivity.map((entry) => (
                <li key={entry._id} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-micro text-muted">{entry.actor}</span>
                    <span className="text-micro text-muted">{shortTime(entry.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm">{entry.summary}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">AI Teammates</h2>
              <Link to="/teammates" className="text-xs text-muted underline underline-offset-2 hover:text-ink">
                All teammates
              </Link>
            </header>
            <ul className="divide-y divide-line">
              {data.teammates?.map((t) => (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{t.name}</span>
                    <Status value={t.status} />
                  </div>
                  <p className="mt-1 text-micro text-muted">{t.specialty} · {t.activeCases} active</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
