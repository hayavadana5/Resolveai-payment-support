import { useEffect, useMemo, useState } from 'react';
import { tokenStore } from '../api/client';

type LiveEvent = { id: string; type: string; caseId: string; title: string; detail?: string; status?: string; data?: Record<string, unknown>; createdAt: string };

export function LiveActivity({ caseId }: { caseId: string }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const url = useMemo(() => `/api/realtime/cases/${encodeURIComponent(caseId)}/stream?token=${encodeURIComponent(tokenStore.get() ?? '')}`, [caseId]);

  useEffect(() => {
    const source = new EventSource(url);
    const onMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as LiveEvent;
        if (!data.id) return;
        setEvents((current) => [...current, data].slice(-30));
      } catch { /* ignore heartbeat/connect payloads */ }
    };
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    const types = ['lifecycle', 'action', 'workflow', 'verification', 'decision', 'case_status', 'escalation', 'memory'];
    types.forEach((type) => source.addEventListener(type, onMessage as EventListener));
    return () => { types.forEach((type) => source.removeEventListener(type, onMessage as EventListener)); source.close(); };
  }, [url]);

  return <section className="panel p-4">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold">Live teammate activity</h2><p className="mt-1 text-xs text-muted">Real-time execution events from the AI teammate and workflow layer.</p></div>
      <span className={`rounded border px-2 py-1 text-micro ${connected ? 'border-resolved/30 bg-resolved/5 text-resolved' : 'border-line text-muted'}`}>{connected ? 'LIVE' : 'CONNECTING'}</span>
    </div>
    <ol className="mt-4 space-y-2">
      {events.length === 0 ? <li className="rounded border border-dashed border-line p-4 text-sm text-muted">Waiting for the next teammate event…</li> : events.slice().reverse().map((event) => <li key={event.id} className="flex gap-3 rounded border border-line p-3">
        <span className="figure text-micro text-muted">{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        <div className="min-w-0"><p className="text-sm font-medium">{event.title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted">{event.detail}</p></div>
        {event.status ? <span className="ml-auto shrink-0 text-micro text-muted">{event.status}</span> : null}
      </li>)}
    </ol>
  </section>;
}
