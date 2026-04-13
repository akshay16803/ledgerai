import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Check, ArrowLeft } from '@phosphor-icons/react';

const plans = [
  {
    name: 'Starter',
    price: 0,
    period: 'forever',
    desc: 'For individuals getting started with personal finance tracking.',
    features: [
      'Up to 2 accounts',
      '50 transactions/month',
      'Manual entry only',
      'Basic categories',
      'Ledger view',
      'Community support',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: 499,
    period: '/month',
    desc: 'For freelancers and small businesses needing AI automation.',
    features: [
      'Unlimited accounts',
      'Unlimited transactions',
      'Gmail & Outlook sync',
      'AI email processing (SpentyAI)',
      'Recurring detection',
      'Bank reconciliation',
      'Reports & analytics',
      'Cash flow projections',
      'Priority email support',
    ],
    cta: 'Start 14-Day Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 1999,
    period: '/month',
    desc: 'For growing businesses with advanced needs.',
    features: [
      'Everything in Professional',
      'SMS processing (mobile app)',
      'Multi-user access',
      'Custom categories & workflows',
      'API access',
      'Statement reconciliation',
      'Dedicated account manager',
      'Phone & video support',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
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

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '120px 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent-1)', fontWeight: 600 }}>
            Pricing
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 500, letterSpacing: '-0.02em', marginTop: 12, marginBottom: 16 }}>
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto' }}>
            Start free. Scale as your business grows. No hidden fees.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }}>
          {plans.map(plan => (
            <div key={plan.name} data-testid={`pricing-${plan.name.toLowerCase()}`} style={{
              background: plan.highlighted ? 'var(--brand-primary)' : '#fff',
              color: plan.highlighted ? '#fff' : 'var(--text-primary)',
              border: plan.highlighted ? 'none' : '1px solid var(--border-subtle)',
              borderRadius: 2, padding: 36,
              position: 'relative',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(26,54,45,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {plan.highlighted && (
                <div className="mono" style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--accent-1)', color: '#fff', padding: '4px 16px',
                  borderRadius: 2, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em'
                }}>
                  MOST POPULAR
                </div>
              )}
              <h3 style={{ fontSize: 18, fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: 8 }}>{plan.name}</h3>
              <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 20, lineHeight: 1.5 }}>{plan.desc}</p>
              <div style={{ marginBottom: 24 }}>
                <span className="mono" style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em' }}>
                  {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                </span>
                {plan.price > 0 && <span style={{ fontSize: 14, opacity: 0.6 }}>{plan.period}</span>}
              </div>
              <ul style={{ listStyle: 'none', marginBottom: 28 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>
                    <Check size={14} weight="bold" style={{ color: plan.highlighted ? '#8E9E82' : 'var(--success)', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <button data-testid={`pricing-cta-${plan.name.toLowerCase()}`}
                onClick={() => navigate(user ? '/dashboard' : '/login')}
                style={{
                  width: '100%', padding: '12px 20px', borderRadius: 2, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s',
                  background: plan.highlighted ? '#fff' : 'var(--brand-primary)',
                  color: plan.highlighted ? 'var(--brand-primary)' : '#fff',
                  border: 'none'
                }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
