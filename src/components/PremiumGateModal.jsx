// ─────────────────────────────────────────────────────────────────────────────
// PremiumGateModal — unified Premium upsell sheet
//
// Single modal advertising the ENTIRE SpentyAI Premium bundle with BOTH a
// ₹199/month subscription CTA and a ₹4,999 lifetime one-time CTA. Used by
// every gated surface (Email Sync, SMS Sync, Invoices, Purchases, Mandates,
// Reconciliation, Records, Past Insights). Mirrors iOS PremiumFeatureSheet.swift
// + Android PremiumFeatureSheet.kt.
//
// "Subscribe Monthly" → POST /api/payments/payu/subscription/create (eMandate).
// "Get Lifetime"      → POST /api/payments/create-order  { plan: 'lifetime_offer' }.
// "Maybe later" pops the user back to the dashboard since they can't actually
// use the gated page without the subscription.
//
// The legacy `feature` prop is accepted for back-compat but ignored — content
// is now unified across all gated surfaces.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EnvelopeSimple, ChatCircleText, Receipt, ShoppingCart,
  ArrowsLeftRight, Archive, ChartLineUp, ArrowsClockwise,
  ArrowClockwise, Check, X, Sparkle,
} from '@phosphor-icons/react';
import { api } from '../lib/api';
import { trackInitiateCheckout, trackAddPaymentInfo } from '../lib/pixel';

// Feature catalog — kept in sync with iOS PremiumFeatureSheet.Feature
// and Android PremiumFeatureSheet.Feature.
// Each entry drives BOTH (a) the spotlight card at the top of the sheet
// when this feature is the one the user just tapped and (b) the one-line
// row in the "ALSO UNLOCKED WITH PREMIUM" list when it's not.
const FEATURES = {
  email_sync: {
    icon: <EnvelopeSimple size={18} weight="fill" />,
    title: 'Email Sync',
    detail:
      'Connect your Gmail or Outlook inbox once and SpentyAI quietly reads every bank statement, UPI receipt, subscription invoice, and shopping confirmation — turning each transaction email into a categorised entry in your books. No typing, no copy-paste, no missed expenses. Most users save 3–5 hours of bookkeeping a month.',
    oneLiner: 'Auto-import expenses from Gmail and Outlook.',
  },
  sms_sync: {
    icon: <ChatCircleText size={18} weight="fill" />,
    title: 'SMS Sync',
    detail:
      "Your phone already gets a text from your bank for every UPI payment, debit-card swipe, ATM withdrawal, and credit-card charge. SpentyAI reads those SMS alerts (with permission) and books them as transactions the moment they arrive, so your dashboard always reflects reality without you opening a single app.",
    oneLiner: 'Capture bank UPI/debit/credit alerts the second they arrive.',
  },
  invoices: {
    icon: <Receipt size={18} weight="fill" />,
    title: 'Invoices',
    detail:
      'Create GST-ready invoices in seconds — line items, HSN/SAC codes, tax slabs, payment terms, and a professional PDF — then send to customers and track who has paid and who is overdue. Perfect for freelancers, consultants, and small business owners who want billing inside the same app they use for personal money.',
    oneLiner: 'Create GST-ready invoices and track payments.',
  },
  purchases: {
    icon: <ShoppingCart size={18} weight="fill" />,
    title: 'Purchases',
    detail:
      "Track every bill you receive — from your CA's retainer to your cloud hosting to your office rent — with vendor records, due dates, partial-payment tracking, and aging reports. Stop paying the same bill twice and never miss a vendor due date again.",
    oneLiner: 'Track every bill end-to-end with vendor history.',
  },
  reconciliation: {
    icon: <ArrowsLeftRight size={18} weight="fill" />,
    title: 'Reconciliation',
    detail:
      'Upload your bank statement PDF and SpentyAI matches every line to a transaction in your books in one tap. Mismatches are flagged so you spot fraud, duplicate charges, or missing entries instantly. What used to take an accountant a weekend now takes you 90 seconds.',
    oneLiner: 'Match bank statements in one tap to catch errors.',
  },
  records: {
    icon: <Archive size={18} weight="fill" />,
    title: 'Records',
    detail:
      'Every email receipt, every attached invoice, every uploaded bill is archived and instantly searchable. Filter by vendor, date, category, or amount — and download the original email or PDF anytime. Tax season becomes a five-minute task instead of a weekend hunt through Gmail.',
    oneLiner: 'Searchable archive of every receipt and attachment.',
  },
  past_insights: {
    icon: <ChartLineUp size={18} weight="fill" />,
    title: 'Past Insights',
    detail:
      "See exactly where your money went last month, last quarter, last year. Monthly and yearly breakdowns by category, vendor, and account, with trends, anomalies, and year-on-year comparisons. The 'why is my balance so low this month?' question — answered on one screen.",
    oneLiner: 'Monthly and yearly analytics with trend breakdowns.',
  },
  mandates: {
    icon: <ArrowsClockwise size={18} weight="fill" />,
    title: 'Mandates',
    detail:
      "Every UPI auto-pay, every Netflix renewal, every recurring SIP — SpentyAI sees them coming, lays them out on a calendar, and warns you if your account balance won't cover the next hit. The 'forgotten subscription' tax most Indians pay every month? Gone.",
    oneLiner: 'Track UPI auto-pay and recurring charges with a forecast.',
  },
};

