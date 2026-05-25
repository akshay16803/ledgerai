// ─────────────────────────────────────────────────────────────────────────────
// PremiumGateModal — shared upsell sheet
//
// Single ₹199/month CTA, dark green hero, "Maybe later" → /dashboard. Used by
// every gated surface (Email Sync, Invoices, Purchases, Mandates, Reconciliation,
// Records, Past Insights). Mirrors iOS PremiumFeatureSheet.swift +
// Android PremiumFeatureSheet.kt.
//
// "Subscribe" reuses the existing PayU monthly subscription endpoint that
// Billing.jsx uses — keeps the eMandate plumbing identical, only the entry
// point differs. "Maybe later" pops the user back to the dashboard since they
// can't actually use the gated page without the subscription.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EnvelopeSimple, ArrowClockwise, Check, X, Lightning, Lock, Sparkle,
  Receipt, ShoppingCart, ArrowsClockwise, ArrowsLeftRight, Archive,
  ChartLineUp, CalendarBlank, Bell, Folder, MagnifyingGlass, Warning,
  UploadSimple, CurrencyInr,
} from '@phosphor-icons/react';
import { api } from '../lib/api';
import { trackInitiateCheckout, trackAddPaymentInfo } from '../lib/pixel';

// Per-feature presets — mirror PremiumFeatureSheet.swift convenience builders.
// Keep icon/bullets/headlines in sync with iOS + Android for cross-platform
// consistency.
const FEATURE_PRESETS = {
  email_sync: {
    label: 'Email Sync',
    headline: <>Your inbox,<br/>turned into your books.</>,
    subhead: 'We read every UPI alert, bank statement and receipt — and post the transactions for you, automatically.',
    icon: <EnvelopeSimple size={36} weight="fill" style={{ color: '#fff' }} />,
    bullets: [
      { icon: <Lightning size={18} weight="fill" />, title: 'Set it once, forget it', sub: 'Connect Gmail in 30 seconds. New emails auto-parse on arrival.' },
      { icon: <Check size={18} weight="bold" />,     title: 'Smart review queue',     sub: "Anything we're unsure about waits for you — never silently wrong." },
      { icon: <Lock size={18} weight="fill" />,      title: 'Read-only & encrypted',  sub: 'We never send, delete or modify mail. Tokens are bank-grade encrypted.' },
    ],
  },
  invoices: {
    label: 'Invoices',
    headline: <>Invoice clients,<br/>get paid faster.</>,
    subhead: "Create GST-ready invoices in seconds, share them as PDF, and track every rupee that's still owed.",
    icon: <Receipt size={36} weight="fill" style={{ color: '#fff' }} />,
    bullets: [
      { icon: <Lightning size={18} weight="fill" />,  title: 'One-tap invoices',        sub: 'Pick a customer, add line items, hit send — we generate the GST PDF for you.' },
      { icon: <Check size={18} weight="bold" />,      title: 'Track receivables',       sub: 'See exactly who owes you what, how old it is, and chase only the late ones.' },
      { icon: <CurrencyInr size={18} weight="fill" />, title: 'Record payments cleanly', sub: 'Mark paid, capture partials, and stay reconciled with your ledger automatically.' },
    ],
  },
  purchases: {
    label: 'Purchases',
    headline: <>Every vendor bill,<br/>organised and on time.</>,
    subhead: 'Log purchase bills, track what you owe each vendor, and never miss a payment deadline again.',
    icon: <ShoppingCart size={36} weight="fill" style={{ color: '#fff' }} />,
    bullets: [
      { icon: <UploadSimple size={18} weight="fill" />, title: 'Bill in seconds',      sub: 'Snap a bill or fill the form — itemised, GST-aware and saved against the vendor.' },
      { icon: <Warning size={18} weight="fill" />,      title: 'Aging at a glance',    sub: '0-30, 31-60, 60+ days — see which payables are about to slip into overdue.' },
      { icon: <Check size={18} weight="bold" />,        title: 'Record payments fast', sub: 'Pay in full, split across modes, or close with a credit note — all stay tied to the bill.' },
    ],
  },
  mandates: {
    label: 'Mandates',
    headline: <>Never get surprised<br/>by a recurring charge.</>,
    subhead: "Track every SIP, EMI, subscription and auto-debit in one place — and see exactly what's hitting your account next.",
    icon: <ArrowsClockwise size={36} weight="fill" style={{ color: '#fff' }} />,
    bullets: [
      { icon: <CalendarBlank size={18} weight="fill" />, title: 'Upcoming debits, mapped', sub: "Know what's debiting tomorrow, this week, this month — before the bank does it." },
      { icon: <Bell size={18} weight="fill" />,          title: 'No more missed renewals', sub: 'We surface auto-renew dates from your statements and SMS so nothing slips through.' },
      { icon: <ChartLineUp size={18} weight="fill" />,   title: 'Plan your cash flow',     sub: 'Project balances forward, accounting for every committed recurring outflow.' },
    ],
  },
  reconciliation: {
    label: 'Reconciliation',
    headline: <>Match every line<br/>to your statement.</>,
    subhead: "Upload your bank or card statement and we'll reconcile it against your ledger — finding misses, duplicates and mismatches.",
    icon: <ArrowsLeftRight size={36} weight="fill" style={{ color: '#fff' }} />,
    bullets: [
      { icon: <UploadSimple size={18} weight="fill" />, title: 'Statement upload',       sub: "PDF, CSV or scanned — we parse every transaction and line it up against what you've logged." },
      { icon: <Warning size={18} weight="fill" />,      title: 'Catch the gaps',         sub: 'Missing entries, double-posts and amount mismatches surface in a clear review queue.' },
      { icon: <Check size={18} weight="bold" />,        title: 'Close the period clean', sub: 'Approve a statement and your books are locked, audited and ready for tax season.' },
    ],
  },
  records: {
    label: 'Records',
    headline: <>Every receipt,<br/>filed and searchable.</>,
    subhead: 'Every email receipt, statement and attachment we ingest is archived, indexed and one search away — forever.',
    icon: <Archive size={36} weight="fill" style={{ color: '#fff' }} />,
    bullets: [
      { icon: <MagnifyingGlass size={18} weight="bold" />, title: 'Find any receipt fast',   sub: 'Search by vendor, amount, date or category — across years of statements and emails.' },
      { icon: <Folder size={18} weight="fill" />,          title: 'Originals stay attached', sub: 'PDFs, images and EML files stay linked to the transaction they belong to.' },
      { icon: <Lock size={18} weight="fill" />,            title: 'Encrypted at rest',       sub: 'Your records are AES-encrypted in our vault and only ever decrypted for you.' },
    ],
  },
  past_insights: {
    label: 'Past Insights',
    headline: <>Your finances,<br/>looked at clearly.</>,
    subhead: 'Generate tax-ready summaries from any period — built from your real ledger, ready to hand to your CA.',
    icon: <ChartLineUp size={36} weight="fill" style={{ color: '#fff' }} />,
    bullets: [
      { icon: <CalendarBlank size={18} weight="fill" />, title: 'Any period, instantly', sub: 'FY, quarter, month, custom dates — we slice the books however your CA needs.' },
      { icon: <Receipt size={18} weight="fill" />,       title: 'CA-ready exports',      sub: 'PDF + Excel out of the box, with category breakdowns, vendor totals and tax buckets.' },
      { icon: <ChartLineUp size={18} weight="fill" />,   title: 'Spot the patterns',     sub: "Where your money went, where it's growing, and where you're leaking — across years." },
    ],
  },
};

