import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './contexts/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Accounts from './pages/Accounts.jsx';
import Categories from './pages/Categories.jsx';
// Ledger removed — merged into Transactions page
import Pricing from './pages/Pricing.jsx';
import Billing from './pages/Billing.jsx';
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
import Invoices from './pages/Invoices.jsx';
import Customers from './pages/Customers.jsx';
import Purchases from './pages/Purchases.jsx';
import Vendors from './pages/Vendors.jsx';
import AppLayout from './components/AppLayout.jsx';

function ProtectedRoute({ children, requireSubscription = true }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <span className="mono" style={{ color: 'var(--text-muted)' }}>Loading...</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Gate behind subscription — redirect to billing if no active plan
  if (requireSubscription && user.subscription_status !== 'active') {
    return <Navigate to="/billing" replace />;
  }
  return children;
}

export default function App() {
  // Global: prevent rapid double-clicks on submit/guarded buttons without
  // flipping `disabled` mid-dispatch — that was suppressing the form's
  // submit activation (some browsers skip requestSubmit when the submit
  // button is disabled by the time activation runs, which is after the
  // capture phase). Use a per-button timestamp and cancel only the second
  // click in a rapid pair; the first click always goes through.
  useEffect(() => {
    const handler = (e) => {
      const btn = e.target.closest('button[type="submit"], button[data-guard]');
      if (!btn) return;
      const now = Date.now();
      const last = Number(btn.dataset.lastClickTs || 0);
      if (last && now - last < 500) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      btn.dataset.lastClickTs = String(now);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/billing" element={<ProtectedRoute requireSubscription={false}><Billing /></ProtectedRoute>} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><AppLayout><Transactions /></AppLayout></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><AppLayout><Accounts /></AppLayout></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute><AppLayout><Categories /></AppLayout></ProtectedRoute>} />
      <Route path="/ledger" element={<Navigate to="/transactions" replace />} /> {/* Redirect old ledger URL */}
      <Route path="/cashflow" element={<ProtectedRoute><AppLayout><CashFlow /></AppLayout></ProtectedRoute>} />
      <Route path="/reconciliation" element={<ProtectedRoute><AppLayout><Reconciliation /></AppLayout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
      <Route path="/email-sync" element={<ProtectedRoute><AppLayout><EmailSync /></AppLayout></ProtectedRoute>} />
      <Route path="/records" element={<ProtectedRoute><AppLayout><Records /></AppLayout></ProtectedRoute>} />
      <Route path="/past-insights" element={<ProtectedRoute><AppLayout><TaxSummary /></AppLayout></ProtectedRoute>} />
      <Route path="/feature-requests" element={<ProtectedRoute><AppLayout><FeatureRequests /></AppLayout></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><AppLayout><Support /></AppLayout></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><AppLayout><Invoices /></AppLayout></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><AppLayout><Customers /></AppLayout></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute><AppLayout><Purchases /></AppLayout></ProtectedRoute>} />
      <Route path="/vendors" element={<ProtectedRoute><AppLayout><Vendors /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
