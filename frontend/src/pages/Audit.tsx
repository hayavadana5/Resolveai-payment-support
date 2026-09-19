import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Loading, Status, shortTime } from '../components/primitives';
import type { AuditEntry } from '../api/types';

const EVENTS = [
  'CASE_CREATED', 'AI_DECISION', 'TOOL_CALL', 'POLICY_EVALUATION', 'ACTION_EXECUTED',
  'ACTION_BLOCKED', 'WORKFLOW_INVOKED', 'MEMORY_RETRIEVAL', 'VERIFICATION', 'NOTIFICATION',
  'ESCALATION', 'HUMAN_DECISION', 'CASE_RESOLVED', 'AUTH', 'ERROR',
];

export function Audit() {
  const [logs, setLogs] = useState<AuditEntry[] | null>(null);
  const [event, setEvent] = useState('');
  const [caseId, setCaseId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (event) params.set('event', event);
    if (caseId) params.set('caseId', caseId);
    setLogs(null);
    api.get<{ logs: AuditEntry[] }>(`/audit?${params}`).then((d) => setLogs(d.logs));
  }, [event, caseId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit trail</h1>
          <p className="text-sm text-muted">Every decision, tool call, policy check and human override.</p>
        </div>
        <div className="flex gap-2">
          <input
            className="field w-40 text-sm"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="Case id"
            aria-label="Filter by case"
          />
          <select className="field w-auto text-sm" value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Filter by event">
            <option value="">All events</option>
            {EVENTS.map((ev) => (
              <option key={ev} value={ev}>
                {ev.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!logs ? (
        <Loading what="audit records" />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-micro text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Case</th>
                <th className="px-4 py-2.5 font-medium">Event</th>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">What happened</th>
                <th className="px-4 py-2.5 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logs.map((log) => (
                <tr key={log._id} className="align-top hover:bg-canvas">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{shortTime(log.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    {log.caseId ? (
                      <Link to={`/cases/${log.caseId}`} className="figure text-xs underline underline-offset-2">
                        {log.caseId}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{log.event.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{log.actor}</td>
                  <td className="max-w-lg px-4 py-2.5">{log.summary}</td>
                  <td className="px-4 py-2.5">
                    <Status value={log.outcome} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">No records match those filters.</p> : null}
        </div>
      )}
    </div>
  );
}
