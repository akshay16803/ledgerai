import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './contexts/AuthContext.jsx';
import { trackPageView } from './lib/pixel';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Landing from './pages/Landing.jsx';
import Features from './pages/Features.jsx';
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
import DeleteAccount from './pages/DeleteAccount.jsx';
import RefundPolicy from './pages/RefundPolicy.jsx';
import ShippingPolicy from './pages/ShippingPolicy.jsx';
import PaymentSuccess from './pages/PaymentSuccess.jsx';
import PaymentFailure from './pages/PaymentFailure.jsx';
import ContactUs from './pages/ContactUs.jsx';
import AboutUs from './pages/AboutUs.jsx';
import Records from './pages/Records.jsx';
import TaxSummary from './pages/TaxSummary.jsx';
import Settings from './pages/Settings.jsx';
import Support from './pages/Support.jsx';
import HelpCenter from './pages/HelpCenter.jsx';
import Invoices from './pages/Invoices.jsx';
import Customers from './pages/Customers.jsx';
import Purchases from './pages/Purchases.jsx';
import Vendors from './pages/Vendors.jsx';
import AccountDetail from './pages/AccountDetail.jsx';
import AppLayout from './components/AppLayout.jsx';

/** Wrap each page in an ErrorBoundary so a crash keeps the sidebar intact. */
function PageBoundary({ children }) {
  return <ErrorBoundary fullScreen={false}>{children}</ErrorBoundary>;
}

function ProtectedRoute({ children, requireSubscription = false }) {
  // Pivot 2026-05-13: SpentyAI is free for every signed-in user.
  // requireSubscription default flipped to false. The only routes that
  // should still pass requireSubscription={true} are the EmailSync +
  // SMSSync pages (gated as the paid Premium tier); everything else
  // just requires a signed-in user.
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <span className="mono" style={{ color: 'var(--text-muted)' }}>Loading...</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Premium-only routes (Email Sync, SMS Sync) bounce to Billing if the
  // user doesn't have an active subscription. All other routes are free
  // for signed-in users.
  if (requireSubscription && user.subscription_status !== 'active') {
    return <Navigate to="/billing?reason=premium_required" replace />;
  }
  return children;
}

export default function App() {
  // Meta Pixel: fire PageView on every SPA route change. The base Pixel
  // snippet in index.html only fires PageView on initial load — React Router
  // navigations don't trigger a full page load, so we fire manually here.
  const location = useLocation();
  useEffect(() => {
    trackPageView();
  }, [location.pathname, location.search]);

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
      <Route path="/features" element={<Features />} />
      <Route path="/login" element={<Login />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/billing" element={<ProtectedRoute requireSubscription={false}><Billing /></ProtectedRoute>} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/delete-account" element={<DeleteAccount />} />
      <Route path="/refund-policy" element={<RefundPolicy />} />
      <Route path="/shipping-policy" element={<ShippingPolicy />} />
      <Route path="/shipping" element={<ShippingPolicy />} />
      <Route path="/payment-success" element={<PaymentSuccess />} />
      <Route path="/payment-failure" element={<PaymentFailure />} />
      <Route path="/contact" element={<ContactUs />} />
      <Route path="/about" element={<AboutUs />} />
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><PageBoundary><Dashboard /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><AppLayout><PageBoundary><Transactions /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><AppLayout><PageBoundary><Accounts /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/accounts/:accountId" element={<ProtectedRoute><AppLayout><PageBoundary><AccountDetail /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute><AppLayout><PageBoundary><Categories /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/ledger" element={<Navigate to="/transactions" replace />} /> {/* Redirect old ledger URL */}
      <Route path="/cashflow" element={<ProtectedRoute><AppLayout><PageBoundary><CashFlow /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/reconciliation" element={<ProtectedRoute><AppLayout><PageBoundary><Reconciliation /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><AppLayout><PageBoundary><Reports /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/email-sync" element={<ProtectedRoute requireSubscription={true}><AppLayout><PageBoundary><EmailSync /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/records" element={<ProtectedRoute><AppLayout><PageBoundary><Records /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/past-insights" element={<ProtectedRoute><AppLayout><PageBoundary><TaxSummary /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/feature-requests" element={<ProtectedRoute><AppLayout><PageBoundary><FeatureRequests /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><AppLayout><PageBoundary><Support /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><AppLayout><PageBoundary><Invoices /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><AppLayout><PageBoundary><Customers /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/purchases" element={<ProtectedRoute><AppLayout><PageBoundary><Purchases /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/vendors" element={<ProtectedRoute><AppLayout><PageBoundary><Vendors /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><PageBoundary><Settings /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><AppLayout><PageBoundary><HelpCenter /></PageBoundary></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
