import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import { useAuth } from '../contexts/AuthContext.jsx';
import { trackInitiateCheckout, trackAddPaymentInfo } from '../lib/pixel';
import {
  EnvelopeSimple, ArrowClockwise, Check, X, Clock,
  Lightning, Warning, CaretDown, CaretUp, CalendarBlank,
  CloudArrowUp, Plugs, PlugsConnected, MicrosoftOutlookLogo,
  ChatText, DeviceMobile, PencilSimple, Eye, Sparkle, Lock
} from '@phosphor-icons/react';
import { EditTransactionModal } from '../components/EditTransactionModal';

// ─────────────────────────────────────────────────────────────────────────────
// PremiumGateModal
//
// Inline upsell sheet — presented when a free user opens /email-sync. Mirrors
// the iOS PremiumFeatureSheet + Android PremiumFeatureSheet.kt (dark green hero,
// single ₹199/month CTA, Maybe later, Terms/Privacy fine print). Replaces the
// pre-pivot "bounce them to /billing" flow that re-exposed the legacy SKUs.
//
// "Subscribe" reuses the existing PayU subscription endpoint that Billing.jsx
// uses — keeps the eMandate plumbing identical, only the entry point differs.
// "Maybe later" pops the user back to the dashboard since they can't actually
// use Email Sync without the subscription.
// ─────────────────────────────────────────────────────────────────────────────
function PremiumGateModal({ onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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
    onClose();
    navigate('/dashboard');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Unlock Email Sync"
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
            <EnvelopeSimple size={36} weight="fill" style={{ color: '#fff' }} />
          </div>

          <div style={{
            fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 8,
          }}>
            Your inbox,<br/>turned into your books.
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
            We read every UPI alert, bank statement and receipt — and post
            the transactions for you, automatically.
          </div>
        </div>

        {/* ── Bullets ── */}
        <div style={{ padding: '8px 0' }}>
          <BulletRow
            icon={<Lightning size={18} weight="fill" />}
            title="Set it once, forget it"
            sub="Connect Gmail in 30 seconds. New emails auto-parse on arrival."
          />
          <div style={{ height: 1, background: 'var(--border-subtle)', marginLeft: 76, marginRight: 24 }} />
          <BulletRow
            icon={<Check size={18} weight="bold" />}
            title="Smart review queue"
            sub="Anything we're unsure about waits for you — never silently wrong."
          />
          <div style={{ height: 1, background: 'var(--border-subtle)', marginLeft: 76, marginRight: 24 }} />
          <BulletRow
            icon={<Lock size={18} weight="fill" />}
            title="Read-only & encrypted"
            sub="We never send, delete or modify mail. Tokens are bank-grade encrypted."
          />
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
              : <><Sparkle size={16} weight="fill" /> Unlock Email Sync</>}
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

function ViewSourceModal({ source, onClose }) {
  if (!source) return null;
  const isEmail = source.type === 'email';
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 2, width: '90%', maxWidth: 600,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1px solid var(--border-subtle)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isEmail ? <EnvelopeSimple size={18} weight="bold" style={{ color: '#2563EB' }} />
              : <ChatText size={18} weight="bold" style={{ color: '#7C3AED' }} />}
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {isEmail ? 'Original Email' : 'Original SMS'}
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
          }}>&times;</button>
        </div>
        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {isEmail ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Subject</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{source.subject || '(no subject)'}</div>
              </div>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>From</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{source.from || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Date</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{source.date || '—'}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Body</div>
                <div style={{
                  fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: 'var(--bg-secondary)', padding: 16, borderRadius: 2,
                  border: '1px solid var(--border-subtle)', maxHeight: 300, overflowY: 'auto',
                }}>{source.body || '(empty)'}</div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Sender</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{source.sender || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Date</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{source.date || '—'}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Message</div>
                <div style={{
                  fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: 'var(--bg-secondary)', padding: 16, borderRadius: 2,
                  border: '1px solid var(--border-subtle)', maxHeight: 300, overflowY: 'auto',
                }}>{source.body || '(empty)'}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCurrency(amount) {
  if (!amount) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

function StatPill({ label, value, color, pulsing }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 20px', background: `${color}12`, borderRadius: 2, minWidth: 100,
      transition: 'all 0.3s ease',
      animation: pulsing ? 'pulse-stat 1.5s ease-in-out infinite' : 'none',
    }}>
      <span className="mono" style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em', transition: 'all 0.3s ease' }}>{value}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function SourceBadge({ source }) {
  if (source === 'sms') {
    return (
      <span data-testid="source-badge-sms" style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 10, padding: '2px 6px', borderRadius: 2,
        background: '#7C3AED18', color: '#7C3AED', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em'
      }}>
        <ChatText size={11} weight="bold" /> SMS
      </span>
    );
  }
  return (
    <span data-testid="source-badge-email" style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, padding: '2px 6px', borderRadius: 2,
      background: '#2563EB18', color: '#2563EB', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em'
    }}>
      <EnvelopeSimple size={11} weight="bold" /> Email
    </span>
  );
}

