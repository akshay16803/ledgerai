import { useNavigate } from 'react-router-dom';

export default function ContactUs() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
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

        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600,
          color: 'var(--text-primary)', marginBottom: 8,
        }}>
          Contact Us
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 40 }}>
          We're here to help — reach out any time.
        </p>

        <div style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.75, fontFamily: 'var(--font-body)' }}>

          {/* Business Details */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600,
              color: 'var(--text-primary)', marginBottom: 16,
            }}>
              Business Information
            </h2>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {[
                  ['Trade Name', 'SpentyAI'],
                  ['Legal Entity', 'SpentyAI (Sole Proprietorship)'],
                  ['Registered Address', '102, Midrise Street, M27, SS Infinitus Phase 2-B, Lasudiya Mauri, Indore, Madhya Pradesh, India'],
                  ['Website', 'www.spentyai.com'],
                  ['Customer Support Email', 'customersupport@spentyai.com'],
                  ['Business Email', 'hello@spentyai.com'],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{
                      padding: '12px 0', fontWeight: 600, width: 200,
                      color: 'var(--text-primary)', verticalAlign: 'top',
                    }}>
                      {label}
                    </td>
                    <td style={{ padding: '12px 0 12px 16px', color: 'var(--text-secondary)' }}>
                      {label.includes('Email') ? (
                        <a href={`mailto:${value}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
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
          </div>

          {/* Support channels */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600,
              color: 'var(--text-primary)', marginBottom: 16,
            }}>
              Get Help
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <ContactCard
                icon="✉️"
                title="Email Support"
                description="For billing, account issues, or general questions."
                action="customersupport@spentyai.com"
                href="mailto:customersupport@spentyai.com"
              />
              <ContactCard
                icon="💬"
                title="In-App Support"
                description="Raise a ticket from within the SpentyAI app. We respond within 24 hours."
                action="Open App → More → Support"
                href={null}
              />
              <ContactCard
                icon="📖"
                title="Help Center"
                description="Step-by-step guides and frequently asked questions."
                action="View Help Center"
                href="/help"
              />
            </div>
          </div>

          {/* Response times */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600,
              color: 'var(--text-primary)', marginBottom: 16,
            }}>
              Response Times
            </h2>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li style={{ marginBottom: 8 }}><strong>General queries:</strong> within 1–2 business days.</li>
              <li style={{ marginBottom: 8 }}><strong>Billing &amp; refund requests:</strong> within 2 business days; resolved within 7 business days.</li>
              <li style={{ marginBottom: 8 }}><strong>Account access issues:</strong> within 24 hours.</li>
              <li><strong>Security concerns:</strong> same business day.</li>
            </ul>
          </div>

          {/* Grievance */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600,
              color: 'var(--text-primary)', marginBottom: 16,
            }}>
              Grievance Redressal (India)
            </h2>
            <p>
              In accordance with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020,
              if you have a grievance or complaint regarding our services, please contact our Grievance Officer:
            </p>
            <div style={{
              marginTop: 16,
              padding: '16px 20px',
              background: 'var(--bg-secondary)',
              borderRadius: 10,
              border: '1px solid var(--border-subtle)',
            }}>
              <p style={{ margin: 0 }}>
                <strong>Grievance Officer:</strong> SpentyAI Support Team<br />
                <strong>Email:</strong>{' '}
                <a href="mailto:customersupport@spentyai.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  customersupport@spentyai.com
                </a><br />
                <strong>Website:</strong>{' '}
                <a href="https://www.spentyai.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  www.spentyai.com
                </a>
              </p>
              <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Complaints are acknowledged within 48 hours and resolved within 30 days.
              </p>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600,
              color: 'var(--text-primary)', marginBottom: 16,
            }}>
              Useful Links
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {[
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Refund & Cancellation Policy', href: '/refund-policy' },
                { label: 'Pricing', href: '/pricing' },
                { label: 'About Us', href: '/about' },
              ].map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  style={{
                    fontSize: 13, color: 'var(--accent)', textDecoration: 'underline',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactCard({ icon, title, description, action, href }) {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--bg-secondary)',
      borderRadius: 12,
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <h3 style={{
        fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600,
        color: 'var(--text-primary)', margin: '0 0 8px',
      }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
        {description}
      </p>
      {href ? (
        <a href={href} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
          {action} →
        </a>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{action}</span>
      )}
    </div>
  );
}
