import { Robot, Check, X } from '@phosphor-icons/react';
import * as aiConsent from '../lib/aiConsent';

/**
 * AI consent modal — web equivalent of the iOS/Android consent sheets.
 * Asks the user to opt in before any data is sent to OpenAI.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void           (also fires when user picks "Don't allow")
 *  - onGrant: () => void           (called after consent is granted, before close)
 */
export default function AIConsentModal({ isOpen, onClose, onGrant }) {
  if (!isOpen) return null;

  const handleAllow = () => {
    aiConsent.grant();
    if (typeof onGrant === 'function') onGrant();
    if (typeof onClose === 'function') onClose();
  };

  return (
    <div
      data-testid="ai-consent-modal"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 8,
          maxWidth: 560, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 28px 16px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--brand-primary) 0%, #2EB34D 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Robot size={22} weight="fill" style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{
              fontSize: 18, fontWeight: 600, color: 'var(--text-primary)',
              margin: 0, letterSpacing: '-0.01em',
            }}>
              Allow AI processing?
            </h2>
            <p style={{
              fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4,
            }}>
              SpentyAI uses OpenAI to power AI Chat, email parsing, SMS parsing, receipts, and bank statements.
            </p>
          </div>
          <button
            data-testid="ai-consent-close-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '20px 28px',
          fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65,
        }}>
          <p style={{ marginTop: 0, marginBottom: 16 }}>
            Our only third-party AI provider is <strong>OpenAI</strong> (operated by OpenAI, L.L.C., based in
            the United States).
          </p>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              What data is sent to OpenAI
            </h3>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li><strong>AI Chat:</strong> your typed question plus a structured summary of your accounts,
                recent transactions, categories, customers, vendors, invoices, and bills.</li>
              <li><strong>Email parsing:</strong> the body text of transaction-related emails from any inbox
                you have explicitly connected (Gmail or Outlook).</li>
              <li><strong>SMS parsing:</strong> the body text of bank/payment SMS messages you have uploaded.</li>
              <li><strong>Receipt scanning:</strong> the photo of a receipt you have uploaded.</li>
              <li><strong>Bank statement parsing:</strong> the contents of any bank statement (PDF, CSV, or
                Excel) you have uploaded.</li>
            </ul>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              What is never sent
            </h3>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>Account passwords, OAuth refresh tokens, full bank account or card numbers, Aadhaar / PAN,
                or any government-issued ID number.</li>
              <li>Anything from emails or SMS that we have not classified as transaction-related.</li>
            </ul>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              How the data travels
            </h3>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>All data is sent over TLS to api.openai.com.</li>
              <li>Per OpenAI's API terms (effective since March 2023), API request data is not retained beyond
                30 days for abuse monitoring and is not used to train OpenAI's models.</li>
              <li>For full details, see OpenAI's privacy and data-usage policy at{' '}
                <a href="https://openai.com/policies/" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>
                  openai.com/policies
                </a>.
              </li>
            </ul>
          </div>

          <div>
            <h3 style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Your control
            </h3>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>AI features are opt-in. We won't send anything to OpenAI until you tap{' '}
                <strong>Allow AI features</strong> below.</li>
              <li>You can revoke consent at any time from <strong>Settings &rarr; Privacy</strong> on the iOS
                app, the Android app, or the web app. Revoking consent disables all AI features for that account.</li>
            </ul>
          </div>
        </div>

        {/* Footer / actions */}
        <div style={{
          padding: '16px 28px 24px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap',
          background: 'var(--bg-secondary)', borderRadius: '0 0 8px 8px',
        }}>
          <button
            data-testid="ai-consent-deny-btn"
            onClick={onClose}
            style={{
              background: 'none', color: 'var(--text-secondary)',
              border: '1px solid var(--border-strong)',
              padding: '10px 22px', borderRadius: 2,
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}
          >
            Don't allow
          </button>
          <button
            data-testid="ai-consent-allow-btn"
            onClick={handleAllow}
            style={{
              background: 'var(--brand-primary)', color: '#fff', border: 'none',
              padding: '10px 22px', borderRadius: 2,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Check size={14} weight="bold" /> Allow AI features
          </button>
        </div>
      </div>
    </div>
  );
}
