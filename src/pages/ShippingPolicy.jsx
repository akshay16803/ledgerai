import { useNavigate } from 'react-router-dom';

// Dedicated Shipping & Delivery Policy page.
//
// Even though SpentyAI is a 100% digital, no-physical-goods service, Indian
// payment-gateway providers (PhonePe Business, Razorpay Standard onboarding,
// Cashfree, etc.) require a SEPARATE Shipping/Delivery Policy URL on the
// merchant website. Without this page, gateway KYC review is routinely
// rejected even when refund and terms pages are otherwise complete.
//
// This page is intentionally short, plain, and explicit about the digital
// nature of the service.

export default function ShippingPolicy() {
  const navigate = useNavigate();
  const lastUpdated = 'May 4, 2026';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button
          data-testid="shipping-back-btn"
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
          Shipping &amp; Delivery Policy
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 40 }}>
          Last updated: {lastUpdated}
        </p>

        <div style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.75, fontFamily: 'var(--font-body)' }}>

          <Section title="1. Nature of Service">
            <p>
              SpentyAI is a fully <strong>digital, software-as-a-service (SaaS)</strong> product. There is{' '}
              <strong>no physical product</strong>, no shipment, no courier dispatch, and no postal delivery
              involved at any stage. All access to SpentyAI is delivered electronically over the internet.
            </p>
          </Section>

          <Section title="2. Method of Delivery">
            <p>
              Subscriptions and one-time purchases are delivered through one or more of the following digital
              channels, all of which are activated automatically as soon as a successful payment is confirmed
              by the payment gateway:
            </p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>
                <strong>Web application:</strong> immediate unlock of paid features at{' '}
                <a href="https://www.spentyai.com" style={{ color: 'inherit' }}>www.spentyai.com</a>{' '}
                upon next sign-in or page reload.
              </li>
              <li>
                <strong>iOS app (iPhone &amp; iPad):</strong> the App Store entitlement is recognised on the
                next launch (or by tapping <em>Restore Purchases</em> inside the app).
              </li>
              <li>
                <strong>Android app:</strong> the Google Play Billing entitlement is recognised on the next
                launch.
              </li>
            </ul>
          </Section>

          <Section title="3. Delivery Timeline">
            <p>
              Activation is <strong>instant</strong> in the vast majority of cases. The end-to-end flow from
              payment success to feature unlock typically completes in <strong>under 60 seconds</strong>.
            </p>
            <p style={{ marginTop: 12 }}>
              In the rare event that your account has not been upgraded within{' '}
              <strong>10 minutes</strong> of receiving the payment confirmation, please email us at{' '}
              <strong>customersupport@spentyai.com</strong> with the payment reference (UPI transaction ID, PhonePe
              order ID, card last four digits, or App Store / Play Store receipt). We will resolve activation
              issues within <strong>24 hours</strong>.
            </p>
          </Section>

          <Section title="4. No Physical Shipment">
            <p>
              Because SpentyAI is delivered entirely as software:
            </p>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>No physical address is required at checkout for delivery purposes.</li>
              <li>No courier, postal, or logistics partner is involved.</li>
              <li>No customs duties, import taxes, or shipping fees apply.</li>
              <li>There are no <em>shipping zones</em>, <em>delivery slots</em>, or <em>tracking numbers</em>.</li>
            </ul>
          </Section>

          <Section title="5. Geographic Availability">
            <p>
              SpentyAI is available worldwide via{' '}
              <a href="https://www.spentyai.com" style={{ color: 'inherit' }}>www.spentyai.com</a>{' '}
              and via the iOS and Android app stores in 175 countries. Pricing is set in Indian Rupees (INR)
              for the web app and through Apple / Google's localised pricing on the mobile apps. Local taxes,
              where applicable, are added at checkout per the payment gateway's rules.
            </p>
          </Section>

          <Section title="6. Failed Delivery / Activation">
            <p>
              If a payment is captured by the gateway but feature activation fails (for example, due to a
              network blip during the receipt verification step), the system retries automatically. If after
              retries the feature is still not active, our support team will manually grant the entitlement
              and refund the payment if you no longer wish to continue. Refer to our{' '}
              <a href="/refund-policy" style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>Refund &amp; Cancellation Policy</a>{' '}
              for the refund process.
            </p>
          </Section>

          <Section title="7. Contact">
            <p>
              For any question about delivery or activation, please reach us at:
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Business name:</strong> SpentyAI<br />
              <strong>Address:</strong> 102, Midrise Street, M27, SS Infinitus Phase 2-B, Lasudiya Mauri, Indore, Madhya Pradesh – 452001, India<br />
              <strong>Email:</strong> customersupport@spentyai.com<br />
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
