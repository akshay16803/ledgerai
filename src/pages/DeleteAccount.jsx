import { useNavigate } from 'react-router-dom';

export default function DeleteAccount() {
  const navigate = useNavigate();
  const lastUpdated = 'May 2, 2026';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          data-testid="delete-account-back-btn"
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
            marginBottom: 32, display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          &larr; Back
        </button>

        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600,
          color: 'var(--text-primary)', marginBottom: 8
        }}>
          Delete Your SpentyAI Account
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 40 }}>
          Last updated: {lastUpdated}
        </p>

        <div style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.75, fontFamily: 'var(--font-body)' }}>
          <Section title="1. Overview">
            <p>
              You can permanently remove your SpentyAI account and all associated data at any time.
              This page explains the two ways to do that and tells you exactly what gets deleted, what
              is kept, and for how long.
            </p>
          </Section>

          <Section title="2. Delete from inside the app (recommended)">
            <p>The fastest way to delete your account is from within SpentyAI:</p>
            <ol style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Open the SpentyAI app on Android, iOS, or web.</li>
              <li>Sign in to the account you want to delete.</li>
              <li>Go to <strong>More &rarr; Settings</strong>.</li>
              <li>Scroll to the <strong>Account</strong> section and tap <strong>Delete Account</strong>.</li>
              <li>Confirm the irreversible deletion when prompted.</li>
            </ol>
            <p>
              Once confirmed, your account is queued for permanent deletion and you are signed out
              immediately on every device.
            </p>
          </Section>

          <Section title="3. Delete by email">
            <p>
              If you cannot sign in, email us from the address registered with your account and we will
              delete it for you:
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Email:</strong>{' '}
              <a
                href="mailto:customersupport@spentyai.com?subject=Delete%20my%20SpentyAI%20account"
                style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}
              >
                customersupport@spentyai.com
              </a>
              <br />
              <strong>Subject:</strong> Delete my SpentyAI account
            </p>
            <p>
              Please send the request from the same email you use to sign in. We will confirm receipt
              within 2 business days and complete the deletion within 30 days.
            </p>
          </Section>

          <Section title="4. What gets deleted">
            <p>When you delete your account, we permanently remove:</p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Your profile (name, email, profile photo from Google sign-in)</li>
              <li>All transactions, accounts, balances, and transfers</li>
              <li>Categories, subcategories, and account sub-types</li>
              <li>Invoices, customers, vendors, purchases, and bills</li>
              <li>Uploaded bank statements and reconciliation results</li>
              <li>AI Chat history and voice recordings</li>
              <li>Cash flow projections, reports, and tax summaries</li>
              <li>Connected Gmail / Outlook OAuth tokens (revoked at the provider too)</li>
              <li>Support tickets and feature requests filed under your account</li>
              <li>App settings, business profile, and currency preferences</li>
            </ul>
          </Section>

          <Section title="5. Reset Data — keep account, wipe data">
            <p>
              If you only want to wipe your transactions and start fresh without losing your account,
              use <strong>Reset Data</strong> instead:
            </p>
            <ol style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Open SpentyAI and go to <strong>More &rarr; Settings</strong>.</li>
              <li>Tap <strong>Reset Data</strong>.</li>
              <li>Confirm. All transactions, accounts, invoices, customers, vendors, statements,
                  and chat history are removed; your sign-in and subscription stay intact.</li>
            </ol>
            <p>
              You can also email{' '}
              <a
                href="mailto:customersupport@spentyai.com?subject=Reset%20my%20SpentyAI%20data"
                style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}
              >
                customersupport@spentyai.com
              </a>{' '}
              with the subject &ldquo;Reset my SpentyAI data&rdquo; to request a data reset without
              account deletion.
            </p>
          </Section>

          <Section title="6. What is kept and for how long">
            <p>
              We retain a small amount of information after deletion only where the law requires it
              or for a short safety window:
            </p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li><strong>Disaster-recovery backups</strong> &mdash; encrypted backups are purged within
                  <strong> 30 days</strong>. Your data is restored only if a system failure occurs in that window.</li>
              <li><strong>Payment / GST records</strong> &mdash; subscription invoices and tax records may be
                  retained for up to <strong>7 years</strong> to comply with Indian tax law.
                  These records contain only the invoice metadata (amount, date, GSTIN) and do
                  not include your transactions or account data.</li>
              <li><strong>Abuse / security logs</strong> &mdash; anonymised request logs may be retained for
                  up to <strong>90 days</strong> for fraud prevention.</li>
            </ul>
            <p>
              Everything else is removed immediately when your deletion request is processed.
            </p>
          </Section>

          <Section title="7. Contact">
            <p>
              Questions about deletion or anything else?
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Business Name:</strong> SpentyAI<br />
              <strong>Address:</strong> 102, Midrise Street, M27, SS Infinitus Phase 2-B, Lasudiya Mauri, Indore, Madhya Pradesh &ndash; 452001, India<br />
              <strong>Email:</strong> customersupport@spentyai.com<br />
              <strong>Website:</strong> www.spentyai.com
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{
        fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: 12
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
