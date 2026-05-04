import { useNavigate, useSearchParams } from 'react-router-dom';

// Landed here from PayU after a failed or cancelled payment.
// PayU posts back to our backend callback first; if status != "success" the
// backend redirects to this page (no subscription change happens).
export default function PaymentFailure() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const txnid = params.get('txnid') || '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: 32, background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, marginBottom: 8 }}>Payment didn't go through</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
          No money has been deducted from your account. If you saw a debit notification,
          it'll be auto-reversed by your bank within a few minutes — this is standard
          for cancelled or failed payments.
        </p>
        {txnid && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>
            Reference: <code>{txnid}</code>
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/pricing')}
            style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/contact')}
            style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', padding: '12px 24px', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            Contact Support
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 24 }}>
          Stuck? Email <a href="mailto:customersupport@spentyai.com" style={{ color: 'var(--brand-primary)' }}>customersupport@spentyai.com</a> with the reference above.
        </p>
      </div>
    </div>
  );
}
