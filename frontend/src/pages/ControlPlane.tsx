import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Metric, Status, shortTime, rupees } from '../components/primitives';

type Data = {
  system: { aiMode:string; memoryMode:string; workflowMode:string; autonomousRefundCeiling:number; confidenceFloor:number };
  summary: { totalCases:number; activeCases:number; autonomousResolutions:number; verifiedResolutions:number; pendingHumanDecisions:number; highRiskCases:number; blockedActions:number; failedActions:number; verificationRate:number };
  teammates: Array<{id:string;name:string;specialty:string;activeCases:number;totalCases:number;status:string}>;
  anomalies: Array<{merchantId:string;captured:number;missingOrder:number;mismatchRate:number}>;
  pendingEscalations: Array<{escalationId:string;caseId:string;reason:string;riskLevel:string;recommendedAction:string}>;
  recentActivity: Array<{_id:string;event:string;actor:string;summary:string;outcome:string;createdAt:string}>;
  activeCases: Array<{caseId:string;caseName:string;status:string;riskLevel:string;aiConfidence:number;aiTeammate:{name:string};updatedAt:string}>;
};

export function ControlPlane() {
  const [data,setData]=useState<Data|null>(null);
  const [error,setError]=useState('');
  const load=useCallback(()=>api.get<Data>('/operations/control-plane').then(setData).catch(e=>setError(e instanceof Error?e.message:'Unable to load control plane.')),[]);
  useEffect(()=>{load(); const id=window.setInterval(load,5000); return()=>window.clearInterval(id)},[load]);
  if(!data) return <div className="panel p-10 text-center text-sm text-muted">{error||'Loading AI control plane…'}</div>;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="figure text-micro text-muted">RESOLVEAI / CONTROL PLANE</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Autonomous Operations</h1><p className="mt-1 max-w-3xl text-sm text-muted">One operational view of the AI teammates, human decisions, live cases, safety boundaries and verified outcomes.</p></div>
      <div className="flex flex-wrap gap-2 text-micro"><Status value={data.system.aiMode}/><Status value={data.system.memoryMode}/><Status value={data.system.workflowMode}/></div>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Active cases" value={data.summary.activeCases} sub={`${data.summary.totalCases} total cases`}/>
      <Metric label="Autonomous resolutions" value={data.summary.autonomousResolutions} sub="Completed without human decision"/>
      <Metric label="Verified resolutions" value={data.summary.verifiedResolutions} sub={`${data.summary.verificationRate}% of resolved cases`}/>
      <Metric label="Human decisions" value={data.summary.pendingHumanDecisions} sub="Waiting for approval / rejection"/>
    </div>

    <section className="panel overflow-hidden"><div className="border-b border-line px-4 py-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">AI teammate fleet</h2><p className="mt-1 text-xs text-muted">Specialists coordinate around the same customer outcome.</p></div><Link to="/teammates" className="text-xs underline underline-offset-2">Open fleet</Link></div></div><div className="grid md:grid-cols-2 xl:grid-cols-4">{data.teammates.map(t=><div key={t.id} className="border-b border-line p-4 last:border-b-0 md:border-r xl:border-b-0"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-medium"><span className={`h-2 w-2 rounded-full ${t.status==='WORKING'?'bg-resolved':'bg-muted'}`}/>{t.name}</span><Status value={t.status}/></div><p className="mt-2 text-xs leading-relaxed text-muted">{t.specialty}</p><p className="figure mt-4 text-2xl">{t.activeCases}<span className="ml-1 text-xs text-muted">active</span></p><p className="mt-1 text-micro text-muted">{t.totalCases} cases handled</p></div>)}</div></section>

    <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
      <section className="panel"><div className="border-b border-line px-4 py-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Live teammate queue</h2><p className="mt-1 text-xs text-muted">Auto-refreshes every 5 seconds.</p></div><Link to="/cases" className="text-xs underline underline-offset-2">All cases</Link></div></div><div className="divide-y divide-line">{data.activeCases.length===0?<p className="p-6 text-sm text-muted">No active cases.</p>:data.activeCases.map(c=><Link key={c.caseId} to={`/cases/${c.caseId}`} className="block p-4 hover:bg-canvas"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="figure text-xs">{c.caseId}</span><h3 className="mt-1 text-sm font-semibold">{c.caseName}</h3><p className="mt-1 text-xs text-muted">{c.aiTeammate.name} · confidence {(c.aiConfidence*100).toFixed(0)}%</p></div><div className="flex gap-2"><Status value={c.status}/><Status value={c.riskLevel}/></div></div></Link>)}</div></section>

      <div className="space-y-6">
        <section className="panel"><div className="border-b border-line px-4 py-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Human control queue</h2><p className="mt-1 text-xs text-muted">The AI stopped where authority or risk requires a person.</p></div><Link to="/escalations" className="text-xs underline underline-offset-2">Review</Link></div></div>{data.pendingEscalations.length===0?<p className="p-5 text-sm text-muted">No decisions waiting.</p>:<ul className="divide-y divide-line">{data.pendingEscalations.slice(0,5).map(e=><li key={e.escalationId} className="p-4"><div className="flex justify-between gap-3"><Link to={`/cases/${e.caseId}`} className="figure text-xs underline">{e.caseId}</Link><Status value={e.riskLevel}/></div><p className="mt-1 text-sm font-medium">{e.recommendedAction.replace(/_/g,' ')}</p><p className="mt-1 line-clamp-2 text-xs text-muted">{e.reason}</p></li>)}</ul>}</section>

        <section className="panel"><div className="border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">Safety posture</h2><p className="mt-1 text-xs text-muted">Hard backend boundaries remain independent of model output.</p></div><div className="grid grid-cols-2 gap-px bg-line"><div className="bg-surface p-4"><p className="text-micro text-muted">Refund ceiling</p><p className="figure mt-1 text-xl">{rupees(data.system.autonomousRefundCeiling)}</p><p className="mt-1 text-xs text-muted">Above this → human</p></div><div className="bg-surface p-4"><p className="text-micro text-muted">Confidence floor</p><p className="figure mt-1 text-xl">{(data.system.confidenceFloor*100).toFixed(0)}%</p><p className="mt-1 text-xs text-muted">Below this → human</p></div><div className="bg-surface p-4"><p className="text-micro text-muted">High-risk cases</p><p className="figure mt-1 text-xl">{data.summary.highRiskCases}</p></div><div className="bg-surface p-4"><p className="text-micro text-muted">Blocked actions</p><p className="figure mt-1 text-xl">{data.summary.blockedActions}</p></div></div></section>
      </div>
    </div>

    <section className="panel"><div className="border-b border-line px-4 py-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Proactive merchant signals</h2><p className="mt-1 text-xs text-muted">Detected from captured-payment/order state mismatches.</p></div><Link to="/intelligence" className="text-xs underline underline-offset-2">Open intelligence</Link></div></div>{data.anomalies.length===0?<p className="p-5 text-sm text-muted">No threshold-crossing anomalies right now.</p>:<div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{data.anomalies.map(a=><div key={a.merchantId} className="rounded border border-blocked/20 bg-blocked/5 p-4"><div className="flex items-center justify-between"><span className="figure text-xs">{a.merchantId}</span><Status value="HIGH"/></div><p className="mt-3 text-2xl font-semibold">{a.mismatchRate}%</p><p className="text-xs text-muted">payment/order mismatch</p><p className="mt-2 text-micro text-muted">{a.missingOrder} of {a.captured} captured payments lack an order</p></div>)}</div>}</section>

    <section className="panel"><div className="border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">Autonomous activity stream</h2></div><ul className="divide-y divide-line">{data.recentActivity.slice(0,10).map(e=><li key={e._id} className="flex items-start justify-between gap-4 px-4 py-3"><div><p className="text-micro text-muted">{e.event.replace(/_/g,' ')} · {e.actor}</p><p className="mt-1 text-sm">{e.summary}</p></div><div className="shrink-0 text-right"><Status value={e.outcome}/><p className="mt-1 text-micro text-muted">{shortTime(e.createdAt)}</p></div></li>)}</ul></section>
  </div>;
}
