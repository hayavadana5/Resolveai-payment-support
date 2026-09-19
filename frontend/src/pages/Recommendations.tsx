import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Loading, Status, shortTime } from '../components/primitives';

interface Recommendation {
  caseId: string; caseName: string; issue: string; customerId: string; status: string;
  aiTeammate: { name: string; specialty: string; status: string };
  decision?: { intent: string; confidence: number; risk: string; reasoningSummary: string; recommendedAction: string; aiMode: string };
  autonomy: { mode: string; reason: string }; riskLevel: string; aiConfidence: number; updatedAt: string;
}

export function Recommendations() {
  const [items, setItems] = useState<Recommendation[] | null>(null);
  useEffect(() => { api.get<{ recommendations: Recommendation[] }>('/cases/recommendations').then((d) => setItems(d.recommendations)); }, []);
  if (!items) return <Loading what="AI recommendations" />;
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-semibold tracking-tight">AI Recommendations</h1><p className="mt-1 text-sm text-muted">Decisions proposed by ResolveAI teammates, with authority and evidence visible before execution.</p></header>
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((r) => <article key={r.caseId} className="panel p-5">
        <div className="flex items-start justify-between gap-4"><div><Link to={`/cases/${r.caseId}`} className="figure text-xs underline">{r.caseId}</Link><h2 className="mt-1 font-semibold">{r.caseName}</h2><p className="mt-1 text-sm text-muted">{r.issue}</p></div><Status value={r.riskLevel} /></div>
        <div className="mt-4 rounded border border-line bg-canvas p-3"><p className="text-micro text-muted">ASSIGNED AI TEAMMATE</p><p className="mt-1 text-sm font-medium">{r.aiTeammate.name}</p><p className="text-xs text-muted">{r.aiTeammate.specialty}</p></div>
        {r.decision ? <><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><p className="text-micro text-muted">Recommendation</p><p className="mt-1 text-sm font-semibold">{r.decision.recommendedAction.replace(/_/g,' ')}</p></div><div><p className="text-micro text-muted">Confidence</p><p className="figure mt-1 text-sm">{(r.decision.confidence*100).toFixed(0)}%</p></div><div><p className="text-micro text-muted">Risk</p><p className="mt-1 text-sm"><Status value={r.decision.risk}/></p></div><div><p className="text-micro text-muted">Authority</p><p className="mt-1 text-sm font-medium">{r.autonomy.mode.replace(/_/g,' ')}</p></div></div><p className="mt-4 text-sm leading-relaxed">{r.decision.reasoningSummary}</p></> : <p className="mt-4 text-sm text-muted">The teammate has not produced a recommendation yet.</p>}
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted"><span>{r.status}</span><span>{shortTime(r.updatedAt)}</span></div>
      </article>)}
    </div>
    {items.length===0 ? <p className="panel p-8 text-center text-sm text-muted">No AI recommendations yet.</p> : null}
  </div>;
}
