import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ModeTag } from './primitives';
import type { SystemModes } from '../api/types';

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/control-plane', label: 'AI Control Plane' },
  { to: '/demo', label: 'Judge Demo' },
  { to: '/cases', label: 'Cases' },
  { to: '/email-inbox', label: 'Email Inbox' },
  { to: '/recommendations', label: 'AI Recommendations' },
  { to: '/teammates', label: 'AI Teammates' },
  { to: '/escalations', label: 'Escalations' },
  { to: '/audit', label: 'Audit trail' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/intelligence', label: 'Proactive Intelligence' },
];

export function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [modes, setModes] = useState<SystemModes | null>(null);

  useEffect(() => {
    api.get<SystemModes>('/cases/meta/modes').then(setModes).catch(() => setModes(null));
  }, []);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-surface lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-5 py-5 lg:block">
          <div>
            <p className="text-lg font-semibold tracking-tight">ResolveAI</p>
            <p className="text-micro text-muted">Payment support operations</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col lg:gap-0.5">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded px-3 py-2 text-sm ${
                    isActive ? 'bg-ink text-white' : 'text-muted hover:bg-canvas hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="hidden border-t border-line px-5 py-4 lg:block">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-micro text-muted">{user?.role.replace('_', ' ').toLowerCase()}</p>
          <button
            type="button"
            className="mt-3 text-xs text-muted underline underline-offset-2 hover:text-ink"
            onClick={() => {
              signOut();
              navigate('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0">
        {modes ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-6 py-2.5">
            <ModeTag label="AI" value={modes.aiMode} live={modes.aiMode === 'GEMINI'} />
            <ModeTag label="Memory" value={modes.memoryMode} live={modes.memoryMode === 'COGNEE'} />
            <ModeTag label="Workflows" value={modes.workflowMode} live={modes.workflowMode === 'N8N'} />
            <span className="ml-auto text-micro text-muted">
              Autonomous refund ceiling ₹{modes.autonomousRefundCeiling.toLocaleString('en-IN')} · confidence floor{' '}
              {modes.minAutonomousConfidence}
            </span>
          </div>
        ) : null}
        <div className="px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
