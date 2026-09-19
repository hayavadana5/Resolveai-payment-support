import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Status } from '../components/primitives';

type Scenario = { id: string; title: string; customerId: string; transactionId: string; caseName: string; issue: string; narrative: string };

const stages = ['UNDERSTAND', 'INVESTIGATE', 'MEMORY', 'RISK', 'DECIDE', 'ACT', 'VERIFY', 'RESOLVE / ESCALATE'];

export function DemoCenter() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  useEffect(() => { api.get<{ scenarios: Scenario[] }>('/demo/scenarios').then((r) => setScenarios(r.scenarios)).catch(() => setMessage('Unable to load demo scenarios.')); }, []);

  const run = async (scenario: Scenario) => {
    setRunning(scenario.id); setMessage('AI teammate is taking ownership…');
    try {
      const result = await api.post<{ case: { caseId: string } }>(`/demo/scenarios/${scenario.id}/run`);
      navigate(`/cases/${result.case.caseId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Demo could not be started.');
    } finally { setRunning(null); }
  };

  return <div className="space-y-8">
    <header className="max-w-4xl">
      <p className="figure text-micro text-muted">RESOLVEAI / JUDGE MODE</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">Autonomous AI Teammate Demo Center</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Launch a complete scenario and watch the AI own the case: understand → investigate → remember → assess risk → decide → act → verify → resolve or escalate.</p>
    </header>

    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-micro font-semibold tracking-wider text-muted">THE AUTONOMY LOOP</p><p className="mt-1 text-sm text-muted">Every scenario follows the same outcome-oriented control path.</p></div>
        <Link to="/control-plane" className="btn-secondary">Open control plane</Link>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-4 xl:grid-cols-8">{stages.map((stage, i) => <div key={stage} className="rounded border border-line bg-canvas p-3"><span className="figure text-micro text-muted">0{i + 1}</span><p className="mt-2 text-xs font-medium">{stage}</p></div>)}</div>
    </section>

    {message ? <div className="rounded border border-line bg-canvas px-4 py-3 text-sm">{message}</div> : null}

    <section className="grid gap-4 lg:grid-cols-2">
      {scenarios.map((scenario) => <article key={scenario.id} className="panel p-5">
        <div className="flex items-start justify-between gap-4"><div><span className="figure text-micro text-muted">{scenario.transactionId}</span><h2 className="mt-1 text-lg font-semibold">{scenario.title}</h2></div><Status value={scenario.id === 'suspicious-payment' ? 'HIGH RISK' : scenario.id === 'high-value-refund' ? 'HUMAN APPROVAL' : 'AUTONOMOUS'}/></div>
        <p className="mt-4 text-sm font-medium">{scenario.caseName}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{scenario.issue}</p>
        <div className="mt-4 rounded border border-line bg-canvas p-3"><p className="text-micro font-semibold tracking-wider text-muted">EXPECTED DEMO BEHAVIOUR</p><p className="mt-1 text-xs leading-5 text-muted">{scenario.narrative}</p></div>
        <div className="mt-5 flex items-center justify-between gap-3"><span className="text-micro text-muted">Customer {scenario.customerId}</span><button className="btn-primary" disabled={running !== null} onClick={() => run(scenario)}>{running === scenario.id ? 'Running teammate…' : 'Launch scenario'}</button></div>
      </article>)}
    </section>

    <section className="panel p-5">
      <p className="text-micro font-semibold tracking-wider text-muted">JUDGE STORY</p>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <div><p className="font-semibold">1 · Give it a problem</p><p className="mt-1 text-xs leading-5 text-muted">A customer email or portal request becomes a named case.</p></div>
        <div><p className="font-semibold">2 · Let the team work</p><p className="mt-1 text-xs leading-5 text-muted">Specialist teammates, memory, policy and risk build the recommendation.</p></div>
        <div><p className="font-semibold">3 · Prove the outcome</p><p className="mt-1 text-xs leading-5 text-muted">n8n executes authorized actions; verification proves what changed; humans intervene only where required.</p></div>
      </div>
    </section>
  </div>;
}
