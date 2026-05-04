import { useNavigate } from 'react-router-dom';

export default function RefundPolicy() {
  const navigate = useNavigate();
  const lastUpdated = 'April 27, 2026';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          data-testid="refund-back-btn"
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
          Refund &amp; Cancellation Policy
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 40 }}>
          Last updated: {lastUpdated}
        </p>

        <div style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.75, fontFamily: 'var(--font-body)' }}>
          <Section title="1. About SpentyAI Subscriptions">
            <p>
              SpentyAI is a subscription-based autonomous accounting platform. All paid plans are billed in advance
              on a monthly or annual cycle. This page explains our policy for cancellations, refunds, and failed
              transactions. It applies to all purchases made on <strong>www.spentyai.com</strong> and through our
              iOS and Android apps.
            </p>
          </Section>

          <Section title="2. Free Trial">
            <p>
              New users may be offered a free trial at sign-up. During the trial you are not charged, and you can
              cancel any time before the trial ends to avoid being billed. Your subscription starts automatically
              at the end of the trial unless you cancel before then.
            </p>
          </Section>

          <Section title="3. Cancellation">
            <SubSection title="3.1 How to Cancel">
              <p>
                You can cancel your subscription at any time from <strong>Settings &rarr; Billing</strong> inside the
                SpentyAI app or by writing to us at <strong>customersupport@spentyai.com</strong> from your registered email.
              </p>
            </SubSection>
            <SubSection title="3.2 What Happens After Cancellation">
              <p>
                When you cancel, your plan remains active until the end of the current billing period. After that,
                your account automatically moves to the free tier. Your data is preserved and you can re-subscribe
                at any time.
              </p>
            </SubSection>
          </Section>

          <Section title="4. Refund Eligibility">
            <p>We offer refunds in the following scenarios:</p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>
                <strong>Accidental or duplicate charge:</strong> If you were billed more than once for the same
                period, or billed after successfully cancelling, we will refund the duplicate amount in full.
              </li>
              <li>
                <strong>Service unavailability:</strong> If SpentyAI was unavailable for an extended continuous
                period (more than 72 hours) during your active subscription, you are eligible for a pro-rated refund
                for the affected period.
              </li>
              <li>
                <strong>First-purchase refund window:</strong> If you purchase a paid plan for the first time and
                decide within <strong>7 days</strong> that SpentyAI is not a fit, write to us and we will issue a
                full refund of that first payment, provided you have not used a substantial amount of the service
                (for example, synced more than 500 transactions or generated invoices worth more than
                &#8377;1,00,000).
              </li>
              <li>
                <strong>Unauthorised charge:</strong> If you believe a transaction was not authorised by you, raise
                a dispute with us within 30 days of the charge and we will investigate and issue a refund if the
                claim is verified.
              </li>
            </ul>
          </Section>

          <Section title="5. Non-Refundable Situations">
            <p>The following charges are not refundable:</p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Renewal payments for ongoing subscriptions (you must cancel before the renewal date to avoid the charge).</li>
              <li>Partial-month usage after the first-purchase refund window has passed.</li>
              <li>Annual plans cancelled after the first 7 days &mdash; the remaining months are not refunded, but your plan stays active until the end of the billed period.</li>
              <li>Add-on usage charges (if any) that have already been consumed.</li>
            </ul>
          </Section>

          <Section title="6. Failed or Pending Payments">
            <p>
              If a payment fails at your bank or payment gateway (UPI, card, net-banking), no charge is made and no
              refund is required. If money has been debited from your account but your SpentyAI subscription is not
              active, please write to us at <strong>customersupport@spentyai.com</strong> with a transaction reference and we
              will resolve it within 5-7 business days.
            </p>
          </Section>

          <Section title="7. Refund Processing Time">
            <p>
              Once a refund is approved, the amount is credited back to the original payment instrument:
            </p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>UPI / wallets: typically 1&ndash;3 business days.</li>
              <li>Credit / debit cards: typically 5&ndash;7 business days (depending on the issuing bank).</li>
              <li>Net banking: typically 3&ndash;5 business days.</li>
            </ul>
            <p>
              We will always notify you by email once the refund has been initiated. If you have not received the
              amount after the stated window, please reach out so we can share the payment gateway reference.
            </p>
          </Section>

          <Section title="8. Disputes and Chargebacks">
            <p>
              We encourage you to contact us first before raising a chargeback with your bank or card issuer. In
              most cases, we can resolve the issue and issue a refund directly within 48 hours. Unwarranted
              chargebacks may result in the loss of access to your SpentyAI account.
            </p>
          </Section>

          <Section title="9. How to Request a Refund">
            <p>
              Send an email to <strong>customersupport@spentyai.com</strong> from your registered email address with:
            </p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>The email associated with your SpentyAI account.</li>
              <li>The payment / order reference (PayU transaction ID, UPI reference, or card last four digits).</li>
              <li>A short reason for the refund request.</li>
            </ul>
            <p>
              We respond to every refund request within <strong>2 business days</strong> and aim to resolve them
              within <strong>7 business days</strong>.
            </p>
          </Section>

          <Section title="10. Delivery of Service">
            <p>
              SpentyAI is a fully digital subscription service. There is no physical product, no shipping, and no
              delivery lead time. Access to the paid plan is activated <strong>immediately</strong> upon
              successful payment confirmation. If payment succeeds but your account is not upgraded within
              10 minutes, please write to <strong>customersupport@spentyai.com</strong> with your payment reference.
            </p>
            <p style={{ marginTop: 12 }}>
              Subscription features include access to the SpentyAI web application (www.spentyai.com),
              iOS app, and Android app — all governed by the same plan. No physical goods are shipped
              at any point.
            </p>
          </Section>

          <Section title="11. Services Covered">
            <p>This policy applies to the following SpentyAI services and subscription plans:</p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li><strong>Monthly Plan (&#8377;199/month):</strong> Full access, billed every 30 days.</li>
              <li><strong>Quarterly Plan (&#8377;449/3 months):</strong> Full access, billed every 90 days.</li>
              <li><strong>Yearly Plan (&#8377;1,499/year):</strong> Full access, billed annually.</li>
              <li><strong>Lifetime Plan (&#8377;9,999 one-time):</strong> Permanent access, single payment.</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              All plans include: AI-assisted transaction logging, email and SMS sync, invoicing, reports,
              reconciliation, and mobile app access. No additional charges apply within the subscription period.
            </p>
          </Section>

          <Section title="12. Payment Gateway">
            <p>
              SpentyAI processes all subscription payments through <strong>PayU</strong> and UPI
              payment networks regulated by the National Payments Corporation of India (NPCI) and
              the Reserve Bank of India (RBI).
              SpentyAI does <strong>not</strong> store your card number, UPI PIN, CVV, or net-banking
              credentials at any point. All sensitive payment data is handled exclusively by the payment
              gateway on PCI-DSS compliant infrastructure.
            </p>
            <p>
              Refunds are initiated by SpentyAI through the same payment gateway used for the original
              transaction and are credited back to the original payment instrument.
            </p>
          </Section>

          <Section title="13. Governing Law">
            <p>
              This Refund &amp; Cancellation Policy is governed by the laws of India, including the
              Consumer Protection Act, 2019 and the Consumer Protection (E-Commerce) Rules, 2020.
              Any disputes arising out of this policy shall be subject to the exclusive jurisdiction of
              the competent courts in <strong>Indore, Madhya Pradesh, India</strong>.
            </p>
          </Section>

          <Section title="14. Grievance Officer">
            <p>
              If you have an unresolved billing or refund grievance, you may contact our Grievance Officer
              as required under the Information Technology Act, 2000:
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>Grievance Officer:</strong> Akshay Chouhan<br />
              <strong>Company:</strong> SpentyAI<br />
              <strong>Address:</strong> 102, Midrise Street, M27, SS Infinitus Phase 2-B, Lasudiya Mauri, Indore, Madhya Pradesh – 452001, India<br />
              <strong>Email:</strong> customersupport@spentyai.com<br />
              <strong>Response time:</strong> Acknowledged within 24 hours, resolved within 15 business days.
            </p>
          </Section>

          <Section title="15. Changes to This Policy">
            <p>
              We may update this refund policy from time to time. Material changes will be communicated by email
              and posted on this page with a new &ldquo;Last updated&rdquo; date.
            </p>
          </Section>

          <Section title="16. Contact Us">
            <p>
              For any refund or billing question, contact:
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Email:</strong> customersupport@spentyai.com<br />
              <strong>Business name:</strong> SpentyAI<br />
              <strong>Address:</strong> 102, Midrise Street, M27, SS Infinitus Phase 2-B, Lasudiya Mauri, Indore, Madhya Pradesh – 452001, India<br />
              <strong>Website:</strong> www.spentyai.com<br />
              <strong>Contact page:</strong> <a href="/contact" style={{ color: 'inherit' }}>www.spentyai.com/contact</a>
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
        color: 'var(--text-primary)', marginBottom: 12,
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
        color: 'var(--text-primary)', marginBottom: 8,
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
