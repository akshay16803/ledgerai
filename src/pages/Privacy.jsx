import { useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();
  const lastUpdated = 'May 3, 2026';

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

          <Section title="4. Payment Data">
            <p>
              SpentyAI collects subscription payments through authorised third-party payment gateways
              (including <strong>PhonePe</strong>, Razorpay, and UPI networks). We do <strong>not</strong> collect,
              store, or process your card number, UPI PIN, CVV, net-banking credentials, or any other
              sensitive payment authentication data. All payment transactions are processed directly by
              the payment gateway on their PCI-DSS compliant infrastructure.
            </p>
            <p>
              When you make a payment, the gateway may share with us:
            </p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Transaction reference ID and status (success/failure)</li>
              <li>Payment method type (UPI, card, net-banking) — without specific credentials</li>
              <li>Amount and currency</li>
              <li>Timestamp of the transaction</li>
            </ul>
            <p>
              This information is used solely to activate or renew your subscription and to resolve billing
              disputes. It is stored securely and never shared with third parties for marketing purposes.
            </p>
          </Section>

          <Section title="5. AI Processing & Third-Party AI Services">
            <p>
              SpentyAI uses <strong>OpenAI</strong> (operated by OpenAI, L.L.C., based in the United States)
              as the only third-party AI provider.
            </p>

            <SubSection title="5.1 What data is sent to OpenAI">
              <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li><strong>AI Chat:</strong> your typed question plus a structured summary of your accounts,
                  recent transactions, categories, customers, vendors, invoices, and bills.</li>
                <li><strong>Email parsing:</strong> the body text of transaction-related emails from any inbox
                  you have explicitly connected (Gmail or Outlook).</li>
                <li><strong>SMS parsing:</strong> the body text of bank/payment SMS messages you have uploaded
                  from your phone.</li>
                <li><strong>Receipt scanning:</strong> the photo of a receipt you have uploaded.</li>
                <li><strong>Bank statement parsing:</strong> the contents of any bank statement (PDF, CSV, or
                  Excel) you have uploaded.</li>
              </ul>
            </SubSection>

            <SubSection title="5.2 What is never sent">
              <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li>Account passwords, OAuth refresh tokens, full bank account or card numbers, Aadhaar / PAN,
                  or any government-issued ID number.</li>
                <li>Anything from emails or SMS that we have not classified as transaction-related.</li>
              </ul>
            </SubSection>

            <SubSection title="5.3 How the data travels and how long it is kept">
              <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li>All data is sent over TLS to api.openai.com.</li>
                <li>Per OpenAI's API terms (effective since March 2023), API request data is not retained beyond
                  30 days for abuse monitoring and is not used to train OpenAI's models.</li>
                <li>For full details, see OpenAI's privacy and data-usage policy at{' '}
                  <a href="https://openai.com/policies/" target="_blank" rel="noopener noreferrer"
                     style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>
                    https://openai.com/policies/
                  </a>.
                </li>
              </ul>
            </SubSection>

            <SubSection title="5.4 Your control">
              <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li>AI features are opt-in. Before any data is sent to OpenAI for the first time, the app asks
                  for your explicit consent.</li>
                <li>You can revoke that consent at any time from <strong>Settings &rarr; Privacy</strong> on the
                  iOS app, the Android app, or the web app. Revoking consent disables all AI features for that
                  account.</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="6. Other Third-Party Services">
            <p>We use the following third-party services to operate SpentyAI:</p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li><strong>Google OAuth</strong> &mdash; for sign-in authentication and Gmail access.</li>
              <li><strong>Microsoft Graph API</strong> &mdash; for Outlook email access.</li>
              <li><strong>PhonePe / Razorpay</strong> &mdash; to process subscription payments. Payment data is
                governed by their respective privacy policies and PCI-DSS standards.</li>
              <li><strong>Resend</strong> &mdash; to deliver verification and welcome emails to your address.</li>
              <li><strong>MongoDB Atlas</strong> &mdash; to securely store your account and financial data.</li>
              <li><strong>Railway</strong> &mdash; to host our application infrastructure.</li>
            </ul>
            <p>
              For our AI provider (OpenAI), see Section 5 above. We do not sell, rent, or share your personal
              or financial data with advertisers or data brokers.
            </p>
          </Section>

          <Section title="7. Data Retention">
            <p>
              Your data is retained as long as your account is active. If you wish to delete your account and
              all associated data, contact us at the email below. We will permanently remove your records
              within 30 days of your request.
            </p>
          </Section>

          <Section title="8. Data Security">
            <p>
              All data is transmitted over HTTPS with TLS encryption. Session cookies are httpOnly and secure.
              Database access is restricted and authenticated. Email OAuth tokens are stored securely and can
              be revoked by disconnecting your email account.
            </p>
          </Section>

          <Section title="9. Your Rights">
            <p>You have the right to:</p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li><strong>Access</strong> your data through the app's dashboard, transactions, and reports pages.</li>
              <li><strong>Delete</strong> individual transactions, accounts, or your entire account.</li>
              <li><strong>Disconnect</strong> Gmail or Outlook at any time, which stops future email scanning.</li>
              <li><strong>Revoke</strong> Google or Microsoft permissions from your respective account settings.</li>
              <li><strong>Export</strong> your financial data from the reports section.</li>
            </ul>
          </Section>

          <Section title="10. Children's Privacy">
            <p>
              SpentyAI is not intended for use by anyone under the age of 18. We do not knowingly collect
              data from minors.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this policy from time to time. Changes will be posted on this page with an
              updated date. Continued use of SpentyAI after changes constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section title="12. Grievance Officer">
            <p>
              In accordance with the Information Technology Act, 2000 and the Information Technology
              (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, if you have any grievance
              regarding this Privacy Policy or our data handling practices, you may contact our Grievance Officer:
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>Grievance Officer:</strong> Akshay Chouhan<br />
              <strong>Designation:</strong> Founder &amp; Grievance Officer<br />
              <strong>Company:</strong> SpentyAI<br />
              <strong>Address:</strong> 102, Midrise Street, M27, SS Infinitus Phase 2-B, Lasudiya Mauri, Indore, Madhya Pradesh – 452001, India<br />
              <strong>Email:</strong> customersupport@spentyai.com<br />
              <strong>Response time:</strong> Grievances will be acknowledged within 24 hours and resolved within 15 business days.
            </p>
          </Section>

          <Section title="13. Contact Us">
            <p>
              If you have questions about this Privacy Policy or want to request data deletion, contact us at:
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Business Name:</strong> SpentyAI<br />
              <strong>Address:</strong> 102, Midrise Street, M27, SS Infinitus Phase 2-B, Lasudiya Mauri, Indore, Madhya Pradesh – 452001, India<br />
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
