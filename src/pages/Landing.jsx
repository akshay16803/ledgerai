import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  Brain, EnvelopeSimple, ChartPie, ArrowsLeftRight,
  Shield, ArrowRight, CheckCircle,
  Files, TrendUp, Plugs, Sparkle
} from '@phosphor-icons/react';

const features = [
  { icon: Brain, title: 'AI-Powered Processing', desc: 'SpentyAI analyses your emails and SMS to automatically detect and record transactions.' },
  { icon: ArrowsLeftRight, title: 'Double-Entry Bookkeeping', desc: 'Every transaction affects two accounts, maintaining perfect accounting integrity.' },
  { icon: EnvelopeSimple, title: 'Email & SMS Sync', desc: 'Connect Gmail and Outlook. Transactions are extracted and categorised automatically.' },
  { icon: ChartPie, title: 'Real-Time Reports', desc: 'Income, expenses, and cash flow projections updated the moment a transaction is recorded.' },
  { icon: Shield, title: 'Bank Reconciliation', desc: 'Upload statements — even password-protected or loan PDFs. AI matches, audits, and auto-corrects the books.' },
  { icon: TrendUp, title: '24-Month Cash Flow', desc: 'See the next two years before they happen. Recurring payments are detected automatically to power precise forward projections.' },
  { icon: Files, title: 'Records Vault', desc: 'Every source email, attachment, and .eml receipt is stored alongside its transaction — audit-ready the moment you need it.' },
];

const steps = [
  { icon: Plugs, label: 'Step 01', title: 'Connect your inbox', desc: 'Link Gmail or Outlook in under a minute. SpentyAI starts reading only transaction-related messages.' },
  { icon: Sparkle, label: 'Step 02', title: 'AI drafts your books', desc: 'Every receipt, invoice, and bank alert is parsed, categorised, and prepared as a double-entry draft.' },
  { icon: CheckCircle, label: 'Step 03', title: 'You approve', desc: 'Nothing posts without you. Approve in one tap — or edit first. Your ledger stays clean, always.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      {/* Nav */}
      <nav data-testid="landing-nav" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(249, 248, 246, 0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, color: 'var(--brand-primary)' }}>
          SpentyAI
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/pricing" style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>Pricing</Link>
          {user ? (
            <button data-testid="nav-dashboard-btn" onClick={() => navigate('/dashboard')} style={{
              background: 'var(--brand-primary)', color: '#fff', border: 'none',
              padding: '8px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)'
            }}>Dashboard</button>
          ) : (
            <button data-testid="nav-login-btn" onClick={() => navigate('/login')} style={{
              background: 'var(--brand-primary)', color: '#fff', border: 'none',
              padding: '8px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)'
            }}>Sign In</button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section data-testid="hero-section" style={{
        paddingTop: 160, paddingBottom: 100, textAlign: 'center',
        maxWidth: 800, margin: '0 auto', padding: '160px 24px 100px'
      }}>
        <div className="animate-fade-in" style={{ marginBottom: 16 }}>
          <span className="mono" style={{
            fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--accent-1)', fontWeight: 600
          }}>
            AI-Powered Accounting
          </span>
        </div>
        <h1 className="animate-fade-in stagger-1" style={{
          fontSize: 'clamp(2.5rem, 5vw, 3.75rem)', fontWeight: 500,
          lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 24,
          color: 'var(--text-primary)'
        }}>
          Your finances,<br />
          <span style={{ color: 'var(--accent-1)', fontStyle: 'italic' }}>understood</span> by AI
        </h1>
        <p className="animate-fade-in stagger-2" style={{
          fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.7,
          maxWidth: 560, margin: '0 auto 40px'
        }}>
          SpentyAI reads your emails and messages, detects transactions, and maintains 
          double-entry books — automatically. You just approve.
        </p>
        <div className="animate-fade-in stagger-3" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button data-testid="hero-get-started-btn" onClick={handleGetStarted} style={{
            background: 'var(--brand-primary)', color: '#fff', border: 'none',
            padding: '14px 32px', borderRadius: 2, fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'transform 0.2s ease, background 0.2s ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = '#2A463D'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'var(--brand-primary)'; }}
          >
            Get Started Free <ArrowRight size={16} weight="bold" />
          </button>
          <button data-testid="hero-pricing-btn" onClick={() => navigate('/pricing')} style={{
            background: 'transparent', color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)', padding: '14px 32px',
            borderRadius: 2, fontSize: 15, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'var(--font-body)', transition: 'background 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            View Pricing
          </button>
        </div>
      </section>

      {/* How it works */}
      <section data-testid="how-it-works-section" style={{
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span className="mono" style={{
              fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--accent-1)', fontWeight: 600
            }}>
              How it works
            </span>
            <h2 style={{
              fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', marginTop: 12,
              fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)'
            }}>
              Three steps.<br />Zero spreadsheets.
            </h2>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 24, position: 'relative'
          }}>
            {steps.map(({ icon: Icon, label, title, desc }, i) => (
              <div key={title} className={`animate-slide-up stagger-${i + 1}`} style={{
                position: 'relative',
                padding: 32,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 2
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 24
                }}>
                  <Icon size={28} weight="duotone" style={{ color: 'var(--accent-1)' }} />
                  <span className="mono" style={{
                    fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
                    color: 'var(--text-muted)', fontWeight: 600
                  }}>
                    {label}
                  </span>
                </div>
                <h3 style={{
                  fontSize: 18, fontWeight: 600, marginBottom: 8,
                  fontFamily: 'var(--font-body)', color: 'var(--text-primary)'
                }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section data-testid="features-section" style={{
        maxWidth: 1100, margin: '0 auto', padding: '60px 24px 100px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent-1)', fontWeight: 600 }}>
            Features
          </span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', marginTop: 12, fontWeight: 500, letterSpacing: '-0.02em' }}>
            Everything your accountant does,<br />but faster
          </h2>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 24
        }}>
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className={`animate-slide-up stagger-${i % 5 + 1}`} style={{
              padding: 32, background: 'var(--bg-secondary)', borderRadius: 2,
              border: '1px solid var(--border-subtle)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'default'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(26,54,45,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Icon size={28} weight="duotone" style={{ color: 'var(--accent-1)', marginBottom: 16 }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, fontFamily: 'var(--font-body)' }}>{title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        background: 'var(--brand-primary)', color: '#fff',
        padding: '80px 24px', textAlign: 'center'
      }}>
        <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 500, marginBottom: 16 }}>
          Ready to automate your books?
        </h2>
        <p style={{ fontSize: 16, opacity: 0.7, marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' }}>
          Join thousands of businesses who trust SpentyAI to keep their accounts in perfect order.
        </p>
        <button data-testid="cta-get-started-btn" onClick={handleGetStarted} style={{
          background: '#fff', color: 'var(--brand-primary)', border: 'none',
          padding: '14px 36px', borderRadius: 2, fontSize: 15, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          transition: 'transform 0.2s ease'
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          Start Free Trial
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px 24px', textAlign: 'center',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          SpentyAI {new Date().getFullYear()}. Autonomous accounting software.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          <a href="/privacy" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'underline' }}>Privacy Policy</a>
          <a href="/terms" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'underline' }}>Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
