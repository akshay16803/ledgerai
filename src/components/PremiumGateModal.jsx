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

// Bundle bullets — same content for every gated surface; kept in sync with
// iOS BundleBullets and Android BundleBullets.
const BUNDLE_BULLETS = [
  { icon: <EnvelopeSimple size={18} weight="fill" />,  title: 'Email Sync',     sub: 'Auto-import expenses from Gmail and Outlook' },
  { icon: <ChatCircleText size={18} weight="fill" />,  title: 'SMS Sync',       sub: 'Capture bank transaction alerts automatically' },
  { icon: <Receipt size={18} weight="fill" />,         title: 'Invoices',       sub: 'Create and send GST-ready invoices' },
  { icon: <ShoppingCart size={18} weight="fill" />,    title: 'Purchases',      sub: 'Track every bill end-to-end' },
  { icon: <ArrowsLeftRight size={18} weight="fill" />, title: 'Reconciliation', sub: 'Match bank statements in one tap' },
  { icon: <Archive size={18} weight="fill" />,         title: 'Records',        sub: 'Full email and attachment archive' },
  { icon: <ChartLineUp size={18} weight="fill" />,     title: 'Past Insights',  sub: 'Monthly and yearly analytics' },
  { icon: <ArrowsClockwise size={18} weight="fill" />, title: 'Mandates',       sub: 'Track UPI auto-pay subscriptions' },
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

export default function PremiumGateModal({ onClose }) {
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

          <div style={{
            fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 8,
          }}>
            Unlock SpentyAI Premium
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            One subscription. Every premium feature.
          </div>
        </div>

        {/* ── Bullets ── */}
        <div style={{ padding: '10px 0 4px' }}>
          {BUNDLE_BULLETS.map((b, i) => (
            <BulletRow key={i} icon={b.icon} title={b.title} sub={b.sub} />
          ))}
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
