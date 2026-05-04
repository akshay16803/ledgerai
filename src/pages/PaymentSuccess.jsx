import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

// Landed here from PayU after a successful payment.
// PayU's callback handler on the backend has already verified the response
// hash and activated the subscription on the user record. We just confirm
// the order is paid (lightweight poll) and refresh local auth state.
export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const txnid = params.get('txnid') || '';
  const { checkAuth } = useAuth();
  const [status, setStatus] = useState('verifying');
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const res = await api.get(`/api/payments/payu/status/${encodeURIComponent(txnid)}`);
        if (cancelled) return;
        if (res?.paid) {
          setPlan(res.plan);
          setStatus('paid');
          await checkAuth();
          return;
        }
      } catch {
        /* keep polling */
      }
      attempts += 1;
      if (attempts < 10 && !cancelled) {
        setTimeout(poll, 1500);
      } else if (!cancelled) {
        // Backend didn't see "paid" yet — payment may still be settling.
        setStatus('pending');
      }
    };

    if (txnid) poll();
    else setStatus('missing');

    return () => { cancelled = true; };
  }, [txnid, checkAuth]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: 32, background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, marginBottom: 8 }}>Confirming your payment…</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              This usually takes a few seconds. Please don't close this page.
            </p>
          </>
        )}
        {status === 'paid' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, marginBottom: 8 }}>Payment successful</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 24 }}>
              Your <strong>{plan || 'SpentyAI'}</strong> plan is now active. A receipt will be emailed to you shortly.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              Go to Dashboard
            </button>
          </>
        )}
        {status === 'pending' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🕐</div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, marginBottom: 8 }}>Almost there</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 24 }}>
              We received your payment but it's still settling. Refresh this page in a minute,
              or check your email — we'll confirm as soon as it's active.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginRight: 8 }}
            >
              Refresh
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', padding: '12px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              Dashboard
            </button>
          </>
        )}
        {status === 'missing' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❓</div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, marginBottom: 8 }}>No payment to confirm</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 24 }}>
              We didn't receive a transaction reference. If you just paid and think this is wrong,
              email <a href="mailto:customersupport@spentyai.com" style={{ color: 'var(--brand-primary)' }}>customersupport@spentyai.com</a>.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              Back to Pricing
            </button>
          </>
        )}
      </div>
    </div>
  );
}
