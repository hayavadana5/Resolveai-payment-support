import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Cases } from './pages/Cases';
import { CaseDetail } from './pages/CaseDetail';
import { Escalations } from './pages/Escalations';
import { Audit } from './pages/Audit';
import { Analytics } from './pages/Analytics';
import { Recommendations } from './pages/Recommendations';
import { Teammates } from './pages/Teammates';
import { CustomerPortal } from './pages/CustomerPortal';
import { EmailInbox } from './pages/EmailInbox';
import { PortalCase } from './pages/PortalCase';
import { Anomalies } from './pages/Anomalies';
import { ControlPlane } from './pages/ControlPlane';
import { DemoCenter } from './pages/DemoCenter';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-10 text-center text-sm text-muted">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/customer" element={<CustomerPortal />} />
          <Route path="/customer/case" element={<PortalCase />} />
          <Route element={<Protected />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/control-plane" element={<ControlPlane />} />
            <Route path="/demo" element={<DemoCenter />} />
            <Route path="/email-inbox" element={<EmailInbox />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/cases/:caseId" element={<CaseDetail />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/teammates" element={<Teammates />} />
            <Route path="/escalations" element={<Escalations />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/intelligence" element={<Anomalies />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
