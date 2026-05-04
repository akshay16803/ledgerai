import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../lib/api';
import { Check, Sparkle, SpinnerGap, CheckCircle, Ticket, ArrowRight, Robot } from '@phosphor-icons/react';

const plans = [
  {
    key: 'monthly',
    name: 'Monthly',
    price: 199,
    period: '/month',
    effective: '₹199/mo',
    desc: 'Flexible, cancel anytime.',
    badge: null,
    cta: 'Start 7-Day Free Trial',
    highlighted: false,
  },
  {
    key: 'quarterly',
    name: 'Quarterly',
    price: 449,
    period: '/3 months',
    effective: '₹150/mo',
    desc: 'Three months of full access.',
    badge: 'SAVE 25%',
    cta: 'Start 7-Day Free Trial',
    highlighted: false,
  },
  {
    key: 'yearly',
    name: 'Yearly',
    price: 1499,
    period: '/year',
    effective: '₹125/mo',
    desc: 'Best value for committed users.',
    badge: 'MOST POPULAR • SAVE 37%',
    cta: 'Start 7-Day Free Trial',
    highlighted: true,
  },
  {
    key: 'lifetime',
    name: 'Lifetime',
    price: 4999,
    period: 'one-time',
    effective: 'Pay once, use forever',
    desc: 'Limited launch offer.',
    badge: 'LIMITED • BEST DEAL',
    cta: 'Get Lifetime Access',
    highlighted: false,
  },
];

const includedFeatures = [
  'Unlimited accounts & transactions',
  'Gmail & Outlook sync',
  'AI email processing (SpentyAI)',
  'SMS processing (mobile app)',
  'Recurring transaction detection',
  'Bank reconciliation',
  'Reports, analytics & cash flow projections',
  'Custom categories & workflows',
  'Priority support',
];

