import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Loading, Status, rupees, shortTime } from '../components/primitives';
import type { Customer, SupportCase, Transaction } from '../api/types';

export function Cases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<SupportCase[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [caseName, setCaseName] = useState('');
  const [issue, setIssue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ cases: SupportCase[] }>('/cases').then((d) => setCases(d.cases));
    api.get<{ customers: Customer[] }>('/reference/customers').then((d) => setCustomers(d.customers));
  }, []);

  useEffect(() => {
    if (!customerId) {
      setTransactions([]);
      setTransactionId('');
      return;
    }
    api
      .get<{ transactions: Transaction[] }>(`/reference/transactions?customerId=${customerId}`)
      .then((d) => setTransactions(d.transactions));
  }, [customerId]);

  async function createCase(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await api.post<{ case: SupportCase }>('/cases', {
        customerId,
        transactionId: transactionId || undefined,
        caseName,
        issue,
      });
      navigate(`/cases/${created.case.caseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The case could not be created.');
    } finally {
      setBusy(false);
    }
  }

  const visible = (cases ?? []).filter(
    (c) => !filter || c.status === filter
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <select
            className="field w-auto text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {['OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED', 'CLOSED'].map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        {!cases ? (
          <Loading what="cases" />
        ) : (
          <div className="panel mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-micro text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Case</th>
                  <th className="px-4 py-2.5 font-medium">Case</th>
                  <th className="px-4 py-2.5 font-medium">Issue</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Risk</th>
                  <th className="px-4 py-2.5 font-medium">Confidence</th>
                  <th className="px-4 py-2.5 font-medium">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((c) => (
                  <tr key={c.caseId} className="hover:bg-canvas">
                    <td className="px-4 py-2.5">
                      <Link to={`/cases/${c.caseId}`} className="figure text-xs underline underline-offset-2">
                        {c.caseId}
                      </Link>
                    </td>
                    <td className="max-w-xs px-4 py-2.5"><span className="line-clamp-1 font-medium">{c.caseName}</span></td>
                    <td className="max-w-md px-4 py-2.5"><span className="line-clamp-1">{c.issue}</span></td>
                    <td className="px-4 py-2.5">
                      <Status value={c.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Status value={c.riskLevel} />
                    </td>
                    <td className="figure px-4 py-2.5 text-xs">
                      {c.aiConfidence ? `${(c.aiConfidence * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">{shortTime(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">No cases match that status.</p>
            ) : null}
          </div>
        )}
      </div>

      <form onSubmit={createCase} className="panel h-fit p-4">
        <h2 className="text-sm font-semibold">Open a case</h2>
        <p className="mt-1 text-xs text-muted">Pick the customer and the payment they are asking about.</p>

        <label className="mt-4 block text-sm font-medium" htmlFor="customer">
          Customer
        </label>
        <select
          id="customer"
          className="field mt-1.5"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          required
        >
          <option value="">Select a customer</option>
          {customers.map((c) => (
            <option key={c.customerId} value={c.customerId}>
              {c.name} · {c.customerId}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium" htmlFor="transaction">
          Transaction
        </label>
        <select
          id="transaction"
          className="field mt-1.5"
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          disabled={!customerId}
        >
          <option value="">No specific transaction</option>
          {transactions.map((t) => (
            <option key={t.transactionId} value={t.transactionId}>
              {t.transactionId} · {rupees(t.amount)} · {t.status.toLowerCase()}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium" htmlFor="caseName">
          Case name
        </label>
        <input
          id="caseName"
          className="field mt-1.5"
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          placeholder="Payment deducted but order missing"
          required
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="issue">
          What the customer said
        </label>
        <textarea
          id="issue"
          className="field mt-1.5 h-28 resize-none"
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          placeholder="₹2,499 was deducted but my order wasn't placed."
          required
        />

        {error ? (
          <p className="mt-3 rounded border border-blocked/30 bg-blocked/5 px-3 py-2 text-xs text-blocked">{error}</p>
        ) : null}

        <button type="submit" className="btn-primary mt-4 w-full" disabled={busy}>
          {busy ? 'Opening…' : 'Open case'}
        </button>
      </form>
    </div>
  );
}
