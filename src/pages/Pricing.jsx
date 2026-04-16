import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Check, ArrowLeft, Sparkle } from '@phosphor-icons/react';

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
    lifetime: false,
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
    lifetime: false,
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
    lifetime: false,
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
    lifetime: true,
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

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(249, 248, 246, 0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 40px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Link to="/" style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, color: 'var(--brand-primary)' }}>
          SpentyAI
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/" style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={14} /> Home
          </Link>
          {user ? (
            <button data-testid="pricing-dashboard-btn" onClick={() => navigate('/dashboard')} style={{
              background: 'var(--brand-primary)', color: '#fff', border: 'none',
              padding: '8px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)'
            }}>Dashboard</button>
          ) : (
            <button data-testid="pricing-signin-btn" onClick={() => navigate('/login')} style={{
              background: 'var(--brand-primary)', color: '#fff', border: 'none',
              padding: '8px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)'
            }}>Sign In</button>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px 80px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent-1)', fontWeight: 600 }}>
            Pricing
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 12, marginBottom: 16 }}>
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 20px' }}>
            One plan. Every feature. Pick the billing cycle that works for you.
          </p>
          <div className="mono" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(194, 109, 92, 0.1)',
            color: 'var(--accent-1)',
            padding: '8px 16px', borderRadius: 2,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase'
          }}>
            <Sparkle size={12} weight="fill" />
            7-day free trial · No card required
          </div>
        </div>

        {/* Plan cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 20,
          alignItems: 'stretch',
          marginBottom: 64,
        }}>
          {plans.map(plan => (
            <div
              key={plan.key}
              data-testid={`pricing-${plan.key}`}
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
                data-testid={`pricing-cta-${plan.key}`}
                onClick={() => navigate(user ? '/dashboard' : '/login')}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: 2,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  transition: 'all 0.2s',
                  background: plan.highlighted ? '#fff' : 'var(--brand-primary)',
                  color: plan.highlighted ? 'var(--brand-primary)' : '#fff',
                  border: 'none',
                  marginTop: 'auto',
                }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

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
      </div>
    </div>
  );
}