export default function Billing() {
  const navigate = useNavigate();
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);
  const { user, checkAuth } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoActivating, setPromoActivating] = useState(false);
  const [promoValid, setPromoValid] = useState(null); // null, { valid, description } or { error }
  const [promoActivated, setPromoActivated] = useState(false);

  const handleValidatePromo = async () => {
    if (!promoCode.trim() || promoValidating) return;
    setPromoValidating(true);
    setPromoValid(null);
    try {
      const res = await api.post('/api/promo/validate', { code: promoCode.trim() });
      setPromoValid({ valid: true, description: res.description });
    } catch (e) {
      setPromoValid({ error: e.message || 'Invalid promo code' });
    } finally {
      setPromoValidating(false);
    }
  };

  const handleActivatePromo = async () => {
    if (promoActivating) return;
    setPromoActivating(true);
    try {
      await api.post('/api/promo/activate', { code: promoCode.trim() });
      setPromoActivated(true);
      await checkAuth();
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (e) {
      setPromoValid({ error: e.message || 'Activation failed' });
    } finally {
      setPromoActivating(false);
    }
  };

  const handleSelectPlan = async (planKey) => {
    if (loadingPlan) return;
    setLoadingPlan(planKey);

    try {
      const orderData = await api.post('/api/payments/create-order', { plan: planKey });

      // Auto-submit a hidden form to PayU's hosted checkout. The hash is
      // generated server-side; the PayU salt never touches the browser.
      // After payment PayU calls /api/payments/payu/callback which
      // redirects to /payment-success or /payment-failure on the website.
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = orderData.payment_url;
      form.style.display = 'none';
      Object.entries(orderData.form || {}).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value ?? '';
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      alert(err.message || 'Failed to initiate payment. Please try again.');
      setLoadingPlan(null);
    }
  };

  // If user already has an active subscription (non-lifetime), redirect to dashboard
  if (user?.subscription_status === 'active' && user?.subscription_plan !== 'lifetime') {
    navigate('/dashboard', { replace: true });
    return null;
  }

  // Lifetime users see a confirmation instead of plan selection
  const isLifetime = user?.subscription_status === 'active' && user?.subscription_plan === 'lifetime';

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.8s linear infinite; }`}</style>

      {/* Payment success banner */}
      {paymentSuccess && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          background: 'var(--brand-primary)', color: '#fff',
          padding: '14px 24px', textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
        }}>
          <CheckCircle size={18} weight="fill" />
          Payment successful! Redirecting to your dashboard...
        </div>
      )}

      {/* Promo activated banner */}
      {promoActivated && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          background: 'var(--brand-primary)', color: '#fff',
          padding: '14px 24px', textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
        }}>
          <CheckCircle size={18} weight="fill" />
          Promo code activated! Redirecting to your dashboard...
        </div>
      )}

      {/* Minimal nav */}
      <nav style={{
        background: 'rgba(249, 248, 246, 0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 40px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, color: 'var(--brand-primary)' }}>
          {s('spentyai')}
        </span>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.picture && <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />}
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.name || user.email}</span>
          </div>
        )}
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Welcome header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 12 }}>
            {isLifetime ? 'Lifetime Access' : `Welcome to SpentyAI${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
          </h1>
          {isLifetime ? (
            <>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: 'rgba(58,92,74,0.08)', border: '1px solid var(--success)',
                padding: '16px 32px', borderRadius: 2, marginBottom: 20,
              }}>
                <CheckCircle size={22} weight="fill" style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--success)' }}>Lifetime — Active</span>
              </div>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 20px', lineHeight: 1.6 }}>
                You have lifetime access to all SpentyAI features. No further payments required.
              </p>
              <button onClick={() => navigate('/dashboard')} style={{
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
                padding: '12px 28px', borderRadius: 2, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <ArrowRight size={16} weight="bold" /> Go to Dashboard
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 20px', lineHeight: 1.6 }}>
                Choose a plan to get started. Every plan includes all features — pick the billing cycle that works for you.
              </p>
              <div className="mono" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(194, 109, 92, 0.1)',
                color: 'var(--accent-1)',
                padding: '8px 16px', borderRadius: 2,
                fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase',
              }}>
                <Sparkle size={12} weight="fill" />
                7-day free trial · No charge until trial ends
              </div>
            </>
          )}
        </div>

        {!isLifetime && <>
        {/* Promo code section */}
        <div style={{
          maxWidth: 520, margin: '0 auto 40px',
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
          padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ticket size={16} style={{ color: 'var(--accent-1)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s('have_promo')}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              data-testid="promo-input"
              type="text"
              value={promoCode}
              onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoValid(null); }}
              placeholder={s('enter_code')}
              style={{
                flex: 1, padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2,
                fontSize: 13, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
                textTransform: 'uppercase', background: '#fff',
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleValidatePromo(); }}
            />
            {!promoValid?.valid ? (
              <button
                data-testid="promo-validate-btn"
                onClick={handleValidatePromo}
                disabled={!promoCode.trim() || promoValidating}
                style={{
                  padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                  cursor: !promoCode.trim() || promoValidating ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)', border: 'none',
                  background: 'var(--brand-primary)', color: '#fff',
                  opacity: !promoCode.trim() || promoValidating ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {promoValidating && <SpinnerGap size={14} className="spin" />}
                {promoValidating ? 'Checking...' : 'Apply'}
              </button>
            ) : (
              <button
                data-testid="promo-activate-btn"
                onClick={handleActivatePromo}
                disabled={promoActivating}
                style={{
                  padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                  cursor: promoActivating ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)', border: 'none',
                  background: 'var(--success)', color: '#fff',
                  opacity: promoActivating ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {promoActivating ? <SpinnerGap size={14} className="spin" /> : <CheckCircle size={14} weight="fill" />}
                {promoActivating ? 'Activating...' : 'Activate'}
              </button>
            )}
          </div>

          {/* Promo validation result */}
          {promoValid?.valid && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 2,
              background: 'rgba(58,92,74,0.06)', border: '1px solid var(--success)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Check size={14} weight="bold" style={{ color: 'var(--success)' }} />
              <span style={{ fontSize: 12.5, color: 'var(--success)', fontWeight: 500 }}>
                Valid! {promoValid.description} — click Activate to get full access.
              </span>
            </div>
          )}
          {promoValid?.error && (
            <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--error)' }}>{promoValid.error}</p>
          )}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: 520, margin: '0 auto 40px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Or choose a plan
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {/* Plan cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 20,
          alignItems: 'stretch',
          marginBottom: 56,
        }}>
          {plans.map(plan => (
            <div
              key={plan.key}
              data-testid={`billing-${plan.key}`}
              style={{
                background: plan.highlighted ? 'var(--brand-primary)' : '#fff',
                color: plan.highlighted ? '#fff' : 'var(--text-primary)',
                border: plan.highlighted ? 'none' : '1px solid var(--border-subtle)',
                borderRadius: 2,
                padding: '36px 28px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(26,54,45,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {plan.badge && (
                <div className="mono" style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: plan.highlighted ? 'var(--accent-1)' : 'var(--brand-primary)',
                  color: '#fff',
                  padding: '5px 14px',
                  borderRadius: 2,
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
                  whiteSpace: 'nowrap',
                }}>
                  {plan.badge}
                </div>
              )}

              <h3 style={{
                fontSize: 16,
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                marginBottom: 6,
                letterSpacing: '-0.01em',
              }}>{plan.name}</h3>
              <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 24, lineHeight: 1.5, minHeight: 38 }}>
                {plan.desc}
              </p>

              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span className="mono" style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  ₹{plan.price.toLocaleString('en-IN')}
                </span>
                <span style={{ fontSize: 13, opacity: 0.6 }}>{plan.period}</span>
              </div>
              <div className="mono" style={{
                fontSize: 11,
                opacity: 0.65,
                letterSpacing: '0.05em',
                marginBottom: 28,
                textTransform: 'uppercase',
              }}>
                {plan.effective}
              </div>

              <button
                data-testid={`billing-cta-${plan.key}`}
                onClick={() => handleSelectPlan(plan.key)}
                disabled={!!loadingPlan}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: 2,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: loadingPlan ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                  transition: 'all 0.2s',
                  background: plan.highlighted ? '#fff' : 'var(--brand-primary)',
                  color: plan.highlighted ? 'var(--brand-primary)' : '#fff',
                  border: 'none',
                  marginTop: 'auto',
                  opacity: loadingPlan && loadingPlan !== plan.key ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loadingPlan === plan.key && <SpinnerGap size={14} className="spin" />}
                {loadingPlan === plan.key ? 'Processing…' : plan.cta}
              </button>
            </div>
          ))}
        </div>
        </>}

        {/* Everything included */}
        <div style={{
          background: '#fff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 2,
          padding: '40px 44px',
          maxWidth: 880,
          margin: '0 auto',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span className="mono" style={{
              fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--accent-1)', fontWeight: 600,
            }}>
              Everything Included
            </span>
            <h2 style={{
              fontSize: 22, fontWeight: 500, letterSpacing: '-0.015em',
              marginTop: 8, color: 'var(--text-primary)',
            }}>
              Every plan unlocks the full SpentyAI experience
            </h2>
          </div>
          <ul style={{
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px 24px',
            margin: 0,
            padding: 0,
          }}>
            {includedFeatures.map(f => (
              <li key={f} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 14, color: 'var(--text-primary)', opacity: 0.9,
              }}>
                <Check size={14} weight="bold" style={{ color: 'var(--success)', flexShrink: 0 }} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Footnote */}
        <p style={{
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--text-secondary)',
          opacity: 0.7,
          marginTop: 32,
          maxWidth: 560,
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.6,
        }}>
          Prices in INR. GST extra where applicable. Cancel anytime during trial — no charge.
          Lifetime offer available for a limited time only.
        </p>

        {/* PayUMoney compliance: T&C + policy links at checkout */}
        <div style={{
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--text-muted)',
          marginTop: 20,
          maxWidth: 560,
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.8,
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 20,
        }}>
          By subscribing you agree to our{' '}
          <a href="/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Terms of Service</a>
          {' '}&amp;{' '}
          <a href="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Privacy Policy</a>.
          {' '}See our{' '}
          <a href="/refund-policy" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Refund &amp; Cancellation Policy</a>
          {' '}for refund timelines. Payments processed securely. Immediate digital access upon payment confirmation.{' '}
          Questions?{' '}
          <a href="/contact" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Contact us</a>.
        </div>
      </div>
    </div>
  );
}
