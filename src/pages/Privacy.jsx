import { useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();
  const lastUpdated = 'April 14, 2026';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          data-testid="privacy-back-btn"
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
          Privacy Policy
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 40 }}>
          Last updated: {lastUpdated}
        </p>

        <div style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.75, fontFamily: 'var(--font-body)' }}>
          <Section title="1. Who We Are">
            <p>
              SpentyAI ("we", "us", "our") is an autonomous accounting platform that helps individuals and
              small businesses track income, expenses, and transfers using AI-powered email and SMS parsing.
              This policy explains what data we collect, why, and how we protect it.
            </p>
          </Section>

          <Section title="2. Data We Collect">
            <SubSection title="2.1 Account Information">
              <p>
                When you sign in with Google, we receive your <strong>name, email address, and profile picture</strong> from
                your Google account. We use this to create and identify your SpentyAI account.
              </p>
            </SubSection>

            <SubSection title="2.2 Financial Data You Enter">
              <p>We store data you voluntarily provide, including:</p>
              <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li>Bank accounts and their balances</li>
                <li>Transaction records (income, expenses, transfers)</li>
                <li>Categories and subcategories</li>
                <li>Uploaded bank statements (CSV and PDF files)</li>
              </ul>
              <p>This data is stored in your account and is never shared with other users.</p>
            </SubSection>

            <SubSection title="2.3 Email Data (Gmail and Outlook)">
              <p>
                If you choose to connect your Gmail or Outlook account, we request <strong>read-only access</strong> to
                your inbox. We scan emails for transaction-related messages (e.g., payment confirmations, bank alerts)
                and extract financial details using AI. We do <strong>not</strong> read, store, or process emails
                unrelated to financial transactions. You can disconnect your email account at any time.
              </p>
              <p>
                <strong>Gmail scopes requested:</strong> gmail.readonly, userinfo.email, userinfo.profile (read-only).
              </p>
              <p>
                <strong>Outlook scopes requested:</strong> Mail.Read, User.Read (read-only).
              </p>
            </SubSection>

            <SubSection title="2.4 SMS Data">
              <p>
                If you upload SMS messages through the app, we analyze them for transaction information using AI.
                SMS data is processed the same way as email data, only financial messages are extracted and stored
                as transactions.
              </p>
            </SubSection>

            <SubSection title="2.5 Cookies and Sessions">
              <p>
                We use a single <strong>httpOnly, secure session cookie</strong> ("session_token") to keep you
                logged in. We do not use advertising cookies, tracking pixels, or third-party analytics cookies.
              </p>
            </SubSection>
          </Section>

          <Section title="3. How We Use Your Data">
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li><strong>Account management</strong> &mdash; to identify you and maintain your session.</li>
              <li><strong>Transaction recording</strong> &mdash; to create, categorize, and reconcile your financial records.</li>
              <li><strong>AI parsing</strong> &mdash; to automatically extract transactions from your emails and SMS messages.</li>
              <li><strong>Cash flow projections</strong> &mdash; to generate financial forecasts based on your transaction history.</li>
              <li><strong>Reports</strong> &mdash; to produce summaries and breakdowns of your financial activity.</li>
              <li><strong>Verification emails</strong> &mdash; to send you an email verification link when you sign up.</li>
            </ul>
          </Section>

          <Section title="4. Third-Party Services">
            <p>We use the following third-party services to operate SpentyAI:</p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li><strong>Google OAuth</strong> &mdash; for sign-in authentication and Gmail access.</li>
              <li><strong>Microsoft Graph API</strong> &mdash; for Outlook email access.</li>
              <li><strong>OpenAI</strong> &mdash; to analyze email and SMS content and extract transaction data.
                Email/SMS content is sent to OpenAI's API for processing. OpenAI's data usage policy applies.</li>
              <li><strong>Resend</strong> &mdash; to deliver verification and welcome emails to your address.</li>
              <li><strong>MongoDB Atlas</strong> &mdash; to securely store your account and financial data.</li>
              <li><strong>Railway</strong> &mdash; to host our application infrastructure.</li>
            </ul>
            <p>We do not sell, rent, or share your personal or financial data with advertisers or data brokers.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              Your data is retained as long as your account is active. If you wish to delete your account and
              all associated data, contact us at the email below. We will permanently remove your records
              within 30 days of your request.
            </p>
          </Section>

          <Section title="6. Data Security">
            <p>
              All data is transmitted over HTTPS with TLS encryption. Session cookies are httpOnly and secure.
              Database access is restricted and authenticated. Email OAuth tokens are stored securely and can
              be revoked by disconnecting your email account.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>You have the right to:</p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li><strong>Access</strong> your data through the app's dashboard, transactions, and reports pages.</li>
              <li><strong>Delete</strong> individual transactions, accounts, or your entire account.</li>
              <li><strong>Disconnect</strong> Gmail or Outlook at any time, which stops future email scanning.</li>
              <li><strong>Revoke</strong> Google or Microsoft permissions from your respective account settings.</li>
              <li><strong>Export</strong> your financial data from the reports section.</li>
            </ul>
          </Section>

          <Section title="8. Children's Privacy">
            <p>
              SpentyAI is not intended for use by anyone under the age of 18. We do not knowingly collect
              data from minors.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this policy from time to time. Changes will be posted on this page with an
              updated date. Continued use of SpentyAI after changes constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section title="10. Contact Us">
            <p>
              If you have questions about this Privacy Policy or want to request data deletion, contact us at:
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Email:</strong> privacy@spentyai.com
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

function SubSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16, marginTop: 12 }}>
      <h3 style={{
        fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 600,
        color: 'var(--text-primary)', marginBottom: 8
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