const FEATURE_ORDER = [
  'email_sync', 'sms_sync', 'invoices', 'purchases',
  'reconciliation', 'records', 'past_insights', 'mandates',
];

function BulletRow({ icon, title, sub }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '10px 24px',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(58,92,74,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--brand-primary)',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{sub}</div>
      </div>
    </div>
  );
}

// Build + auto-submit a hidden form posting `params` to PayU's hosted checkout.
function submitPayUForm(action, params) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.style.display = 'none';
  Object.entries(params || {}).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value ?? '';
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

export default function PremiumGateModal({ feature = 'invoices', onClose }) {
  // Look up the spotlight feature; fall back to invoices if an unknown key
  // is passed (defensive — every existing caller passes a valid one today).
  const featured = FEATURES[feature] || FEATURES.invoices;
  const otherKeys = FEATURE_ORDER.filter((k) => k !== (FEATURES[feature] ? feature : 'invoices'));
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState(null); // 'monthly' | 'lifetime' | null

  const handleSubscribe = async (planKey) => {
    if (loadingPlan) return;
    setLoadingPlan(planKey);
    try {
      const isMonthly = planKey === 'monthly';
      const value = isMonthly ? 199 : 4999;

      trackInitiateCheckout({
        content_name: isMonthly ? 'Monthly' : 'Lifetime',
        content_ids: [planKey],
        value,
        currency: 'INR',
        num_items: 1,
      });

      // Recurring monthly → /subscription/create eMandate flow.
      // One-time lifetime_offer → /create-order one-shot order.
      const endpoint = isMonthly
        ? '/api/payments/payu/subscription/create'
        : '/api/payments/create-order';
      const planParam = isMonthly ? 'monthly' : 'lifetime_offer';

      const orderData = await api.post(endpoint, { plan: planParam });

      trackAddPaymentInfo({
        content_category: 'subscription',
        value,
        currency: 'INR',
      });

      submitPayUForm(orderData.payment_url, orderData.form);
    } catch (err) {
      alert(err.message || 'Failed to initiate payment. Please try again.');
      setLoadingPlan(null);
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
      aria-label="Unlock SpentyAI Premium"
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div onClick={handleMaybeLater} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{
        position: 'relative', background: 'var(--bg-primary)', borderRadius: 16,
        width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.32)', border: '1px solid var(--border-subtle)',
      }}>
        {/* ── Hero (dark green) ── */}
        <div style={{
          background: 'linear-gradient(180deg, #0E1F12 0%, rgba(14,31,18,0.92) 100%)',
          padding: '28px 28px 24px', borderTopLeftRadius: 16, borderTopRightRadius: 16,
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
            marginBottom: 16,
          }}>
            <Sparkle size={11} weight="fill" /> SPENTYAI PREMIUM
          </div>

          {/* Feature-specific hero icon */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 76, height: 76, borderRadius: '50%',
            background: 'rgba(52,199,89,0.18)',
            marginBottom: 16,
            color: '#fff',
          }}>
            {/* Render with a larger size for the hero */}
            <span style={{ display: 'inline-flex', transform: 'scale(1.8)' }}>{featured.icon}</span>
          </div>

          <div style={{
            fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 8,
          }}>
            Unlock {featured.title}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            Plus every other premium feature on one plan.
          </div>
        </div>

        {/* ── Feature spotlight (detail for the tapped feature) ── */}
        <div style={{
          margin: '14px 16px 0',
          padding: '16px 18px',
          background: 'rgba(52,199,89,0.06)',
          borderLeft: '3px solid var(--brand-primary)',
          borderRadius: '0 8px 8px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(52,199,89,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--brand-primary)',
            }}>
              {featured.icon}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              {featured.title}
            </div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {featured.detail}
          </div>
        </div>

        {/* ── "Also unlocked" section header ── */}
        <div style={{
          padding: '22px 24px 4px',
          fontSize: 11, fontWeight: 700, letterSpacing: 0.9,
          color: 'var(--text-secondary)',
        }}>
          ALSO UNLOCKED WITH PREMIUM
        </div>

        {/* ── "Also unlocked" list — every other feature with a one-liner ── */}
        <div style={{ padding: '4px 0 4px' }}>
          {otherKeys.map((key) => {
            const f = FEATURES[key];
            return (
              <BulletRow key={key} icon={f.icon} title={f.title} sub={f.oneLiner} />
            );
          })}
        </div>

        {/* ── Price boxes (2-up on desktop, stacked on mobile) ── */}
        <div style={{
          padding: '12px 20px 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
        }}>
          <div style={{
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(52,199,89,0.07)', border: '1px solid rgba(52,199,89,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>₹199</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>/month</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Cancel anytime</div>
          </div>

          <div style={{
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.30)',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -8, right: 10,
              fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
              padding: '3px 8px', borderRadius: 50,
              background: '#D4AF37', color: '#1A1A1A',
            }}>
              50% OFF
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>₹4,999</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Lifetime</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>One-time payment</div>
          </div>
        </div>

        {/* ── CTAs ── */}
        <div style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => handleSubscribe('monthly')}
            disabled={!!loadingPlan}
            data-guard
            style={{
              width: '100%', padding: '15px 20px', borderRadius: 14,
              background: 'linear-gradient(180deg, var(--brand-primary) 0%, rgba(58,92,74,0.92) 100%)',
              color: '#fff', border: 'none', fontSize: 15, fontWeight: 600,
              cursor: loadingPlan ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 8px 24px rgba(58,92,74,0.32)',
              opacity: loadingPlan && loadingPlan !== 'monthly' ? 0.5 : 1,
            }}
          >
            {loadingPlan === 'monthly'
              ? <><ArrowClockwise size={16} className="spin" /> Redirecting to checkout…</>
              : <><Sparkle size={16} weight="fill" /> Subscribe Monthly · ₹199/mo</>}
          </button>

          <button
            onClick={() => handleSubscribe('lifetime')}
            disabled={!!loadingPlan}
            data-guard
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 14,
              background: 'transparent', color: '#D4AF37',
              border: '1.5px solid rgba(212,175,55,0.55)',
              fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)',
              cursor: loadingPlan ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loadingPlan && loadingPlan !== 'lifetime' ? 0.5 : 1,
            }}
          >
            {loadingPlan === 'lifetime'
              ? <><ArrowClockwise size={16} className="spin" /> Redirecting to checkout…</>
              : <><Check size={16} weight="bold" /> Get Lifetime · ₹4,999 one-time</>}
          </button>
        </div>

        {/* ── Maybe later ── */}
        <div style={{ textAlign: 'center', padding: '12px 20px 0' }}>
          <button
            onClick={handleMaybeLater}
            disabled={!!loadingPlan}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)',
              cursor: loadingPlan ? 'not-allowed' : 'pointer',
            }}
          >
            Maybe later
          </button>
        </div>

        {/* ── Fine print ── */}
        <div style={{
          textAlign: 'center', padding: '12px 28px 12px',
          fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5,
        }}>
          Monthly auto-renews until cancelled. Cancel anytime in Settings → Manage Subscription.
          Payment is processed securely via PayU.
        </div>

        <div style={{
          display: 'flex', justifyContent: 'center', gap: 14,
          padding: '0 28px 20px', fontSize: 11, fontWeight: 500,
        }}>
          <a href="/terms" style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>Terms of Service</a>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <a href="/privacy" style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