function BulletRow({ icon, title, sub }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16,
      padding: '14px 24px',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(58,92,74,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--brand-primary)',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{sub}</div>
      </div>
    </div>
  );
}

export default function PremiumGateModal({ feature = 'email_sync', onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const preset = FEATURE_PRESETS[feature] || FEATURE_PRESETS.email_sync;

  const handleSubscribe = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Meta Pixel: same events Billing.jsx fires when a user picks Monthly.
      trackInitiateCheckout({
        content_name: 'Monthly',
        content_ids: ['monthly'],
        value: 199,
        currency: 'INR',
        num_items: 1,
      });

      const orderData = await api.post(
        '/api/payments/payu/subscription/create',
        { plan: 'monthly' }
      );

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = orderData.payment_url;
      form.style.display = 'none';
      Object.entries(orderData.form || {}).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value ?? '';
        form.appendChild(input);
      });
      document.body.appendChild(form);

      trackAddPaymentInfo({
        content_category: 'subscription',
        value: 199,
        currency: 'INR',
      });
      form.submit();
    } catch (err) {
      alert(err.message || 'Failed to initiate payment. Please try again.');
      setLoading(false);
    }
  };

  const handleMaybeLater = () => {
    onClose?.();
    navigate('/dashboard');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Unlock ${preset.label}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div onClick={handleMaybeLater} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{
        position: 'relative', background: 'var(--bg-primary)', borderRadius: 16,
        width: '100%', maxWidth: 460, maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.32)', border: '1px solid var(--border-subtle)',
      }}>
        {/* ── Hero (dark green) ── */}
        <div style={{
          background: 'linear-gradient(180deg, #0E1F12 0%, rgba(14,31,18,0.92) 100%)',
          padding: '32px 28px 28px', borderTopLeftRadius: 16, borderTopRightRadius: 16,
          textAlign: 'center', position: 'relative',
        }}>
          <button
            onClick={handleMaybeLater}
            aria-label="Close"
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)', border: 'none',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} weight="bold" />
          </button>

          {/* Tier badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 50,
            background: 'rgba(212,175,55,0.14)', border: '1px solid rgba(212,175,55,0.32)',
            color: '#D4AF37', fontSize: 11, fontWeight: 700, letterSpacing: 1.4,
            marginBottom: 18,
          }}>
            <Sparkle size={11} weight="fill" /> SPENTYAI PREMIUM
          </div>

          {/* Icon medallion */}
          <div style={{
            width: 92, height: 92, borderRadius: '50%',
            background: 'rgba(52,199,89,0.18)',
            margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {preset.icon}
          </div>

          <div style={{
            fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 8,
          }}>
            {preset.headline}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
            {preset.subhead}
          </div>
        </div>

        {/* ── Bullets ── */}
        <div style={{ padding: '8px 0' }}>
          {preset.bullets.map((b, i) => (
            <div key={i}>
              <BulletRow icon={b.icon} title={b.title} sub={b.sub} />
              {i < preset.bullets.length - 1 && (
                <div style={{ height: 1, background: 'var(--border-subtle)', marginLeft: 76, marginRight: 24 }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Price box ── */}
        <div style={{ padding: '0 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            padding: '16px 18px', borderRadius: 14,
            background: 'rgba(52,199,89,0.07)', border: '1px solid rgba(52,199,89,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-primary)' }}>₹199</span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>/month</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Cancel anytime</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No hidden fees</div>
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ padding: '18px 20px 0' }}>
          <button
            onClick={handleSubscribe}
            disabled={loading}
            data-guard
            style={{
              width: '100%', padding: '16px 20px', borderRadius: 14,
              background: 'linear-gradient(180deg, var(--brand-primary) 0%, rgba(58,92,74,0.92) 100%)',
              color: '#fff', border: 'none', fontSize: 16, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 24px rgba(58,92,74,0.32)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <><ArrowClockwise size={16} className="spin" /> Redirecting to checkout…</>
              : <><Sparkle size={16} weight="fill" /> Unlock {preset.label}</>}
          </button>
        </div>

        {/* ── Maybe later ── */}
        <div style={{ textAlign: 'center', padding: '14px 20px 0' }}>
          <button
            onClick={handleMaybeLater}
            disabled={loading}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Maybe later
          </button>
        </div>

        {/* ── Fine print ── */}
        <div style={{
          textAlign: 'center', padding: '12px 28px 16px',
          fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5,
        }}>
          Auto-renews monthly until cancelled. Cancel anytime in Settings → Manage Subscription.
          Payment is processed securely via PayU.
        </div>

        <div style={{
          display: 'flex', justifyContent: 'center', gap: 14,
          padding: '0 28px 22px', fontSize: 11, fontWeight: 500,
        }}>
          <a href="/terms" style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>Terms of Service</a>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <a href="/privacy" style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
