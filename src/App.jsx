import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Accounts from './pages/Accounts.jsx';
import Categories from './pages/Categories.jsx';
import Ledger from './pages/Ledger.jsx';
import Pricing from './pages/Pricing.jsx';
import FeatureRequests from './pages/FeatureRequests.jsx';
import EmailSync from './pages/EmailSync.jsx';
import CashFlow from './pages/CashFlow.jsx';
import Reconciliation from './pages/Reconciliation.jsx';
import Reports from './pages/Reports.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Privacy from './pages/Privacy.jsx';
import Terms from './pages/Terms.jsx';
import Records from './pages/Records.jsx';
import TaxSummary from './pages/TaxSummary.jsx';
import Settings from './pages/Settings.jsx';
import Support from './pages/Support.jsx';
import AppLayout from './components/AppLayout.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <span className="mono" style={{ color: 'var(--text-muted)' }}>Loading...</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><AppLayout><Transactions /></AppLayout></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><AppLayout><Accounts /></AppLayout></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute><AppLayout><Categories /></AppLayout></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute><AppLayout><Ledger /></AppLayout></ProtectedRoute>} />
      <Route path="/cashflow" element={<ProtectedRoute><AppLayout><CashFlow /></AppLayout></ProtectedRoute>} />
      <Route path="/reconciliation" element={<ProtectedRoute><AppLayout><Reconciliation /></AppLayout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
      <Route path="/email-sync" element={<ProtectedRoute><AppLayout><EmailSync /></AppLayout></ProtectedRoute>} />
      <Route path="/records" element={<ProtectedRoute><AppLayout><Records /></AppLayout></ProtectedRoute>} />
      <Route path="/past-insights" element={<ProtectedRoute><AppLayout><TaxSummary /></AppLayout></ProtectedRoute>} />
      <Route path="/feature-requests" element={<ProtectedRoute><AppLayout><FeatureRequests /></AppLayout></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><AppLayout><Support /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
