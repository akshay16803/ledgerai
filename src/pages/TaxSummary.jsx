import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import {
  Plus, Trash, PencilSimple, DownloadSimple, ArrowLeft,
  TrendUp, TrendDown, Scales, Lightning, CalendarBlank,
  EnvelopeSimple, Plugs, X, Check, SpinnerGap, GoogleLogo, MicrosoftOutlookLogo
} from '@phosphor-icons/react';

const API = import.meta.env.REACT_APP_BACKEND_URL || '';

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function TaxSummary() {
  const cached = getCached('taxsummary');
  const [summaries, setSummaries] = useState(cached?.summaries || []);
  const [availableEmails, setAvailableEmails] = useState([]);
  const [loading, setLoading] = useState(!cached);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', date_from: '', date_to: '', email_address: '', provider: 'gmail' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [activeDetail, setActiveDetail] = useState(null);
  const [connecting, setConnecting] = useState('');

  const loadSummaries = useCallback(async () => {
    try {
      const [res, emailsRes] = await Promise.all([
        api.get('/api/tax-summary', { bypassCache: true }),
        api.get('/api/tax-summary/available-emails', { bypassCache: true }),
      ]);
      setSummaries(res.summaries);
      setAvailableEmails(emailsRes.emails);
      setCache('taxsummary', { summaries: res.summaries });
    } catch {
      // Tax summary will show empty state on error
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSummaries(); }, [loadSummaries]); // eslint-disable-line react-hooks/set-state-in-effect

  // Poll for processing summaries
  useEffect(() => {
    const hasProcessing = summaries.some(s => s.status === 'processing' || s.status === 'analyzing');
    if (!hasProcessing) return;
    const interval = setInterval(loadSummaries, 4000);
    return () => clearInterval(interval);
  }, [summaries, loadSummaries]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.date_from || !form.date_to) { setError('Both dates are required'); return; }
    if (!form.email_address) { setError('Select an email account'); return; }

    setCreating(true);
    try {
      await api.post('/api/tax-summary', form);
      setShowForm(false);
      setForm({ name: '', date_from: '', date_to: '', email_address: '', provider: 'gmail' });
      loadSummaries();
    } catch (err) { setError(err.message); } finally { setCreating(false); }
  };

  const handleDelete = async (summaryId) => {
    if (!confirm('Delete this summary and all its transactions?')) return;
    try {
      await api.del(`/api/tax-summary/${summaryId}`);
      loadSummaries();
    } catch (err) { alert(err.message); }
  };

  const handleExport = (summaryId) => {
    window.open(`${API}/api/tax-summary/${summaryId}/export`, '_blank');
  };

  const handleConnectGmail = async () => {
    setConnecting('gmail');
    try {
      const res = await api.get('/api/gmail/connect');
      if (res.auth_url) { window.location.href = res.auth_url; return; }
    } catch (err) { setError(err.message); }
    setConnecting('');
  };

  const handleConnectOutlook = async () => {
    setConnecting('outlook');
    try {
      const res = await api.get('/api/outlook/connect');
      if (res.auth_url) { window.location.href = res.auth_url; return; }
    } catch (err) { setError(err.message); }
    setConnecting('');
  };

  if (activeDetail) {
    return <TaxSummaryDetail summaryId={activeDetail} onBack={() => { setActiveDetail(null); loadSummaries(); }} />;
  }

  if (loading && summaries.length === 0) {
    return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>Loading...</div>;
  }

  return (
    <div data-testid="tax-summary-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Past Insights</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 560, lineHeight: 1.6 }}>
            Scan your emails for any past period to get a complete income & expense summary — perfect for tax filing or understanding historical spending. These transactions are completely isolated and <strong>do not affect your books</strong>.
          </p>
        </div>
        <button
          data-testid="new-summary-btn"
          onClick={() => setShowForm(!showForm)}
          style={{
            background: 'var(--brand-primary)', color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}
        >
          <Plus size={16} weight="bold" /> New Summary
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(150,69,58,0.1)', border: '1px solid var(--error)',
          borderRadius: 2, padding: '12px 20px', marginBottom: 20, fontSize: 13, color: 'var(--error)',
        }}>{error}</div>
      )}

      {/* Create Form */}
      {showForm && (
        <div data-testid="new-summary-form" style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
          padding: 28, marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Create New Summary</h3>
          <form onSubmit={handleCreate}>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Summary Name</label>
                <input data-testid="ts-name" type="text" placeholder="e.g., FY 2024-25"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email Account</label>
                {availableEmails.length > 0 ? (
                  <>
                    <select data-testid="ts-email"
                      value={form.email_address}
                      onChange={e => {
                        const sel = availableEmails.find(em => em.email === e.target.value);
                        setForm({ ...form, email_address: e.target.value, provider: sel?.provider || 'gmail' });
                      }}
                      style={inputStyle}
                    >
                      <option value="">Select email...</option>
                      {availableEmails.map(em => (
                        <option key={em.email} value={em.email}>{em.email} ({em.provider})</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button type="button" onClick={handleConnectGmail} disabled={!!connecting}
                        style={{ fontSize: 11, color: '#EA4335', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}>
                        <Plus size={10} /> Add Gmail
                      </button>
                      <span style={{ color: 'var(--border-strong)' }}>|</span>
                      <button type="button" onClick={handleConnectOutlook} disabled={!!connecting}
                        style={{ fontSize: 11, color: '#0078D4', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}>
                        <Plus size={10} /> Add Outlook
                      </button>
                    </div>
                  </>
                ) : (
                  <div>
                    <div style={{ padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 2, fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                      No email connected. Connect one to start analyzing.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" data-testid="pi-connect-gmail" onClick={handleConnectGmail} disabled={connecting === 'gmail'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                          background: '#fff', border: '1px solid #EA4335', borderRadius: 2,
                          fontSize: 12, fontWeight: 600, cursor: connecting ? 'not-allowed' : 'pointer',
                          color: '#EA4335', fontFamily: 'var(--font-body)',
                        }}>
                        <GoogleLogo size={14} weight="bold" />
                        {connecting === 'gmail' ? 'Connecting...' : 'Connect Gmail'}
                      </button>
                      <button type="button" data-testid="pi-connect-outlook" onClick={handleConnectOutlook} disabled={connecting === 'outlook'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                          background: '#fff', border: '1px solid #0078D4', borderRadius: 2,
                          fontSize: 12, fontWeight: 600, cursor: connecting ? 'not-allowed' : 'pointer',
                          color: '#0078D4', fontFamily: 'var(--font-body)',
                        }}>
                        <MicrosoftOutlookLogo size={14} weight="bold" />
                        {connecting === 'outlook' ? 'Connecting...' : 'Connect Outlook'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>From Date</label>
                <input data-testid="ts-date-from" type="date" value={form.date_from}
                  onChange={e => setForm({ ...form, date_from: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>To Date</label>
                <input data-testid="ts-date-to" type="date" value={form.date_to}
                  onChange={e => setForm({ ...form, date_to: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button data-testid="ts-submit" type="submit" disabled={creating}
                style={{
                  background: 'var(--brand-primary)', color: '#fff', border: 'none',
                  padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                  cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                  opacity: creating ? 0.6 : 1,
                }}>
                {creating ? 'Creating...' : 'Start Analysis'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                style={{
                  background: 'none', border: '1px solid var(--border-strong)',
                  padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--text-secondary)',
                }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Summary Cards */}
      {summaries.length === 0 && !showForm ? (
        <div style={{
          textAlign: 'center', padding: 60, background: '#fff',
          border: '1px solid var(--border-subtle)', borderRadius: 2,
        }}>
          <Scales size={40} weight="duotone" style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No summaries yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto' }}>
            Create a summary to analyze past email transactions for any period — great for tax filing or historical review.
          </p>
        </div>
      ) : (
        <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {summaries.map(s => (
            <SummaryCard key={s.summary_id} summary={s}
              onView={() => setActiveDetail(s.summary_id)}
              onDelete={() => handleDelete(s.summary_id)}
              onExport={() => handleExport(s.summary_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function SummaryCard({ summary, onView, onDelete, onExport }) {
  const s = summary;
  const isProcessing = s.status === 'processing' || s.status === 'analyzing';
  const isError = s.status === 'error';
  const net = (s.total_income || 0) - (s.total_expenses || 0);

  return (
    <div data-testid={`summary-card-${s.summary_id}`} style={{
      background: '#fff', border: `1px solid ${isProcessing ? 'var(--warning)' : isError ? 'var(--error)' : 'var(--border-subtle)'}`,
      borderRadius: 2, overflow: 'hidden', transition: 'box-shadow 0.2s ease',
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {isProcessing && (
        <div style={{
          background: 'linear-gradient(90deg, #f59e0b, #f97316, #f59e0b)',
          backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite',
          padding: '8px 20px', color: '#fff', fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <SpinnerGap size={14} className="spin" />
          {s.status === 'analyzing' ? `Analyzing ${s.emails_analyzed || 0} / ${s.total_emails_scanned} emails...` : 'Scanning emails...'}
        </div>
      )}
      {isError && (
        <div style={{
          background: 'rgba(150,69,58,0.1)', padding: '8px 20px',
          color: 'var(--error)', fontSize: 12, fontWeight: 600,
        }}>
          Error: {s.error_message || 'Processing failed'}
        </div>
      )}

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{s.name}</h3>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CalendarBlank size={12} /> {s.date_from} — {s.date_to}
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <EnvelopeSimple size={12} /> {s.email_address}
            </div>
          </div>
        </div>

        {s.status === 'complete' && (
          <>
            <div className="stat-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(58,92,74,0.06)', borderRadius: 2 }}>
                <TrendUp size={16} style={{ color: 'var(--success)', marginBottom: 4 }} />
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(s.total_income)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>INCOME</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(150,69,58,0.06)', borderRadius: 2 }}>
                <TrendDown size={16} style={{ color: 'var(--error)', marginBottom: 4 }} />
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--error)' }}>{formatCurrency(s.total_expenses)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>EXPENSES</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: 'rgba(74,110,125,0.06)', borderRadius: 2 }}>
                <Scales size={16} style={{ color: 'var(--info)', marginBottom: 4 }} />
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: net >= 0 ? 'var(--success)' : 'var(--error)' }}>{formatCurrency(net)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>NET</div>
              </div>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              {s.transaction_count} transactions found from {s.total_emails_scanned} emails
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {s.status === 'complete' && (
            <>
              <button data-testid={`view-detail-${s.summary_id}`} onClick={onView}
                style={cardBtnStyle('var(--brand-primary)', '#fff')}>
                View Details
              </button>
              <button data-testid={`export-${s.summary_id}`} data-guard onClick={onExport}
                style={cardBtnStyle('var(--bg-primary)', 'var(--text-secondary)', true)}>
                <DownloadSimple size={13} /> Export
              </button>
            </>
          )}
          <button data-testid={`delete-${s.summary_id}`} data-guard onClick={onDelete}
            style={{ ...cardBtnStyle('none', 'var(--error)', true), border: '1px solid var(--error)', marginLeft: 'auto' }}>
            <Trash size={13} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .spin { animation: spin-anim 1s linear infinite; }
        @keyframes spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}


function TaxSummaryDetail({ summaryId, onBack }) {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTxn, setEditingTxn] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ transaction_type: 'expense', amount: '', date: '', description: '', category: '' });

  const loadDetail = useCallback(async () => {
    try {
      const data = await api.get(`/api/tax-summary/${summaryId}`);
      setSummary(data.summary);
      setTransactions(data.transactions);
    } catch {
      // Detail will show empty state on error
    }
    setLoading(false);
  }, [summaryId]);

  useEffect(() => { loadDetail(); }, [loadDetail]); // eslint-disable-line react-hooks/set-state-in-effect

  const handleEdit = (txn) => {
    setEditingTxn(txn.txn_id);
    setEditForm({ transaction_type: txn.transaction_type, amount: txn.amount, date: txn.date, description: txn.description, category: txn.category || '' });
  };

  const [savingEdit, setSavingEdit] = useState(false);
  const handleSaveEdit = async (txnId) => {
    if (savingEdit) return;
    setSavingEdit(true);
    try {
      await api.put(`/api/tax-summary/${summaryId}/transactions/${txnId}`, editForm);
      setEditingTxn(null);
      loadDetail();
    } catch (err) { alert(err.message); } finally { setSavingEdit(false); }
  };

  const handleDelete = async (txnId) => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await api.del(`/api/tax-summary/${summaryId}/transactions/${txnId}`);
      loadDetail();
    } catch (err) { alert(err.message); }
  };

  const [adding, setAdding] = useState(false);
  const handleAdd = async (e) => {
    e.preventDefault();
    if (adding) return;
    if (!addForm.amount || !addForm.date) { alert('Amount and date are required'); return; }
    setAdding(true);
    try {
      await api.post(`/api/tax-summary/${summaryId}/transactions`, { ...addForm, amount: parseFloat(addForm.amount) });
      setShowAddForm(false);
      setAddForm({ transaction_type: 'expense', amount: '', date: '', description: '', category: '' });
      loadDetail();
    } catch (err) { alert(err.message); } finally { setAdding(false); }
  };

  const handleExport = () => {
    window.open(`${API}/api/tax-summary/${summaryId}/export`, '_blank');
  };

  if (loading) return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>Loading details...</div>;
  if (!summary) return <div style={{ color: 'var(--error)', padding: 40 }}>Summary not found.</div>;

  const net = (summary.total_income || 0) - (summary.total_expenses || 0);

  return (
    <div data-testid="tax-summary-detail">
      <button data-testid="back-to-summaries" onClick={onBack}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-body)', marginBottom: 20,
        }}>
        <ArrowLeft size={14} /> Back to Summaries
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>{summary.name}</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {summary.date_from} — {summary.date_to} | {summary.email_address}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button data-testid="add-txn-btn" onClick={() => setShowAddForm(!showAddForm)}
            style={cardBtnStyle('var(--brand-primary)', '#fff')}>
            <Plus size={14} /> Add Transaction
          </button>
          <button data-testid="export-detail-btn" data-guard onClick={handleExport}
            style={cardBtnStyle('var(--bg-primary)', 'var(--text-secondary)', true)}>
            <DownloadSimple size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        <StatBox label="Income" value={formatCurrency(summary.total_income)} color="var(--success)" icon={TrendUp} />
        <StatBox label="Expenses" value={formatCurrency(summary.total_expenses)} color="var(--error)" icon={TrendDown} />
        <StatBox label="Net" value={formatCurrency(net)} color={net >= 0 ? 'var(--success)' : 'var(--error)'} icon={Scales} />
        <StatBox label="Transactions" value={summary.transaction_count} color="var(--info)" icon={Lightning} />
      </div>

      <div style={{
        background: 'rgba(74,110,125,0.08)', borderRadius: 2, padding: '10px 16px', marginBottom: 20,
        fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
      }}>
        These transactions are for analysis only and do not affect your main ledger, account balances, or reports.
      </div>

      {/* Add Transaction Form */}
      {showAddForm && (
        <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 20, marginBottom: 16 }}>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={addForm.transaction_type} onChange={e => setAddForm({ ...addForm, transaction_type: e.target.value })} style={inputStyle}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Amount</label>
                <input type="number" step="0.01" placeholder="0.00" value={addForm.amount}
                  onChange={e => setAddForm({ ...addForm, amount: e.target.value })} style={{ ...inputStyle, width: 120 }} />
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={addForm.date}
                  onChange={e => setAddForm({ ...addForm, date: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Description</label>
                <input type="text" placeholder="Description" value={addForm.description}
                  onChange={e => setAddForm({ ...addForm, description: e.target.value })} style={inputStyle} />
              </div>
              <button type="submit" disabled={adding} style={cardBtnStyle('var(--success)', '#fff')}>{adding ? 'Adding...' : <><Check size={14} /> Add</>}</button>
              <button type="button" onClick={() => setShowAddForm(false)} style={cardBtnStyle('none', 'var(--text-muted)', true)}><X size={14} /></button>
            </div>
          </form>
        </div>
      )}

      {/* Transaction Table */}
      <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Type</th>
              <th style={{ ...thStyle, minWidth: 200 }}>Description</th>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
              <th style={thStyle}>Source</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found</td></tr>
            ) : transactions.map(txn => (
              editingTxn === txn.txn_id ? (
                <tr key={txn.txn_id} style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(194,109,92,0.04)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                      style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <select value={editForm.transaction_type} onChange={e => setEditForm({ ...editForm, transaction_type: e.target.value })}
                      style={{ ...inputStyle, padding: '6px 8px', fontSize: 12 }}>
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="text" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                      style={{ ...inputStyle, padding: '6px 8px', fontSize: 12, width: '100%' }} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="text" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                      style={{ ...inputStyle, padding: '6px 8px', fontSize: 12, width: 100 }} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                      style={{ ...inputStyle, padding: '6px 8px', fontSize: 12, width: 100, textAlign: 'right' }} />
                  </td>
                  <td />
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button onClick={() => handleSaveEdit(txn.txn_id)} disabled={savingEdit} style={smallBtnStyle('var(--success)', '#fff')}><Check size={12} /></button>
                      <button onClick={() => setEditingTxn(null)} style={smallBtnStyle('var(--bg-primary)', 'var(--text-muted)', true)}><X size={12} /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={txn.txn_id} data-testid={`ts-txn-${txn.txn_id}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="mono" style={{ padding: '10px 12px', fontSize: 12 }}>{txn.date}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      color: txn.transaction_type === 'income' ? 'var(--success)' : 'var(--error)',
                      background: txn.transaction_type === 'income' ? 'rgba(58,92,74,0.1)' : 'rgba(150,69,58,0.1)',
                    }}>{txn.transaction_type}</span>
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {txn.description || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{txn.category || '—'}</td>
                  <td className="mono" style={{
                    padding: '10px 12px', textAlign: 'right', fontWeight: 600,
                    color: txn.transaction_type === 'income' ? 'var(--success)' : 'var(--error)',
                  }}>{formatCurrency(txn.amount)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
                    {txn.source === 'manual' ? 'Manual' : txn.from_email?.split('<')[0]?.trim()?.substring(0, 20) || 'Email'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button data-testid={`edit-ts-txn-${txn.txn_id}`} onClick={() => handleEdit(txn)}
                        style={smallBtnStyle('var(--bg-primary)', 'var(--text-secondary)', true)}><PencilSimple size={12} /></button>
                      <button data-testid={`delete-ts-txn-${txn.txn_id}`} data-guard onClick={() => handleDelete(txn.txn_id)}
                        style={smallBtnStyle('none', 'var(--error)', true)}><Trash size={12} /></button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function StatBox({ label, value, color, icon: Icon }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border-subtle)',
      padding: '16px 20px', borderRadius: 2, textAlign: 'center',
    }}>
      <Icon size={18} weight="duotone" style={{ color, marginBottom: 6 }} />
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
    </div>
  );
}


const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 };
const inputStyle = { padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff', width: '100%' };
const thStyle = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' };

const cardBtnStyle = (bg, color, bordered) => ({
  background: bg, color, border: bordered ? '1px solid var(--border-strong)' : 'none',
  padding: '8px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-body)',
  display: 'flex', alignItems: 'center', gap: 4,
});

const smallBtnStyle = (bg, color, bordered) => ({
  background: bg, color, border: bordered ? '1px solid var(--border-strong)' : 'none',
  borderRadius: 2, padding: '5px 8px', cursor: 'pointer', fontSize: 11,
  display: 'flex', alignItems: 'center',
});
