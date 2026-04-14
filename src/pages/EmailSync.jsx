import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
  EnvelopeSimple, ArrowClockwise, Check, X, Clock,
  Lightning, Warning, CaretDown, CaretUp, CalendarBlank,
  CloudArrowUp, Plugs, PlugsConnected, MicrosoftOutlookLogo,
  ChatText, DeviceMobile
} from '@phosphor-icons/react';

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

function EmailAccountCard({ acct, provider, onSetupSync, onRetry, onDisconnect, showSyncForm, syncDate, setSyncDate, syncing, retrying, onStartSync, onCancelSync }) {
  const email = provider === 'gmail' ? acct.gmail_email : acct.outlook_email;
  const providerLabel = provider === 'gmail' ? 'Gmail' : 'Outlook';
  const providerColor = provider === 'gmail' ? '#EA4335' : '#0078D4';
  const isProcessing = acct.stats?.is_processing || acct.stats?.ai_pending > 0;

  return (
    <div data-testid={`${provider}-account-${email}`} style={{
      background: '#fff', border: `1px solid ${isProcessing ? 'var(--warning)' : 'var(--border-subtle)'}`, borderRadius: 2, overflow: 'hidden',
      transition: 'border-color 0.3s ease',
    }}>
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
            {acct.stats.processed_by_ai + acct.stats.no_transaction} / {acct.stats.total_synced} done
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
            </div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Connected {acct.connected_at ? new Date(acct.connected_at).toLocaleDateString() : ''}
              {acct.sync_from_date && ` | Syncing from ${acct.sync_from_date}`}
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
          display: 'flex', alignItems: 'center', gap: 16
        }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Sync emails from:
          </label>
          <input data-testid="sync-date-input" type="date" value={syncDate}
            onChange={e => setSyncDate(e.target.value)}
            style={{
              padding: '8px 14px', border: '1px solid var(--border-strong)', borderRadius: 2,
              fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff'
            }} />
          <button data-testid="start-sync-btn" onClick={() => onStartSync(email)}
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
            <StatPill label="Emails Synced" value={acct.stats.total_synced} color="var(--info)" />
            <StatPill label="Processed" value={acct.stats.processed_by_ai} color="var(--success)" pulsing={isProcessing} />
            <StatPill label="No Transaction" value={acct.stats.no_transaction} color="var(--text-muted)" />
            <StatPill label="Pending" value={acct.stats.ai_pending} color="var(--warning)" pulsing={isProcessing} />
            <StatPill label="Failed" value={acct.stats.ai_failed} color="var(--error)" />
            <StatPill label="Transactions Created" value={acct.stats.transactions_created} color="var(--accent-1)" />
            <StatPill label="Pending Review" value={acct.stats.pending_review} color="var(--warning)" />
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
  const [gmailStatus, setGmailStatus] = useState(null);
  const [outlookStatus, setOutlookStatus] = useState(null);
  const [smsStats, setSmsStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [connectingOutlook, setConnectingOutlook] = useState(false);
  const [syncDate, setSyncDate] = useState('');
  const [showSyncForm, setShowSyncForm] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [smsRetrying, setSmsRetrying] = useState(false);
  const [pendingTxns, setPendingTxns] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const [gStatus, oStatus, sStats, review, accs, cats] = await Promise.all([
        api.get('/api/gmail/status'),
        api.get('/api/outlook/status'),
        api.get('/api/sms/stats'),
        api.get('/api/email/pending-review'),
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
    } catch (err) { console.error(err); }
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
    } catch (err) { setError(err.message); }
    setSyncing(false);
  };

  const handleGmailRetry = async (gmail_email) => {
    setRetrying(true);
    try {
      const res = await api.post('/api/email/retry-pending', { gmail_email });
      if (res.already_processing) {
        setError('Emails are already being processed. Please wait.');
      }
      setTimeout(loadStatus, 1000);
    } catch (err) { setError(err.message); }
    setRetrying(false);
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
    } catch (err) { setError(err.message); }
    setSyncing(false);
  };

  const handleOutlookRetry = async (outlook_email) => {
    setRetrying(true);
    try {
      const res = await api.post('/api/outlook/retry-pending', { outlook_email });
      if (res.already_processing) {
        setError('Emails are already being processed. Please wait.');
      }
      setTimeout(loadStatus, 1000);
    } catch (err) { setError(err.message); }
    setRetrying(false);
  };

  const handleOutlookDisconnect = async (outlook_email) => {
    if (!confirm(`Disconnect Outlook ${outlook_email}?`)) return;
    try {
      await api.post('/api/outlook/disconnect', { outlook_email });
      loadStatus();
    } catch (err) { alert(err.message); }
  };

  const handleSmsRetry = async () => {
    setSmsRetrying(true);
    try {
      await api.post('/api/sms/retry-pending');
      setTimeout(loadStatus, 3000);
    } catch (err) { setError(err.message); }
    setSmsRetrying(false);
  };

  const handleApprove = async (txnId) => {
    try {
      await api.post(`/api/transactions/${txnId}/approve`);
      loadStatus();
    } catch (err) { alert(err.message); }
  };

  const handleReject = async (txnId) => {
    try {
      await api.post(`/api/transactions/${txnId}/reject`);
      loadStatus();
    } catch (err) { alert(err.message); }
  };

  const getAccountName = (id) => accounts.find(a => a.account_id === id)?.name || 'Unknown';
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
    return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>Loading sync status...</div>;
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
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Email & SMS Sync</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Connect Gmail or Outlook, and sync SMS from your mobile to auto-detect transactions
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button data-testid="connect-gmail-btn" onClick={handleConnectGmail} disabled={connectingGmail}
            style={{
              background: '#EA4335', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
              cursor: connectingGmail ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 6, opacity: connectingGmail ? 0.6 : 1
            }}>
            <Plugs size={16} weight="bold" /> {connectingGmail ? 'Connecting...' : 'Connect Gmail'}
          </button>
          <button data-testid="connect-outlook-btn" onClick={handleConnectOutlook} disabled={connectingOutlook}
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
              <StatPill label="SMS Synced" value={smsStats.total_synced} color="#7C3AED" />
              <StatPill label="Processed" value={smsStats.processed_by_ai} color="var(--success)" />
              <StatPill label="No Transaction" value={smsStats.no_transaction} color="var(--text-muted)" />
              <StatPill label="Pending" value={smsStats.ai_pending} color="var(--warning)" />
              <StatPill label="Failed" value={smsStats.ai_failed} color="var(--error)" />
              <StatPill label="Transactions Created" value={smsStats.transactions_created} color="var(--accent-1)" />
              <StatPill label="Pending Review" value={smsStats.pending_review} color="var(--warning)" />
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
          <h3 style={{ fontSize: 18, fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: 8 }}>No accounts connected</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, maxWidth: 420, margin: '0 auto 24px' }}>
            Connect your Gmail or Outlook account to automatically detect transactions from emails.
            SMS messages are synced automatically from the mobile app.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button data-testid="connect-gmail-cta-btn" onClick={handleConnectGmail} disabled={connectingGmail}
              style={{
                background: '#EA4335', color: '#fff', border: 'none',
                padding: '12px 28px', borderRadius: 2, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6
              }}>
              <Plugs size={16} weight="bold" /> Connect Gmail
            </button>
            <button data-testid="connect-outlook-cta-btn" onClick={handleConnectOutlook} disabled={connectingOutlook}
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
      {pendingTotal > 0 && (
        <div data-testid="pending-review-section" style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={20} weight="duotone" style={{ color: 'var(--warning)' }} />
            Pending Review
            <span className="mono" style={{
              fontSize: 12, padding: '2px 8px', background: 'rgba(194,140,60,0.15)',
              color: 'var(--warning)', borderRadius: 2, fontWeight: 600
            }}>{pendingTotal}</span>
          </h2>

          <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Source</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Date</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Type</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Description</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Account</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Category</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Amount</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
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
                      {txn.description || '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>{getAccountName(txn.account_id)}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>{getCategoryName(txn.category_id)}</td>
                    <td className="mono" style={{
                      padding: '10px 16px', textAlign: 'right', fontWeight: 600,
                      color: txn.transaction_type === 'income' ? 'var(--success)' : 'var(--error)'
                    }}>
                      {formatCurrency(txn.amount)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
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
    </div>
  );
}
