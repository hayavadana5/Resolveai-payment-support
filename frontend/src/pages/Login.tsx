import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO = [
  { label: 'Support agent', email: 'agent@resolveai.dev', password: 'Agent@12345' },
  { label: 'Admin', email: 'admin@resolveai.dev', password: 'Admin@12345' },
];

export function Login() {
  const { user, signIn, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('agent@resolveai.dev');
  const [password, setPassword] = useState('Agent@12345');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center border-b border-line bg-surface px-8 py-14 lg:border-b-0 lg:border-r lg:px-16">
        <p className="text-sm text-muted">ResolveAI</p>
        <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight tracking-tight">
          A teammate that closes payment cases, not just talks about them.
        </h1>
        <p className="mt-5 max-w-sm text-muted">
          It investigates the payment, checks the policy, acts through controlled tools, then re-reads the system to
          confirm the change landed. When it should not act, it stops and brings you the evidence.
        </p>

        <ol className="mt-10 max-w-sm space-y-0 border-l border-line">
          {['Understand', 'Investigate', 'Decide', 'Act', 'Verify', 'Resolve or escalate'].map((step, index) => (
            <li key={step} className="relative py-2 pl-6 text-sm">
              <span className="figure absolute -left-px top-2.5 -translate-x-1/2 rounded-full bg-canvas px-1 text-micro text-muted">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-center justify-center px-8 py-14">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h2 className="text-xl font-semibold">Sign in</h2>

          <label className="mt-6 block text-sm font-medium" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            type="email"
            className="field mt-1.5"
            value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="mt-4 block text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="field mt-1.5"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error ? (
            <p className="mt-4 rounded border border-blocked/30 bg-blocked/5 px-3 py-2 text-sm text-blocked">{error}</p>
          ) : null}

          <button type="submit" className="btn-primary mt-6 w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="mt-8 border-t border-line pt-5">
            <p className="text-micro text-muted">Demo accounts</p>
            <div className="mt-2 space-y-1.5">
              {DEMO.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="flex w-full items-center justify-between rounded border border-line px-3 py-2 text-left text-xs hover:bg-canvas"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                  }}
                >
                  <span>{account.label}</span>
                  <span className="figure text-muted">{account.email}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
