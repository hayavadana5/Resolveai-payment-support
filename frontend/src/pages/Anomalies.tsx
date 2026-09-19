import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Loading, Status, rupees } from '../components/primitives';

interface Anomaly { merchantId:string; merchantName:string; captured:number; missingOrders:number; failureRate:number; avgAmount:number }
export function Anomalies(){
  const [items,setItems]=useState<Anomaly[]|null>(null); const [error,setError]=useState(''); const [created,setCreated]=useState('');
  const load=()=>api.get<{anomalies:Anomaly[]}>('/intelligence/anomalies').then(d=>setItems(d.anomalies)).catch(e=>setError(e instanceof Error?e.message:'Could not load anomalies.'));
  useEffect(load,[]);
  async function createCase(id:string){ setError(''); try{const d=await api.post<{case:{caseId:string}}>(`/intelligence/anomalies/${id}/case`); setCreated(d.case.caseId); load();}catch(e){setError(e instanceof Error?e.message:'Could not create incident.');}}
  if(!items)return <Loading what="merchant intelligence"/>;
  return <div className="space-y-6"><header><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Proactive Intelligence</h1><p className="mt-1 text-sm text-muted">ResolveAI looks for payment/order failure clusters before they become a support backlog.</p></div><span className="rounded border border-line px-2.5 py-1 text-xs">{items.length} anomaly signal(s)</span></div></header>
    {error?<p className="rounded border border-blocked/30 bg-blocked/5 px-4 py-3 text-sm text-blocked">{error}</p>:null}{created?<p className="rounded border border-resolved/30 bg-resolved/5 px-4 py-3 text-sm">Incident <Link className="underline" to={`/cases/${created}`}>{created}</Link> created and ready for the AI teammate.</p>:null}
    {items.length===0?<div className="panel p-10 text-center"><p className="font-medium">No actionable merchant anomalies</p><p className="mt-1 text-sm text-muted">The current transaction dataset has no cluster above the detection threshold.</p></div>:<div className="grid gap-4 xl:grid-cols-2">{items.map(a=><article key={a.merchantId} className="panel p-5"><div className="flex items-start justify-between gap-4"><div><p className="figure text-xs text-muted">{a.merchantId}</p><h2 className="mt-1 text-lg font-semibold">{a.merchantName}</h2></div><Status value={a.failureRate>=20?'HIGH':'MEDIUM'}/></div><div className="mt-5 grid grid-cols-3 gap-3"><div><p className="text-micro text-muted">Captured</p><p className="figure mt-1 text-xl">{a.captured}</p></div><div><p className="text-micro text-muted">Missing orders</p><p className="figure mt-1 text-xl">{a.missingOrders}</p></div><div><p className="text-micro text-muted">Failure rate</p><p className="figure mt-1 text-xl">{a.failureRate}%</p></div></div><p className="mt-4 text-sm text-muted">Average affected payment: {rupees(a.avgAmount)}</p><button className="btn-primary mt-5 w-full" onClick={()=>createCase(a.merchantId)}>Create autonomous incident</button></article>)}</div>}
  </div>
}
