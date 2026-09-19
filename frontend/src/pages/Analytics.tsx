import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Loading, Metric, duration } from '../components/primitives';
import type { Analytics as AnalyticsData } from '../api/types';

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    api.get<AnalyticsData>('/analytics').then(setData).catch(() => undefined);
  }, []);

  if (!data) return <Loading what="analytics" />;

  const categories = Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]);
  const largest = Math.max(1, ...categories.map(([, count]) => count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted">Measured on completed outcomes, not conversations.</p>
      </div>

      <section className="panel p-6">
        <p className="text-sm text-muted">Verified customer resolutions</p>
        <p className="figure mt-2 text-6xl font-semibold leading-none">{data.totals.verifiedCustomerResolutions}</p>
        <p className="mt-3 max-w-lg text-sm text-muted">
          Cases the teammate closed where the change was confirmed against live system state and the customer was told.
          A case that merely got an answer does not count here.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Automation rate" value={`${data.rates.automationRate}%`} sub="Closed without a human" />
        <Metric label="Escalation rate" value={`${data.rates.escalationRate}%`} sub="Handed over deliberately" />
        <Metric label="Action success rate" value={`${data.rates.actionSuccessRate}%`} />
        <Metric label="First-time resolution" value={`${data.rates.firstTimeResolutionRate}%`} />
        <Metric label="Average resolution time" value={duration(data.averageResolutionMs)} />
        <Metric label="Cases handled" value={data.totals.cases} />
        <Metric label="Still open" value={data.totals.openCases} />
        <Metric label="Actions blocked by policy" value={data.totals.blockedActions} />
      </section>

      <section className="panel p-4">
        <h2 className="text-sm font-semibold">What customers are contacting us about</h2>
        <ul className="mt-4 space-y-2.5">
          {categories.map(([category, count]) => (
            <li key={category} className="grid grid-cols-[11rem_1fr_2rem] items-center gap-3 text-sm">
              <span className="truncate text-muted">{category.replace(/_/g, ' ').toLowerCase()}</span>
              <span className="h-2 rounded-sm bg-canvas">
                <span
                  className="block h-2 rounded-sm bg-ink"
                  style={{ width: `${(count / largest) * 100}%` }}
                />
              </span>
              <span className="figure text-right text-xs">{count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
