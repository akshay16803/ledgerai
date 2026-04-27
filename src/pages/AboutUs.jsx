import { useNavigate, Link } from 'react-router-dom';

const features = [
  { icon: '🤖', title: 'AI-Powered Bookkeeping', desc: 'Automatically reads your Gmail, Outlook, and SMS to log transactions — no manual entry.' },
  { icon: '📊', title: 'Real-Time Reports', desc: 'Cash flow, P&L, and tax summaries updated the moment a new transaction is recorded.' },
  { icon: '🧾', title: 'Invoices & Bills', desc: 'Create GST-ready sales invoices and track purchases in minutes.' },
  { icon: '🔁', title: 'Smart Reconciliation', desc: 'Upload your bank statement and let AI match transactions automatically.' },
  { icon: '🌐', title: 'Works Everywhere', desc: 'Web app, iOS, and Android — your accounts are always in sync.' },
  { icon: '🇮🇳', title: 'Built for India', desc: 'INR-first, GST-aware, designed for Indian SMBs, freelancers, and solopreneurs.' },
];

const plans = [
  { name: 'Monthly', price: '₹199', period: '/month', desc: 'Flexible, cancel anytime.' },
  { name: 'Quarterly', price: '₹449', period: '/3 months', desc: 'Save 25% vs monthly.' },
  { name: 'Yearly', price: '₹1,499', period: '/year', desc: 'Best value — save 37%.' },
  { name: 'Lifetime', price: '₹9,999', period: 'one-time', desc: 'Pay once, use forever.' },
];

export default function AboutUs() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
            marginBottom: 32, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          &larr; Back
        </button>

        {/* Hero */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: 16,
          }}>
            About SpentyAI
          </h1>
          <p style={{
            fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.75,
            maxWidth: 620, fontFamily: 'var(--font-body)',
          }}>
            SpentyAI is an autonomous accounting platform built for Indian small businesses, freelancers, and
            solopreneurs. We connect to your email and SMS to automatically record transactions, generate
            GST-ready invoices, and produce instant financial reports — so you spend less time on bookkeeping
            and more time on your business.
          </p>
        </div>

        {/* Mission */}
        <Section title="Our Mission">
          <p>
            Accounting software in India has historically been designed for accountants, not business owners.
            SpentyAI flips that. Our goal is to make financial clarity effortless — every rupee tracked
            automatically, every report ready without spreadsheets, every compliance requirement handled in the
            background.
          </p>
          <p style={{ marginTop: 12 }}>
            We believe every small business deserves the same financial intelligence that large enterprises pay
            lakhs for — at a price that makes sense for an SMB.
          </p>
        </Section>

        {/* What we offer */}
        <Section title="What We Offer">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 8 }}>
            {features.map(f => (
              <div key={f.title} style={{
                padding: 20, background: 'var(--bg-secondary)',
                borderRadius: 12, border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{f.icon}</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 600,
                  color: 'var(--text-primary)', margin: '0 0 6px',
                }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* Pricing */}
        <Section title="Transparent Pricing in INR">
          <p>
            All SpentyAI subscriptions are priced in Indian Rupees (₹) with no hidden fees. You can cancel any
            time from within the app. Prices include access to all features — there are no paywalled modules
            after subscribing.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
            {plans.map(p => (
              <div key={p.name} style={{
                padding: '16px 20px', background: 'var(--bg-secondary)',
                borderRadius: 10, border: '1px solid var(--border-subtle)', textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700,
                  color: 'var(--text-primary)', marginBottom: 2,
                }}>
                  {p.price}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{p.period}</div>
                <div style={{
                  fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 600,
                  color: 'var(--text-primary)', marginBottom: 4,
                }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.desc}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
            All prices are in Indian Rupees (INR) and inclusive of applicable taxes.{' '}
            <Link to="/pricing" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
              Full pricing details →
            </Link>
          </p>
        </Section>

        {/* Business details */}
        <Section title="Business Details">
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {[
                ['Trade Name', 'SpentyAI'],
                ['Legal Entity', 'SpentyAI (Sole Proprietorship)'],
                ['Country of Operation', 'India'],
                ['Website', 'www.spentyai.com'],
                ['Support Email', 'support@spentyai.com'],
                ['Currency', 'Indian Rupees (INR, ₹)'],
              ].map(([label, value]) => (
                <tr key={label} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{
                    padding: '12px 0', fontWeight: 600, width: 220,
                    color: 'var(--text-primary)', verticalAlign: 'top',
                    fontFamily: 'var(--font-body)',
                  }}>
                    {label}
                  </td>
                  <td style={{ padding: '12px 0 12px 16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                    {label === 'Support Email' ? (
                      <a href="mailto:support@spentyai.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        {value}
                      </a>
                    ) : label === 'Website' ? (
                      <a href="https://www.spentyai.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        {value}
                      </a>
                    ) : value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Links */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {[
            { label: 'Contact Us', href: '/contact' },
            { label: 'Pricing', href: '/pricing' },
            { label: 'Terms of Service', href: '/terms' },
            { label: 'Privacy Policy', href: '/privacy' },
            { label: 'Refund & Cancellation Policy', href: '/refund-policy' },
          ].map(({ label, href }) => (
            <a key={href} href={href} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'underline' }}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{
        fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: 16,
      }}>
        {title}
      </h2>
      <div style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.75, fontFamily: 'var(--font-body)' }}>
        {children}
      </div>
    </div>
  );
}
