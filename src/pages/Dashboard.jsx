import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import {
  TrendUp, TrendDown, Scales, Clock, ArrowRight, Plus,
  Robot, PaperPlaneTilt, X, SpinnerGap, CheckCircle,
  CaretRight, EnvelopeSimple, Check, Prohibit, Eye, ChatText
} from '@phosphor-icons/react';
import { EditTransactionModal } from '../components/EditTransactionModal';
import { SalesInvoiceModal } from '../components/SalesInvoiceModal';
import { PurchaseBillModal } from '../components/PurchaseBillModal';
import { InternationalInvoiceModal } from '../components/InternationalInvoiceModal';
import AIConsentModal from '../components/AIConsentModal';
import * as aiConsent from '../lib/aiConsent';
import { usesExistingForms } from '../lib/countryConfig';
import { s, toggleLanguage, getCurrentLanguage } from '../lib/localization';

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
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{source.from || '\u2014'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Date</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{source.date || '\u2014'}</div>
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
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{source.sender || '\u2014'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Date</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{source.date || '\u2014'}</div>
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

function StatCard({ testId, label, value, icon: Icon, color, accent, onClick }) {
  return (
    <div data-testid={testId} onClick={onClick} style={{
      background: '#fff', border: '1px solid var(--border-subtle)',
      padding: '24px 28px', borderRadius: 2,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: onClick ? 'pointer' : 'default',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(52,199,89,0.06)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
          {label}
        </span>
        <Icon size={20} weight="duotone" style={{ color: accent || 'var(--text-muted)' }} />
      </div>
      <div className="mono" style={{ fontSize: 'clamp(18px, 2.2vw, 28px)', fontWeight: 600, color: color || 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  );
}

function formatCurrency(amount) {
  if (Math.abs(amount) >= 1_00_00_000) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(amount);
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function CollapsibleSection({ title, count, defaultExpanded = false, testId, children }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div data-testid={testId} style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', fontFamily: 'var(--font-body)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CaretRight
            size={14}
            weight="bold"
            style={{
              color: 'var(--text-muted)',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease',
            }}
          />
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            {title}
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 6 }}>
              ({count})
            </span>
          </h3>
        </div>
      </button>
      <div style={{
        maxHeight: expanded ? '2000px' : '0',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.35s ease, opacity 0.25s ease',
      }}>
        <div style={{ padding: '0 24px 24px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function AIChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  // Buffered prompt awaiting consent — when set, granting consent triggers send.
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const messagesEndRef = useRef(null);

  const quickPrompts = [
    "What's my spending breakdown this month?",
    "Which category am I spending the most on?",
    "How much have I saved this month?",
    "What are my upcoming loan EMIs?",
    "Show me my account balances",
    "What was my biggest expense recently?",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Performs the actual send (used by both the consent-cleared path and the
  // post-grant continuation). Pulled out so the consent gate can call it
  // without re-running the gate.
  const performSend = async (inputText) => {
    const userMessage = { role: 'user', content: inputText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const res = await api.post('/api/ai/chat', { message: inputText, conversation: [...messages, userMessage] });
      const assistantMessage = { role: 'assistant', content: res.reply || res.message || res.content || '' };
      if (res.transaction_posted && res.transaction) {
        assistantMessage.transaction = res.transaction;
      }
      if (res.invoice_created && res.invoice) {
        assistantMessage.invoice = res.invoice;
      }
      if (res.bill_created && res.bill) {
        assistantMessage.bill = res.bill;
      }
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    }

    setSending(false);
    setTimeout(scrollToBottom, 100);
  };

  // Public entry point — gates AI calls behind the one-time consent prompt.
  // If consent is missing, buffers the prompt and opens the consent modal;
  // the modal's onGrant callback will resume the send.
  const sendMessage = (text) => {
    const inputText = (text || input).trim();
    if (sending || !inputText) return;

    if (!aiConsent.hasConsented()) {
      setPendingPrompt(inputText);
      setShowConsentModal(true);
      return;
    }

    performSend(inputText);
  };

  const handleConsentGranted = () => {
    if (pendingPrompt) {
      const buffered = pendingPrompt;
      setPendingPrompt(null);
      // Fire after the modal dismisses so state updates settle.
      setTimeout(() => performSend(buffered), 0);
    }
  };

  const handleConsentClosed = () => {
    setShowConsentModal(false);
    setPendingPrompt(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <>
      <style>{`@keyframes ai-spin { to { transform: rotate(360deg); } } .spin { animation: ai-spin 1s linear infinite; } @media (max-width: 767px) { .ai-chat-panel { left: 8px !important; right: 8px !important; bottom: 80px !important; width: auto !important; max-height: 75vh !important; } }`}</style>

      {/* Floating AI button */}
      <button onClick={() => setOpen(!open)} style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
        height: 48, borderRadius: 24,
        background: 'linear-gradient(135deg, var(--brand-primary) 0%, #2EB34D 100%)',
        color: '#fff', border: 'none',
        boxShadow: '0 4px 20px rgba(52,199,89,0.3)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'transform 0.2s, box-shadow 0.2s',
        padding: open ? '0 16px' : '0 18px 0 14px',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(52,199,89,0.4)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(52,199,89,0.3)'; }}
      >
        {open ? (
          <X size={20} />
        ) : (
          <>
            <Robot size={20} weight="fill" />
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', letterSpacing: '-0.01em' }}>Ask AI</span>
          </>
        )}
      </button>

      {open && (
        <div className="ai-chat-panel" style={{
          position: 'fixed', bottom: 92, right: 24, zIndex: 999,
          width: 420, height: 560, maxHeight: '70vh',
          background: '#fff', border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(52,199,89,0.12)',
          borderRadius: 8, display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'var(--brand-primary)', color: '#fff', borderRadius: '8px 8px 0 0',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Robot size={18} weight="duotone" /> SpentyAI Assistant
              </div>
              <div className="mono" style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>Ask anything about your finances</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {messages.length === 0 ? (
              <div style={{ padding: '8px 0' }}>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                  I can analyse your finances, answer questions about your spending, and even post transactions for you. Try asking:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {quickPrompts.map((prompt, i) => (
                    <button key={i} onClick={() => sendMessage(prompt)} style={{
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                      borderRadius: 16, padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)',
                      cursor: 'pointer', fontFamily: 'var(--font-body)',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,199,89,0.06)'; e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.color = 'var(--brand-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
                      maxWidth: '80%',
                      padding: '10px 14px',
                      fontSize: 13,
                      lineHeight: 1.5,
                      background: msg.role === 'user' ? 'var(--brand-primary)' : 'var(--bg-secondary)',
                      color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                      borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    }}>
                      {msg.content}
                      {msg.transaction && (
                        <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(52,199,89,0.08)', borderRadius: 6, border: '1px solid rgba(52,199,89,0.15)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>
                            <CheckCircle size={14} weight="fill" /> Transaction Posted
                          </div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {msg.transaction.transaction_type} · ₹{msg.transaction.amount.toLocaleString('en-IN')} · {msg.transaction.date}
                          </div>
                        </div>
                      )}
                      {msg.invoice && (
                        <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(74,110,125,0.08)', borderRadius: 6, border: '1px solid rgba(74,110,125,0.15)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--info)', marginBottom: 4 }}>
                            <CheckCircle size={14} weight="fill" /> Invoice Created
                          </div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {msg.invoice.invoice_number} · {msg.invoice.customer_name} · ₹{(msg.invoice.grand_total || 0).toLocaleString('en-IN')} · {msg.invoice.payment_status}
                          </div>
                        </div>
                      )}
                      {msg.bill && (
                        <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(194,109,92,0.08)', borderRadius: 6, border: '1px solid rgba(194,109,92,0.15)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--brand-primary)', marginBottom: 4 }}>
                            <CheckCircle size={14} weight="fill" /> Bill Recorded
                          </div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {msg.bill.bill_number} · {msg.bill.vendor_name} · ₹{(msg.bill.grand_total || 0).toLocaleString('en-IN')} · {msg.bill.payment_status}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      padding: '10px 14px', fontSize: 13, background: 'var(--bg-secondary)',
                      borderRadius: '12px 12px 12px 2px', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <SpinnerGap size={14} className="spin" /> Thinking...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} style={{
            padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
            display: 'flex', gap: 8, background: '#fff', borderRadius: '0 0 8px 8px',
          }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              disabled={sending}
              style={{
                flex: 1, padding: '10px 14px', border: '1px solid var(--border-strong)',
                borderRadius: 20, fontSize: 13, fontFamily: 'var(--font-body)',
                background: '#fff', outline: 'none',
              }} />
            <button type="submit" disabled={sending || !input.trim()}
              style={{
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
                width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: (sending || !input.trim()) ? 0.5 : 1,
              }}>
              {sending ? <SpinnerGap size={16} className="spin" /> : <PaperPlaneTilt size={16} weight="fill" />}
            </button>
          </form>
        </div>
      )}

      <AIConsentModal
        isOpen={showConsentModal}
        onClose={handleConsentClosed}
        onGrant={handleConsentGranted}
      />
    </>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(() => getCached('dashboard'));
  const [loading, setLoading] = useState(!getCached('dashboard'));
  const [lang, setLang] = useState(getCurrentLanguage());
  const navigate = useNavigate();

  // Listen for language changes from other components
  useEffect(() => {
    const handler = () => setLang(getCurrentLanguage());
    window.addEventListener('languageChanged', handler);
    return () => window.removeEventListener('languageChanged', handler);
  }, []);

  const handleToggleLanguage = () => {
    toggleLanguage();
    setLang(getCurrentLanguage());
  };

  // New Transaction modal state
  const [showNewTxn, setShowNewTxn] = useState(false);
  const [modalAccounts, setModalAccounts] = useState([]);
  const [modalCategories, setModalCategories] = useState([]);
  const [showSalesInvoice, setShowSalesInvoice] = useState(false);
  const [showPurchaseInvoice, setShowPurchaseInvoice] = useState(false);
  const [businessCountry, setBusinessCountry] = useState('IN');

  // Pending approval state
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [viewingSource, setViewingSource] = useState(null);

  // Next month projection state
  const [projection, setProjection] = useState(null);

  const openNewTxnModal = async () => {
    setShowNewTxn(true);
    try {
      const [accs, cats] = await Promise.all([
        api.get('/api/accounts'),
        api.get('/api/categories'),
      ]);
      setModalAccounts(accs);
      setModalCategories(cats);
    } catch { /* modal will show empty selects */ }
  };

  // Handle switch from transaction modal to invoice modals
  const handleSwitchToInvoice = async (type) => {
    setShowNewTxn(false);
    // Check settings gate — firm name must be set
    try {
      const settings = await api.get('/api/settings');
      setBusinessCountry(settings.business_country || 'IN');
      if (!settings.firm_name?.trim()) {
        navigate(type === 'sales_invoice' ? '/settings?setup=invoice' : '/settings?setup=bill');
        return;
      }
    } catch { /* proceed anyway */ }
    // Load accounts for invoice modals
    if (modalAccounts.length === 0) {
      try { const accs = await api.get('/api/accounts'); setModalAccounts(accs); } catch {}
    }
    if (type === 'sales_invoice') setShowSalesInvoice(true);
    else setShowPurchaseInvoice(true);
  };

  const loadData = useCallback(async () => {
    try {
      const data = await api.get('/api/dashboard/summary');
      setSummary(data);
      setCache('dashboard', data);
    } catch {
      // Dashboard will show empty/default state on error
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const data = await api.get('/api/email/pending-review');
      setPendingItems(data.transactions || []);
    } catch {
      setPendingItems([]);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const handleApprove = async (id) => {
    try {
      await api.post(`/api/transactions/${id}/approve`);
      setPendingItems(prev => prev.filter(t => t.transactionId !== id));
    } catch { /* silent */ }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/api/transactions/${id}/reject`);
      setPendingItems(prev => prev.filter(t => t.transactionId !== id));
    } catch { /* silent */ }
  };

  const handleViewSource = async (txn) => {
    const sourceId = txn.source_email_id || txn.sourceSmsId || txn.source_sms_id || txn.sourceEmailId;
    if (!sourceId) return;
    try {
      const data = await api.get(`/api/source/${sourceId}`);
      setViewingSource(data);
    } catch { /* silent */ }
  };

  const loadProjection = useCallback(async () => {
    try {
      const data = await api.get('/api/cashflow/projection');
      setProjection(data);
    } catch {
      // Projection is non-critical
    }
  }, []);

  useEffect(() => {
    loadData();
    loadPending();
    loadProjection();
  }, [loadData, loadPending, loadProjection]);

  if (loading) {
    return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>{s('loading_dashboard')}</div>;
  }

  if (!summary) {
    return <div style={{ color: 'var(--error)', padding: 40 }}>{s('failed_load_dashboard')}</div>;
  }

  return (
    <div data-testid="dashboard-page">
      <div className="action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>{s('dashboard')}</h1>
          <p className="mono page-subtitle" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {s('financial_overview')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button data-testid="language-toggle-btn" onClick={handleToggleLanguage} style={{
            background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)',
            padding: '8px 14px', borderRadius: 2, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            transition: 'background 0.2s ease',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
          >
            {lang === 'en' ? '\u0939\u093F/En' : 'En/\u0939\u093F'}
          </button>
          <button data-testid="add-transaction-btn" onClick={openNewTxnModal} style={{
            background: 'var(--brand-primary)', color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'background 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#2EB34D'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--brand-primary)'}
          >
            <Plus size={14} weight="bold" /> {s('new_transaction')}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard testId="stat-net-worth" label={s('net_worth')} value={formatCurrency(summary.net_worth)} icon={Scales} color="var(--brand-primary)" accent="var(--accent-3)" onClick={() => navigate('/accounts')} />
        <StatCard testId="stat-income" label={s('income_this_month')} value={formatCurrency(summary.income_this_month)} icon={TrendUp} color="var(--success)" accent="var(--success)" onClick={() => navigate('/transactions?type=income')} />
        <StatCard testId="stat-expenses" label={s('expenses_this_month')} value={formatCurrency(summary.expense_this_month)} icon={TrendDown} color="var(--error)" accent="var(--error)" onClick={() => navigate('/transactions?type=expense')} />
        <StatCard testId="stat-pending" label={s('pending_review')} value={summary.pending_review} icon={Clock} color="var(--warning)" accent="var(--warning)" onClick={() => { const el = document.querySelector('[data-testid="pending-approval"]'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }} />
      </div>

      {/* Next Month Projection */}
      {projection && (
        <div data-testid="next-month-projection" style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
          padding: '24px 28px', marginBottom: 32,
        }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {s('may_projection') || `${projection.month || 'Next Month'} Projection`}
            </h3>
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {s('upcoming_outflows') || 'Upcoming outflows next month'}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                {s('expenses') || 'Expenses'}
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--error)' }}>
                {formatCurrency(projection.expenses || 0)}
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                {s('emis') || 'EMIs'}
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--warning)' }}>
                {formatCurrency(projection.emis || 0)}
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                {s('od_interest') || 'OD Interest'}
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--info)' }}>
                {formatCurrency(projection.od_interest || 0)}
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                {s('total_outflow') || 'Total Outflow'}
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatCurrency(projection.total_outflow || 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Accounts */}
        <CollapsibleSection title={s('accounts')} count={summary.accounts?.length || 0} testId="accounts-overview">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button data-testid="view-all-accounts-btn" onClick={() => navigate('/accounts')} style={{
              background: 'none', border: 'none', color: 'var(--accent-1)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
              {s('view_all')} <ArrowRight size={12} />
            </button>
          </div>
          {summary.accounts?.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s('no_accounts_yet')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {summary.accounts?.map(acc => (
                <div key={acc.account_id}
                  onClick={() => navigate(`/accounts/${acc.account_id}`)}
                  style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 2,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,199,89,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{acc.name}</div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {acc.account_type} {acc.sub_type ? `/ ${acc.sub_type}` : ''}
                    </span>
                  </div>
                  <span className="mono" style={{
                    fontSize: 'clamp(11px, 1.5vw, 15px)', fontWeight: 600,
                    color: acc.balance >= 0 ? 'var(--success)' : 'var(--error)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '50%', textAlign: 'right'
                  }}>
                    {formatCurrency(acc.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Recent Transactions */}
        <CollapsibleSection title={s('recent_transactions')} count={summary.recent_transactions?.length || 0} testId="recent-transactions">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button data-testid="view-all-transactions-btn" onClick={() => navigate('/transactions')} style={{
              background: 'none', border: 'none', color: 'var(--accent-1)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
              {s('view_all')} <ArrowRight size={12} />
            </button>
          </div>
          {summary.recent_transactions?.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {pendingItems.length > 0
                ? `${s('no_approved_transactions')}. ${pendingItems.length} ${s('pending_review')}.`
                : s('no_transactions_yet')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {summary.recent_transactions?.map(txn => (
                <div key={txn.transaction_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)'
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{txn.description || txn.transaction_type}</div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{txn.date}</span>
                  </div>
                  <span className="mono" style={{
                    fontSize: 'clamp(11px, 1.5vw, 14px)', fontWeight: 600,
                    color: txn.transaction_type === 'income' ? 'var(--success)' :
                           txn.transaction_type === 'expense' ? 'var(--error)' : 'var(--info)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '50%', textAlign: 'right'
                  }}>
                    {txn.transaction_type === 'income' ? '+' : txn.transaction_type === 'expense' ? '-' : ''}
                    {formatCurrency(txn.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      </div>

      {/* Pending Approval — full width */}
      <div style={{ position: 'relative' }}>
        {pendingLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'absolute', top: -24, right: 0, zIndex: 1 }}>
            <SpinnerGap size={14} className="spin" style={{ color: 'var(--text-muted)' }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s('syncing') || 'Syncing...'}</span>
          </div>
        )}
      </div>
      <CollapsibleSection title={s('pending_approval')} count={pendingItems.length} testId="pending-approval">
        {pendingLoading ? (
          <div className="mono" style={{ color: 'var(--text-muted)', padding: '12px 0', fontSize: 13 }}>{s('loading_pending')}</div>
        ) : pendingItems.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s('no_pending_review')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendingItems.map(txn => (
              <div key={txn.transactionId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 2,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <EnvelopeSimple size={18} weight="duotone" style={{ color: 'var(--warning)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {txn.description || 'Transaction'}
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {txn.date} {txn.source ? `\u00b7 ${txn.source}` : ''}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span className="mono" style={{
                    fontSize: 13, fontWeight: 600,
                    color: txn.transactionType === 'income' ? 'var(--success)' : 'var(--error)',
                  }}>
                    {formatCurrency(txn.amount || 0)}
                  </span>
                  {(txn.source_email_id || txn.sourceSmsId || txn.source_sms_id || txn.sourceEmailId) && (
                    <button onClick={() => handleViewSource(txn)} title="View Source" style={{
                      background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4,
                      color: '#2563EB', cursor: 'pointer', padding: '4px 10px',
                      fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)',
                      display: 'flex', alignItems: 'center', gap: 4,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                    >
                      <Eye size={12} weight="bold" /> {s('source')}
                    </button>
                  )}
                  <button onClick={() => handleReject(txn.transactionId)} title={s('reject')} style={{
                    background: 'none', border: '1px solid var(--error)', borderRadius: 4,
                    color: 'var(--error)', cursor: 'pointer', padding: '4px 10px',
                    fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)',
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,50,50,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                  >
                    <Prohibit size={12} weight="bold" /> {s('reject')}
                  </button>
                  <button onClick={() => handleApprove(txn.transactionId)} title={s('approve')} style={{
                    background: 'var(--success)', border: 'none', borderRadius: 4,
                    color: '#fff', cursor: 'pointer', padding: '4px 10px',
                    fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)',
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#2EB34D'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--success)'; }}
                  >
                    <Check size={12} weight="bold" /> {s('approve')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <AIChatPanel />

      {/* New Transaction Modal */}
      {showNewTxn && (
        <EditTransactionModal
          transaction={null}
          accounts={modalAccounts}
          categories={modalCategories}
          onSave={() => { setShowNewTxn(false); loadData(); }}
          onClose={() => setShowNewTxn(false)}
          onSwitchToInvoice={handleSwitchToInvoice}
        />
      )}

      {/* Sales Invoice Modal */}
      {showSalesInvoice && (
        usesExistingForms(businessCountry) ? (
          <SalesInvoiceModal
            invoice={null}
            accounts={modalAccounts}
            onSave={() => { setShowSalesInvoice(false); loadData(); }}
            onClose={() => setShowSalesInvoice(false)}
          />
        ) : (
          <InternationalInvoiceModal
            mode="sales"
            invoice={null}
            accounts={modalAccounts}
            countryCode={businessCountry}
            onSave={() => { setShowSalesInvoice(false); loadData(); }}
            onClose={() => setShowSalesInvoice(false)}
          />
        )
      )}

      {/* View Source Modal */}
      {viewingSource && (
        <ViewSourceModal source={viewingSource} onClose={() => setViewingSource(null)} />
      )}

      {/* Purchase Invoice Modal */}
      {showPurchaseInvoice && (
        usesExistingForms(businessCountry) ? (
          <PurchaseBillModal
            bill={null}
            accounts={modalAccounts}
            onSave={() => { setShowPurchaseInvoice(false); loadData(); }}
            onClose={() => setShowPurchaseInvoice(false)}
          />
        ) : (
          <InternationalInvoiceModal
            mode="purchase"
            bill={null}
            accounts={modalAccounts}
            countryCode={businessCountry}
            onSave={() => { setShowPurchaseInvoice(false); loadData(); }}
            onClose={() => setShowPurchaseInvoice(false)}
          />
        )
      )}
    </div>
  );
}
