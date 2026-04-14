import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();
  const lastUpdated = 'April 14, 2026';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          data-testid="terms-back-btn"
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
          Terms of Service
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 40 }}>
          Last updated: {lastUpdated}
        </p>

        <div style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.75, fontFamily: 'var(--font-body)' }}>
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using SpentyAI ("the Service"), you agree to be bound by these Terms of Service.
              If you do not agree, do not use the Service. We reserve the right to update these terms at any time.
              Continued use after changes constitutes acceptance.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              SpentyAI is an AI-powered accounting platform that provides:
            </p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Double-entry bookkeeping for income, expenses, and transfers</li>
              <li>AI-powered parsing of emails (Gmail, Outlook) and SMS for automatic transaction detection</li>
              <li>Bank statement reconciliation via CSV and PDF uploads</li>
              <li>Cash flow projections and financial reports</li>
              <li>Pending review dashboard for AI-detected entries</li>
            </ul>
          </Section>

          <Section title="3. Account Registration">
            <p>
              You must sign in using a valid Google account. You are responsible for maintaining the security
              of your account credentials. You must be at least 18 years old to use the Service. You agree to
              provide accurate information and to keep your account information up to date.
            </p>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to:</p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Use the Service for any unlawful purpose or to facilitate illegal financial activity.</li>
              <li>Attempt to gain unauthorized access to other users' accounts or data.</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Service.</li>
              <li>Upload malicious files, viruses, or harmful content.</li>
              <li>Overload the Service with automated requests beyond normal usage.</li>
              <li>Misrepresent your identity or affiliation.</li>
            </ul>
          </Section>

          <Section title="5. Your Data">
            <p>
              You retain ownership of all financial data you enter or import into SpentyAI. By using the
              Service, you grant us a limited license to process, store, and analyze your data solely for
              the purpose of providing the Service to you. We do not claim ownership of your data.
            </p>
            <p>
              See our <a href="/privacy" style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>Privacy Policy</a> for
              full details on how we handle your data.
            </p>
          </Section>

          <Section title="6. Email and SMS Access">
            <p>
              When you connect your Gmail or Outlook account, you authorize SpentyAI to access your inbox
              in read-only mode to scan for financial transaction emails. You can revoke this access at
              any time by disconnecting from the Email & SMS settings page, or by removing SpentyAI
              from your Google or Microsoft account permissions.
            </p>
            <p>
              If you upload SMS data, you confirm that you have the right to share that data with the Service
              for processing.
            </p>
          </Section>

          <Section title="7. AI-Generated Content">
            <p>
              SpentyAI uses artificial intelligence (OpenAI) to parse emails, SMS messages, and categorize
              transactions. AI-generated transaction entries are marked as "pending review" and require
              your approval before being finalized. We do not guarantee the accuracy of AI-parsed
              transactions. You are responsible for reviewing and approving all AI-detected entries.
            </p>
          </Section>

          <Section title="8. Bank Statement Uploads">
            <p>
              You may upload bank statements in CSV or PDF format for reconciliation. You are responsible for
              ensuring you have the right to upload these documents. Uploaded files are processed and stored
              securely. We do not share uploaded statements with any third party except as needed to
              process them (e.g., parsing PDFs).
            </p>
          </Section>

          <Section title="9. Service Availability">
            <p>
              We strive to keep SpentyAI available 24/7, but we do not guarantee uninterrupted access.
              We may perform maintenance, updates, or experience outages. We are not liable for any loss
              or damage resulting from service downtime.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              SpentyAI is a financial record-keeping tool, <strong>not a licensed accounting firm, tax advisor,
              or financial advisor</strong>. The Service is provided "as is" without warranties of any kind.
            </p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>We are not responsible for financial decisions made based on data in the app.</li>
              <li>We are not liable for inaccuracies in AI-parsed transactions.</li>
              <li>We are not liable for data loss, though we take reasonable precautions to prevent it.</li>
              <li>Our total liability to you shall not exceed the amount you paid for the Service in the
                preceding 12 months.</li>
            </ul>
          </Section>

          <Section title="11. Account Termination">
            <p>
              You may stop using the Service at any time. We may suspend or terminate your account if you
              violate these terms. Upon termination, your data will be retained for 30 days to allow
              recovery, after which it will be permanently deleted.
            </p>
          </Section>

          <Section title="12. Intellectual Property">
            <p>
              The SpentyAI name, logo, design, and software are the intellectual property of SpentyAI.
              You may not copy, modify, or distribute any part of the Service without written permission.
              Your financial data remains your property at all times.
            </p>
          </Section>

          <Section title="13. Governing Law">
            <p>
              These Terms are governed by and construed in accordance with applicable laws. Any disputes
              arising from or related to the Service shall be resolved through good-faith negotiation
              before pursuing formal legal proceedings.
            </p>
          </Section>

          <Section title="14. Contact Us">
            <p>
              If you have questions about these Terms of Service, contact us at:
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Email:</strong> support@spentyai.com
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