function timeAgo(ts) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function EmailAccountCard({ acct, provider, onSetupSync, onRetry, onDisconnect, onReconnect, showSyncForm, syncDate, setSyncDate, syncing, retrying, onStartSync, onCancelSync }) {
  const email = provider === 'gmail' ? acct.gmail_email : acct.outlook_email;
  const providerLabel = provider === 'gmail' ? 'Gmail' : 'Outlook';
  const providerColor = provider === 'gmail' ? '#EA4335' : '#0078D4';
  const isProcessing = acct.stats?.is_processing || acct.stats?.ai_pending > 0;
  const needsReconnect = acct.needs_reconnect;

  return (
    <div data-testid={`${provider}-account-${email}`} style={{
      background: '#fff', border: `1px solid ${needsReconnect ? 'var(--error)' : isProcessing ? 'var(--warning)' : 'var(--border-subtle)'}`, borderRadius: 2, overflow: 'hidden',
      transition: 'border-color 0.3s ease',
    }}>
      {/* Reconnect banner */}
      {needsReconnect && (
        <div data-testid={`reconnect-banner-${email}`} style={{
          background: 'rgba(150,69,58,0.1)', padding: '12px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--error)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--error)', fontSize: 13, fontWeight: 600 }}>
            <Warning size={16} weight="fill" />
            Connection expired — unable to sync emails. Please reconnect.
          </div>
          <button
            data-testid={`reconnect-btn-${email}`}
            onClick={() => onReconnect(email)}
            style={{
              background: 'var(--error)', color: '#fff', border: 'none',
              padding: '6px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}
          >
            Reconnect
          </button>
        </div>
      )}
      {/* Processing banner */}
      {isProcessing && (
        <div data-testid={`processing-banner-${email}`} style={{
          background: 'linear-gradient(90deg, #f59e0b, #f97316, #f59e0b)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s linear infinite',
          padding: '10px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: '#fff', fontWeight: 600, fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lightning size={16} weight="fill" />
            Processing {acct.stats.ai_pending} emails... Please wait.
          </div>
          <div className="mono" style={{ fontSize: 12, opacity: 0.9 }}>
            {acct.stats.processed_by_ai + acct.stats.no_transaction} / {acct.stats.total_synced} analyzed
          </div>
        </div>
      )}
      <div style={{
        padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PlugsConnected size={20} weight="duotone" style={{ color: 'var(--success)' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              {email}
              <span style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 2,
                background: `${providerColor}18`, color: providerColor, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>{providerLabel}</span>
              {/* Status badge */}
              {acct.syncing ? (
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, background: 'rgba(74,110,125,0.15)', color: 'var(--info)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Syncing</span>
              ) : isProcessing ? (
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Processing</span>
              ) : acct.sync_from_date ? (
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, background: 'rgba(58,92,74,0.15)', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</span>
              ) : (
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, background: 'rgba(150,69,58,0.15)', color: 'var(--error)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Setup Required</span>
              )}
            </div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Connected {acct.connected_at ? new Date(acct.connected_at).toLocaleDateString() : ''}
              {acct.sync_from_date ? ` | Syncing from ${acct.sync_from_date} | Auto-syncs every 2 min` : ' | Set a sync date to start'}
              {(acct.stats?.last_sync_at || acct.last_sync_at) && (
                <> · Last checked {timeAgo(acct.stats?.last_sync_at || acct.last_sync_at)}</>
              )}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!acct.sync_from_date && (
            <button data-testid={`setup-sync-btn-${email}`}
              onClick={() => onSetupSync(email)}
              style={{
                background: 'var(--accent-1)', color: '#fff', border: 'none',
                padding: '8px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 4
              }}>
              <CalendarBlank size={14} /> Set Sync Date
            </button>
          )}
          {acct.sync_from_date && (
            <>
              <button data-testid={`resync-btn-${email}`}
                onClick={() => onSetupSync(email)}
                disabled={acct.syncing}
                style={{
                  background: 'var(--bg-primary)', border: '1px solid var(--border-strong)',
                  padding: '8px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                  cursor: acct.syncing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                  display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)'
                }}>
                <CloudArrowUp size={14} /> {acct.syncing ? 'Syncing...' : 'Change Sync Date'}
              </button>
              <button data-testid={`retry-btn-${email}`}
                onClick={() => onRetry(email)}
                disabled={retrying || isProcessing}
                style={{
                  background: isProcessing ? 'var(--warning)' : 'var(--bg-primary)',
                  border: isProcessing ? 'none' : '1px solid var(--border-strong)',
                  padding: '8px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                  cursor: (retrying || isProcessing) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: isProcessing ? '#fff' : 'var(--text-secondary)',
                  opacity: isProcessing ? 0.9 : 1,
                }}>
                {isProcessing ? (
                  <><ArrowClockwise size={14} className="spin" /> Processing...</>
                ) : retrying ? (
                  <><ArrowClockwise size={14} className="spin" /> Starting...</>
                ) : (
                  <><ArrowClockwise size={14} /> Retry Pending</>
                )}
              </button>
            </>
          )}
          <button data-testid={`disconnect-btn-${email}`}
            onClick={() => onDisconnect(email)}
            style={{
              background: 'none', border: '1px solid var(--error)',
              padding: '8px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--error)'
            }}>
            Disconnect
          </button>
        </div>
      </div>

      {showSyncForm === email && (
        <div data-testid={`sync-form-${email}`} style={{
          padding: '16px 24px', background: 'rgba(194,109,92,0.05)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {/* Quick presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Quick select:</span>
            {[
              { label: 'Last 7 days', days: 7 },
              { label: 'Last 30 days', days: 30 },
              { label: 'Last 3 months', days: 90 },
              { label: 'Last 6 months', days: 180 },
            ].map(({ label, days }) => {
              const d = new Date();
              d.setDate(d.getDate() - days);
              const val = d.toISOString().slice(0, 10);
              return (
                <button key={days} data-testid={`preset-${days}d`}
                  onClick={() => setSyncDate(val)}
                  style={{
                    padding: '4px 10px', fontSize: 12, fontWeight: 500,
                    background: syncDate === val ? 'var(--brand-primary)' : '#fff',
                    color: syncDate === val ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${syncDate === val ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
                    borderRadius: 2, cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
          {/* Date input row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Sync emails from:
            </label>
            <input data-testid="sync-date-input" type="date" value={syncDate}
              onChange={e => setSyncDate(e.target.value)}
              style={{
                padding: '8px 14px', border: '1px solid var(--border-strong)', borderRadius: 2,
                fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff'
              }} />
            <button data-testid="start-sync-btn" data-guard onClick={() => onStartSync(email)}
              disabled={syncing || !syncDate}
              style={{
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
                padding: '8px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                opacity: syncing || !syncDate ? 0.6 : 1
              }}>
              {syncing ? 'Starting...' : 'Start Sync'}
            </button>
            <button onClick={onCancelSync}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)'
              }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {acct.stats && (
        <div style={{ padding: '20px 24px' }}>
          {/* Progress bar when processing */}
          {isProcessing && acct.stats.total_synced > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Processing Progress</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {Math.round(((acct.stats.processed_by_ai + acct.stats.no_transaction) / acct.stats.total_synced) * 100)}%
                </span>
              </div>
              <div style={{
                width: '100%', height: 8, background: 'var(--bg-secondary)',
                borderRadius: 4, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${((acct.stats.processed_by_ai + acct.stats.no_transaction) / acct.stats.total_synced) * 100}%`,
                  background: 'linear-gradient(90deg, var(--success), #10b981)',
                  borderRadius: 4,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatPill label="Total Emails" value={acct.stats.total_synced} color="var(--info)" />
            <StatPill label="Transactions Found" value={acct.stats.transactions_created} color="var(--success)" pulsing={isProcessing} />
            <StatPill label="Skipped" value={acct.stats.no_transaction} color="var(--text-muted)" />
            <StatPill label="In Queue" value={acct.stats.ai_pending} color="var(--warning)" pulsing={isProcessing} />
            <StatPill label="Failed" value={acct.stats.ai_failed} color="var(--error)" />
            <StatPill label="Needs Review" value={acct.stats.pending_review} color="var(--accent-1)" />
          </div>
          {acct.syncing && (
            <div className="mono" style={{
              marginTop: 12, padding: '8px 12px', background: 'rgba(74,110,125,0.1)',
              borderRadius: 2, fontSize: 12, color: 'var(--info)',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <ArrowClockwise size={14} className="spin" /> Syncing emails in background...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmailSync() {
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);

  // Premium gate (added 2026-05-13). Email Sync is the paid Premium tier
  // (₹199/month). If the user isn't subscribed, present the inline upsell
  // modal on mount. Mirrors iOS EmailSyncView + Android EmailSyncScreen.
  // Backend already 402s /api/email/* endpoints for free users — this just
  // makes the UX intentional rather than letting them hit error toasts.
  const { user, loading: authLoading } = useAuth();
  const hasPremium = user?.subscription_status === 'active';
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [initialGateChecked, setInitialGateChecked] = useState(false);

  // Wait for AuthContext to finish loading before deciding whether to
  // open the modal. Without this guard, subscribers see a brief flash of
  // the upsell modal during the auth round-trip because `user` is null
  // on first render and `hasPremium` resolves to false.
  useEffect(() => {
    if (authLoading || initialGateChecked) return;
    setInitialGateChecked(true);
    if (!hasPremium) setShowPremiumModal(true);
  }, [authLoading, hasPremium, initialGateChecked]);

  // Auto-close if the user subscribes mid-session (e.g. completes PayU
  // and returns to /email-sync — AuthContext.checkAuth re-runs on mount
  // and flips user.subscription_status to 'active').
  useEffect(() => {
    if (hasPremium) setShowPremiumModal(false);
  }, [hasPremium]);

  const cached = getCached('emailsync');
  const [gmailStatus, setGmailStatus] = useState(cached?.gmailStatus || null);
  const [outlookStatus, setOutlookStatus] = useState(cached?.outlookStatus || null);
  const [smsStats, setSmsStats] = useState(cached?.smsStats || null);
  const [loading, setLoading] = useState(!cached);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [connectingOutlook, setConnectingOutlook] = useState(false);
  const [syncDate, setSyncDate] = useState('');
  const [showSyncForm, setShowSyncForm] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [smsRetrying, setSmsRetrying] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [viewingSource, setViewingSource] = useState(null);
  const [pendingTxns, setPendingTxns] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const [gStatus, oStatus, sStats, review, accs, cats] = await Promise.all([
        api.get('/api/gmail/status', { bypassCache: true }),
        api.get('/api/outlook/status', { bypassCache: true }),
        api.get('/api/sms/stats', { bypassCache: true }),
        api.get('/api/email/pending-review', { bypassCache: true }),
        api.get('/api/accounts'),
        api.get('/api/categories'),
      ]);
      setGmailStatus(gStatus);
      setOutlookStatus(oStatus);
      setSmsStats(sStats);
      setPendingTxns(review.transactions);
      setPendingTotal(review.total);
      setAccounts(accs);
      setCategories(cats);
      setCache('emailsync', { gmailStatus: gStatus, outlookStatus: oStatus, smsStats: sStats });
    } catch {
      // Email sync status will show default state on error
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    loadStatus().then(() => { if (!active) return; }); // eslint-disable-line react-hooks/set-state-in-effect
    return () => { active = false; };
  }, [loadStatus]);

  useEffect(() => {
    const gmailSyncing = gmailStatus?.accounts?.some(a => a.syncing);
    const outlookSyncing = outlookStatus?.accounts?.some(a => a.syncing);
    const gmailPending = gmailStatus?.accounts?.some(a => a.stats?.ai_pending > 0);
    const outlookPending = outlookStatus?.accounts?.some(a => a.stats?.ai_pending > 0);
    const isActive = gmailSyncing || outlookSyncing || gmailPending || outlookPending;
    if (!isActive) return;
    const interval = setInterval(loadStatus, 3000);
    return () => clearInterval(interval);
  }, [gmailStatus, outlookStatus, loadStatus]);

  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    setError('');
    try {
      const res = await api.get('/api/gmail/connect');
      window.location.href = res.auth_url;
    } catch (err) {
      setError(err.message);
    } finally {
      setConnectingGmail(false);
    }
  };

  const handleConnectOutlook = async () => {
    setConnectingOutlook(true);
    setError('');
    try {
      const res = await api.get('/api/outlook/connect');
      window.location.href = res.auth_url;
    } catch (err) {
      setError(err.message);
    } finally {
      setConnectingOutlook(false);
    }
  };

  const handleGmailStartSync = async (gmail_email) => {
    if (!syncDate) { setError('Please select a sync date'); return; }
    setSyncing(true);
    setError('');
    try {
      await api.post('/api/email/start-sync', { gmail_email, sync_from_date: syncDate });
      setShowSyncForm(null);
      setSyncDate('');
      setTimeout(loadStatus, 1000);
    } catch (err) { setError(err.message); } finally {
      setSyncing(false);
    }
  };

  const handleGmailRetry = async (gmail_email) => {
    setRetrying(true);
    try {
      const res = await api.post('/api/email/retry-pending', { gmail_email });
      if (res.already_processing) {
        setError('Emails are already being processed. Please wait.');
      }
      setTimeout(loadStatus, 1000);
    } catch (err) { setError(err.message); } finally {
      setRetrying(false);
    }
  };

  const handleGmailDisconnect = async (gmail_email) => {
    if (!confirm(`Disconnect Gmail ${gmail_email}?`)) return;
    try {
      await api.post('/api/gmail/disconnect', { gmail_email });
      loadStatus();
    } catch (err) { alert(err.message); }
  };

  const handleOutlookStartSync = async (outlook_email) => {
    if (!syncDate) { setError('Please select a sync date'); return; }
    setSyncing(true);
    setError('');
    try {
      await api.post('/api/outlook/start-sync', { outlook_email, sync_from_date: syncDate });
      setShowSyncForm(null);
      setSyncDate('');
      setTimeout(loadStatus, 1000);
    } catch (err) { setError(err.message); } finally {
      setSyncing(false);
    }
  };

  const handleOutlookRetry = async (outlook_email) => {
    setRetrying(true);
    try {
      const res = await api.post('/api/outlook/retry-pending', { outlook_email });
      if (res.already_processing) {
        setError('Emails are already being processed. Please wait.');
      }
      setTimeout(loadStatus, 1000);
    } catch (err) { setError(err.message); } finally {
      setRetrying(false);
    }
  };

  const handleOutlookDisconnect = async (outlook_email) => {
    if (!confirm(`Disconnect Outlook ${outlook_email}?`)) return;
    try {
      await api.post('/api/outlook/disconnect', { outlook_email });
      loadStatus();
    } catch (err) { alert(err.message); }
  };

  const handleGmailReconnect = async (gmail_email) => {
    try {
      await api.post('/api/gmail/disconnect', { gmail_email });
      const res = await api.get('/api/gmail/connect');
      if (res.auth_url) window.location.href = res.auth_url;
    } catch (err) { alert(err.message); }
  };

  const handleOutlookReconnect = async (outlook_email) => {
    try {
      await api.post('/api/outlook/disconnect', { outlook_email });
      const res = await api.get('/api/outlook/connect');
      if (res.auth_url) window.location.href = res.auth_url;
    } catch (err) { alert(err.message); }
  };

  const handleSmsRetry = async () => {
    setSmsRetrying(true);
    try {
      await api.post('/api/sms/retry-pending');
      setTimeout(loadStatus, 3000);
    } catch (err) { setError(err.message); } finally {
      setSmsRetrying(false);
    }
  };

  const handleApprove = async (txnId) => {
    const prevTxns = pendingTxns;
    const prevTotal = pendingTotal;
    setPendingTxns(prev => prev.filter(t => t.transaction_id !== txnId));
    setPendingTotal(prev => prev - 1);
    try {
      await api.post(`/api/transactions/${txnId}/approve`);
      const [review, accs] = await Promise.all([
        api.get('/api/email/pending-review', { bypassCache: true }),
        api.get('/api/accounts'),
      ]);
      setPendingTxns(review.transactions);
      setPendingTotal(review.total);
      setAccounts(accs);
    } catch (err) {
      setPendingTxns(prevTxns);
      setPendingTotal(prevTotal);
      alert(err.message);
    }
  };

  const handleReject = async (txnId) => {
    const prevTxns = pendingTxns;
    const prevTotal = pendingTotal;
    setPendingTxns(prev => prev.filter(t => t.transaction_id !== txnId));
    setPendingTotal(prev => prev - 1);
    try {
      await api.post(`/api/transactions/${txnId}/reject`);
      const [review, accs] = await Promise.all([
        api.get('/api/email/pending-review', { bypassCache: true }),
        api.get('/api/accounts'),
      ]);
      setPendingTxns(review.transactions);
      setPendingTotal(review.total);
      setAccounts(accs);
    } catch (err) {
      setPendingTxns(prevTxns);
      setPendingTotal(prevTotal);
      alert(err.message);
    }
  };

  const handleApproveAll = async () => {
    if (pendingTxns.length === 0) return;
    if (!window.confirm(`Approve all ${pendingTxns.length} pending transaction${pendingTxns.length !== 1 ? 's' : ''}?`)) return;
    setBulkApproving(true);
    try {
      await Promise.all(pendingTxns.map(t => api.post(`/api/transactions/${t.transaction_id}/approve`)));
      const [review, accs] = await Promise.all([
        api.get('/api/email/pending-review', { bypassCache: true }),
        api.get('/api/accounts'),
      ]);
      setPendingTxns(review.transactions);
      setPendingTotal(review.total);
      setAccounts(accs);
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkApproving(false);
    }
  };

  const handleRejectAll = async () => {
    if (pendingTxns.length === 0) return;
    if (!window.confirm(`Reject all ${pendingTxns.length} pending transaction${pendingTxns.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkRejecting(true);
    try {
      await Promise.all(pendingTxns.map(t => api.post(`/api/transactions/${t.transaction_id}/reject`)));
      const [review, accs] = await Promise.all([
        api.get('/api/email/pending-review', { bypassCache: true }),
        api.get('/api/accounts'),
      ]);
      setPendingTxns(review.transactions);
      setPendingTotal(review.total);
      setAccounts(accs);
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkRejecting(false);
    }
  };

  const handleViewSource = async (txn) => {
    const sourceId = txn.source_email_id || txn.source_sms_id;
    if (!sourceId) { setError('No source linked to this transaction'); return; }
    try {
      const data = await api.get(`/api/source/${sourceId}`);
      setViewingSource(data);
    } catch (err) {
      setError(err.message || 'Failed to load source');
    }
  };

  const getAccountName = (id) => accounts.find(a => a.account_id === id)?.name || 'Unidentified Account';
  const getCategoryName = (id) => categories.find(c => c.category_id === id)?.name || '';

  const toggleSyncForm = (email) => {
    setShowSyncForm(showSyncForm === email ? null : email);
    setSyncDate('');
  };

  const cancelSync = () => {
    setShowSyncForm(null);
    setSyncDate('');
  };

  if (loading) {
    return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>{s('syncing')}</div>;
  }

  const gmailAccounts = gmailStatus?.accounts || [];
  const outlookAccounts = outlookStatus?.accounts || [];
  const hasAnyEmailAccount = gmailAccounts.length > 0 || outlookAccounts.length > 0;
  const hasSmsData = smsStats && smsStats.total_synced > 0;

  return (
    <div data-testid="email-sync-page">
      <style>{`
        @keyframes pulse-stat {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .spin {
          animation: spin-anim 1s linear infinite;
        }
        @keyframes spin-anim {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>{s('email_sync')}</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Connect Gmail or Outlook, and sync SMS from your mobile to auto-detect transactions
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button data-testid="connect-gmail-btn" data-guard onClick={handleConnectGmail} disabled={connectingGmail}
            style={{
              background: '#EA4335', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
              cursor: connectingGmail ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 6, opacity: connectingGmail ? 0.6 : 1
            }}>
            <Plugs size={16} weight="bold" /> {connectingGmail ? 'Connecting...' : 'Connect Gmail'}
          </button>
          <button data-testid="connect-outlook-btn" data-guard onClick={handleConnectOutlook} disabled={connectingOutlook}
            style={{
              background: '#0078D4', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
              cursor: connectingOutlook ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 6, opacity: connectingOutlook ? 0.6 : 1
            }}>
            <MicrosoftOutlookLogo size={16} weight="bold" /> {connectingOutlook ? 'Connecting...' : 'Connect Outlook'}
          </button>
        </div>
      </div>

      {error && (
        <div data-testid="email-sync-error" style={{
          background: 'rgba(150,69,58,0.1)', border: '1px solid var(--error)',
          borderRadius: 2, padding: '12px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--error)'
        }}>
          <Warning size={16} weight="bold" /> {error}
        </div>
      )}

      {/* SMS Stats Section */}
      {hasSmsData && (
        <div data-testid="sms-stats-section" style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden', marginBottom: 20
        }}>
          <div style={{
            padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <DeviceMobile size={20} weight="duotone" style={{ color: '#7C3AED' }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  SMS Messages
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 2,
                    background: '#7C3AED18', color: '#7C3AED', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>Mobile</span>
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Synced from mobile app
                </span>
              </div>
            </div>
            <button data-testid="sms-retry-btn"
              onClick={handleSmsRetry}
              disabled={smsRetrying || (smsStats.ai_pending === 0 && smsStats.ai_failed === 0)}
              style={{
                background: 'var(--bg-primary)', border: '1px solid var(--border-strong)',
                padding: '8px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                cursor: (smsRetrying || (smsStats.ai_pending === 0 && smsStats.ai_failed === 0)) ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 4,
                color: 'var(--text-secondary)',
                opacity: (smsStats.ai_pending === 0 && smsStats.ai_failed === 0) ? 0.5 : 1
              }}>
              <ArrowClockwise size={14} /> {smsRetrying ? 'Retrying...' : 'Retry Failed'}
            </button>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <StatPill label="Total SMS" value={smsStats.total_synced} color="#7C3AED" />
              <StatPill label="Transactions Found" value={smsStats.transactions_created} color="var(--success)" />
              <StatPill label="Skipped" value={smsStats.no_transaction} color="var(--text-muted)" />
              <StatPill label="In Queue" value={smsStats.ai_pending} color="var(--warning)" />
              <StatPill label="Failed" value={smsStats.ai_failed} color="var(--error)" />
              <StatPill label="Needs Review" value={smsStats.pending_review} color="var(--accent-1)" />
            </div>
          </div>
        </div>
      )}

      {/* Email Accounts */}
      {!hasAnyEmailAccount && !hasSmsData ? (
        <div style={{
          textAlign: 'center', padding: 60, background: '#fff',
          border: '1px solid var(--border-subtle)', borderRadius: 2
        }}>
          <EnvelopeSimple size={40} weight="duotone" style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: 8 }}>{s('no_gmail')}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, maxWidth: 420, margin: '0 auto 24px' }}>
            Connect your Gmail or Outlook account to automatically detect transactions from emails.
            SMS messages are synced automatically from the mobile app.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button data-testid="connect-gmail-cta-btn" data-guard onClick={handleConnectGmail} disabled={connectingGmail}
              style={{
                background: '#EA4335', color: '#fff', border: 'none',
                padding: '12px 28px', borderRadius: 2, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6
              }}>
              <Plugs size={16} weight="bold" /> Connect Gmail
            </button>
            <button data-testid="connect-outlook-cta-btn" data-guard onClick={handleConnectOutlook} disabled={connectingOutlook}
              style={{
                background: '#0078D4', color: '#fff', border: 'none',
                padding: '12px 28px', borderRadius: 2, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6
              }}>
              <MicrosoftOutlookLogo size={16} weight="bold" /> Connect Outlook
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {gmailAccounts.map(acct => (
            <EmailAccountCard
              key={acct.gmail_email}
              acct={acct}
              provider="gmail"
              onSetupSync={toggleSyncForm}
              onRetry={handleGmailRetry}
              onDisconnect={handleGmailDisconnect}
              onReconnect={handleGmailReconnect}
              showSyncForm={showSyncForm}
              syncDate={syncDate}
              setSyncDate={setSyncDate}
              syncing={syncing}
              retrying={retrying}
              onStartSync={handleGmailStartSync}
              onCancelSync={cancelSync}
            />
          ))}
          {outlookAccounts.map(acct => (
            <EmailAccountCard
              key={acct.outlook_email}
              acct={acct}
              provider="outlook"
              onSetupSync={toggleSyncForm}
              onRetry={handleOutlookRetry}
              onDisconnect={handleOutlookDisconnect}
              onReconnect={handleOutlookReconnect}
              showSyncForm={showSyncForm}
              syncDate={syncDate}
              setSyncDate={setSyncDate}
              syncing={syncing}
              retrying={retrying}
              onStartSync={handleOutlookStartSync}
              onCancelSync={cancelSync}
            />
          ))}
        </div>
      )}

      {/* Pending Review Transactions */}
      {!loading && (
        <div data-testid="pending-review-section" style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 500, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={20} weight="duotone" style={{ color: 'var(--warning)' }} />
              Pending Review
              <span className="mono" style={{
                fontSize: 12, padding: '2px 8px', background: 'rgba(194,140,60,0.15)',
                color: 'var(--warning)', borderRadius: 2, fontWeight: 600
              }}>{pendingTotal}</span>
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                data-testid="bulk-approve-all-btn"
                onClick={handleApproveAll}
                disabled={bulkApproving || bulkRejecting || pendingTxns.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  background: 'var(--success)', color: '#fff', border: 'none',
                  borderRadius: 2, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  opacity: (bulkApproving || bulkRejecting) ? 0.7 : 1,
                }}
              >
                <Check size={13} weight="bold" />
                {bulkApproving ? 'Approving…' : 'Approve All'}
              </button>
              <button
                data-testid="bulk-reject-all-btn"
                onClick={handleRejectAll}
                disabled={bulkApproving || bulkRejecting || pendingTxns.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  background: 'none', color: 'var(--error)', border: '1px solid var(--error)',
                  borderRadius: 2, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  opacity: (bulkApproving || bulkRejecting) ? 0.7 : 1,
                }}
              >
                <X size={13} weight="bold" />
                {bulkRejecting ? 'Rejecting…' : 'Reject All'}
              </button>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('source')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('date')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('type')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('description')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('account_label')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('category')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('amount')}</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', position: 'sticky', right: 0, background: 'var(--bg-secondary)', zIndex: 2 }}>{s('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pendingTxns.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <Check size={28} weight="duotone" style={{ color: 'var(--success)', opacity: 0.6 }} />
                        <span style={{ fontWeight: 600 }}>All caught up!</span>
                        <span style={{ fontSize: 12 }}>No transactions are waiting for review right now.</span>
                      </div>
                    </td>
                  </tr>
                )}
                {pendingTxns.map(txn => (
                  <tr key={txn.transaction_id} data-testid={`review-txn-${txn.transaction_id}`}
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <SourceBadge source={txn.source} />
                    </td>
                    <td className="mono" style={{ padding: '10px 16px', fontSize: 12 }}>{txn.date}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        color: txn.transaction_type === 'income' ? 'var(--success)' : txn.transaction_type === 'expense' ? 'var(--error)' : 'var(--info)',
                        background: txn.transaction_type === 'income' ? 'rgba(58,92,74,0.1)' : txn.transaction_type === 'expense' ? 'rgba(150,69,58,0.1)' : 'rgba(74,110,125,0.1)'
                      }}>
                        {txn.transaction_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span>{txn.description || '—'}</span>
                      {txn.is_recurring && (
                        <span title={`Recurring: ${txn.recurring_frequency || 'monthly'}${txn.recurrence_date ? `, day ${txn.recurrence_date}` : ''}`}
                          style={{
                            display: 'inline-block', marginLeft: 6, padding: '1px 6px', borderRadius: 2,
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                            background: 'rgba(74,110,125,0.12)', color: 'var(--info)',
                          }}>
                          {txn.recurring_frequency || 'recurring'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>{getAccountName(txn.account_id)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>{getCategoryName(txn.category_id)}</td>
                    <td className="mono" style={{
                      padding: '10px 16px', textAlign: 'right', fontWeight: 600,
                      color: txn.transaction_type === 'income' ? 'var(--success)' : 'var(--error)'
                    }}>
                      <div>{formatCurrency(txn.amount)}</div>
                      {txn.original_currency && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }} title={`Original: ${txn.original_currency} ${txn.original_amount} @ ${txn.exchange_rate}`}>
                          {txn.original_currency} {txn.original_amount?.toLocaleString()}
                          {txn.is_estimated_rate && <span style={{ color: 'var(--warning)', marginLeft: 4 }}>est.</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', position: 'sticky', right: 0, background: '#fff', zIndex: 1, boxShadow: '-4px 0 8px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button data-testid={`view-source-${txn.transaction_id}`}
                          onClick={() => handleViewSource(txn)} title="View original email or SMS"
                          style={{
                            background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: 'none',
                            borderRadius: 2, padding: '6px 10px', cursor: 'pointer', fontSize: 11,
                            fontWeight: 600, fontFamily: 'var(--font-body)',
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                          <Eye size={12} weight="bold" /> Source
                        </button>
                        <button data-testid={`edit-review-${txn.transaction_id}`}
                          onClick={() => setEditingTxn(txn)} title="Edit before approving"
                          style={{
                            background: 'rgba(74,110,125,0.1)', color: 'var(--info)', border: 'none',
                            borderRadius: 2, padding: '6px 10px', cursor: 'pointer', fontSize: 11,
                            fontWeight: 600, fontFamily: 'var(--font-body)',
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                          <PencilSimple size={12} weight="bold" /> Edit
                        </button>
                        <button data-testid={`approve-review-${txn.transaction_id}`}
                          onClick={() => handleApprove(txn.transaction_id)} title="Approve & Record"
                          style={{
                            background: 'var(--success)', color: '#fff', border: 'none',
                            borderRadius: 2, padding: '6px 12px', cursor: 'pointer', fontSize: 11,
                            fontWeight: 600, fontFamily: 'var(--font-body)',
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                          <Check size={12} weight="bold" /> Approve
                        </button>
                        <button data-testid={`reject-review-${txn.transaction_id}`}
                          onClick={() => handleReject(txn.transaction_id)} title="Reject"
                          style={{
                            background: 'none', border: '1px solid var(--error)', color: 'var(--error)',
                            borderRadius: 2, padding: '6px 12px', cursor: 'pointer', fontSize: 11,
                            fontWeight: 600, fontFamily: 'var(--font-body)',
                            display: 'flex', alignItems: 'center', gap: 4
                          }}>
                          <X size={12} weight="bold" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingTxn && (
        <EditTransactionModal
          transaction={editingTxn}
          accounts={accounts}
          categories={categories}
          isPendingReview={editingTxn.status === 'pending_review'}
          onSave={() => { setEditingTxn(null); loadStatus(); }}
          onClose={() => setEditingTxn(null)}
        />
      )}

      <ViewSourceModal source={viewingSource} onClose={() => setViewingSource(null)} />

      {/* Premium gate (free user → upsell modal). Sits above page content
          but does not unmount the page itself so subscribers returning from
          PayU land directly back on the live data. */}
      {showPremiumModal && (
        <PremiumGateModal onClose={() => setShowPremiumModal(false)} />
      )}
    </div>
  );
}
