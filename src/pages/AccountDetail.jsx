import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  ArrowLeft, MagnifyingGlass, Funnel, X, TrendUp, TrendDown,
  ArrowsLeftRight, SpinnerGap, CaretDown, Check, Warning,
  ChartLineUp, UploadSimple, PencilLine, CalendarBlank,
} from '@phosphor-icons/react';

const API = import.meta.env.REACT_APP_BACKEND_URL || '';

function formatCurrency(amount) {
  if (Math.abs(amount) >= 1_00_00_000) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(amount);
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const typeColors = {
  income: 'var(--success)',
  expense: 'var(--error)',
  transfer: 'var(--info)',
};

const typeIcons = {
  income: TrendUp,
  expense: TrendDown,
  transfer: ArrowsLeftRight,
};

export default function AccountDetail() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);

  // Account info
  const [account, setAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  // Opening balance edit state
  const [editingOB, setEditingOB] = useState(false);
  const [obAmount, setObAmount] = useState('');
  const [obDate, setObDate] = useState('');
  const [obSaving, setObSaving] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loadingTxns, setLoadingTxns] = useState(true);

  // Categories (for filter dropdown)
  const [categories, setCategories] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Load account info
  const loadAccount = useCallback(() => {
    setLoadingAccount(true);
    api.get(`/api/accounts/${accountId}`)
      .then(data => {
        const acc = data.account || data;
        setAccount(acc);
        setObAmount(acc.opening_balance != null ? String(acc.opening_balance) : '');
        setObDate(acc.balance_as_of_date || '');
      })
      .catch(() => setAccount(null))
      .finally(() => setLoadingAccount(false));
  }, [accountId]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleSaveOB = async () => {
    setObSaving(true);
    try {
      await api.put(`/api/accounts/${accountId}`, {
        opening_balance: parseFloat(obAmount) || 0,
        balance_as_of_date: obDate,
      });
      setEditingOB(false);
      loadAccount();
      loadTransactions();
    } catch (err) {
      alert(err.message || 'Failed to update opening balance');
    } finally {
      setObSaving(false);
    }
  };

  // ── Tab state ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('transactions');

  // ── Amortization tab ─────────────────────────────────────────────────
  const [amortData, setAmortData] = useState(null);
  const [amortLoading, setAmortLoading] = useState(false);
  const [amortError, setAmortError] = useState('');

  const loadAmortization = useCallback(() => {
    if (!accountId) return;
    setAmortLoading(true); setAmortError('');
    api.get(`/api/accounts/${accountId}/amortization`)
      .then(d => { setAmortData(d); setAmortLoading(false); })
      .catch(e => { setAmortError(e.message); setAmortLoading(false); });
  }, [accountId]);

  useEffect(() => {
    if (activeTab === 'amortization') loadAmortization();
  }, [activeTab, loadAmortization]);

  // ── OD Interest tab ──────────────────────────────────────────────────
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [odMonth, setOdMonth] = useState(defaultMonth);
  const [odData, setOdData] = useState(null);
  const [odLoading, setOdLoading] = useState(false);
  const [odSaving, setOdSaving] = useState(false);
  const [odEditAmount, setOdEditAmount] = useState('');
  const [odError, setOdError] = useState('');
  const [odSaved, setOdSaved] = useState(false);

  const calculateOD = async () => {
    setOdLoading(true); setOdError(''); setOdData(null); setOdSaved(false);
    try {
      const res = await api.get(`/api/accounts/${accountId}/od-interest?month=${odMonth}`);
      setOdData(res); setOdEditAmount(String(res.total_interest));
    } catch (err) { setOdError(err.message); } finally { setOdLoading(false); }
  };

  const saveODInterest = async () => {
    if (odSaving) return;
    const amt = parseFloat(odEditAmount);
    if (!amt || amt <= 0) { setOdError('Enter a valid amount'); return; }
    setOdSaving(true); setOdError('');
    try {
      const [y, m] = odMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const txnDate = `${odMonth}-${String(lastDay).padStart(2, '0')}`;
      await api.post(`/api/accounts/${accountId}/od-interest`, {
        amount: amt, date: txnDate, month: odMonth,
        description: `OD Interest — ${odMonth}`,
      });
      setOdSaved(true);
    } catch (err) { setOdError(err.message); } finally { setOdSaving(false); }
  };

  // ── Demat tab ────────────────────────────────────────────────────────
  const [dematFile, setDematFile] = useState(null);
  const [dematUploading, setDematUploading] = useState(false);
  const [dematUploadError, setDematUploadError] = useState('');
  const [dematUploadDone, setDematUploadDone] = useState(false);
  const [dematManual, setDematManual] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    transaction_type: 'income',
  });
  const [dematManualSaving, setDematManualSaving] = useState(false);
  const [dematManualError, setDematManualError] = useState('');
  const [dematManualDone, setDematManualDone] = useState(false);

  const handleDematUpload = async () => {
    if (!dematFile) return;
    setDematUploading(true); setDematUploadError(''); setDematUploadDone(false);
    try {
      const fd = new FormData();
      fd.append('file', dematFile);
      const res = await fetch(`${API}/api/accounts/${accountId}/demat-statement`, { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error('Upload failed');
      setDematUploadDone(true); setDematFile(null);
    } catch (err) { setDematUploadError(err.message || 'Upload failed'); }
    finally { setDematUploading(false); }
  };

  const handleDematManual = async () => {
    if (!dematManual.description.trim() || !dematManual.amount) { setDematManualError('Fill all fields'); return; }
    setDematManualSaving(true); setDematManualError(''); setDematManualDone(false);
    try {
      await api.post('/api/transactions', {
        account_id: accountId,
        date: dematManual.date,
        description: dematManual.description.trim(),
        amount: parseFloat(dematManual.amount),
        transaction_type: dematManual.transaction_type,
        status: 'approved',
      });
      setDematManualDone(true);
      setDematManual({ date: new Date().toISOString().split('T')[0], description: '', amount: '', transaction_type: 'income' });
      loadAccount();
    } catch (err) { setDematManualError(err.message); }
    finally { setDematManualSaving(false); }
  };

  // Load categories for filter
  useEffect(() => {
    api.get('/api/categories')
      .then(data => setCategories(Array.isArray(data) ? data : data.categories || []))
      .catch(() => {});
  }, []);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('skip', String(page * PAGE_SIZE));
    if (search.trim()) params.set('search', search.trim());
    if (transactionType) params.set('transaction_type', transactionType);
    if (categoryId) params.set('category_id', categoryId);
    if (startDate) params.set('from_date', startDate);
    if (endDate) params.set('to_date', endDate);
    if (minAmount) params.set('min_amount', minAmount);
    if (maxAmount) params.set('max_amount', maxAmount);
    return params.toString();
  }, [search, transactionType, categoryId, startDate, endDate, minAmount, maxAmount, page]);

  // Load transactions
  const loadTransactions = useCallback(() => {
    setLoadingTxns(true);
    api.get(`/api/accounts/${accountId}/transactions?${queryParams}`)
      .then(data => {
        setTransactions(data.transactions || []);
        setTotal(data.total || 0);
      })
      .catch(() => { setTransactions([]); setTotal(0); })
      .finally(() => setLoadingTxns(false));
  }, [accountId, queryParams]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Reset page when filters change
  const resetAndFilter = useCallback(() => {
    setPage(0);
  }, []);

  const hasActiveFilters = transactionType || categoryId || startDate || endDate || minAmount || maxAmount || search;

  const clearFilters = () => {
    setSearch('');
    setTransactionType('');
    setCategoryId('');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loadingAccount) {
    return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>{s('loading_account')}</div>;
  }

  if (!account) {
    return (
      <div style={{ padding: 40 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          <ArrowLeft size={14} /> {s('dashboard')}
        </button>
        <p style={{ color: 'var(--error)', fontSize: 14 }}>Account not found.</p>
      </div>
    );
  }

  const inputStyle = {
    padding: '8px 12px', border: '1px solid var(--border-strong)',
    borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none',
    background: 'var(--bg-primary)',
  };

  return (
    <div data-testid="account-detail-page">
      {/* Back button + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button data-testid="back-btn" onClick={() => navigate(-1)} style={{
          background: 'none', border: '1px solid var(--border-strong)', borderRadius: 2,
          padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-body)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        >
          <ArrowLeft size={14} weight="bold" /> {s('dashboard')}
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>{account.name}</h1>
          <p className="mono page-subtitle" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {(account.account_type || '').charAt(0).toUpperCase() + (account.account_type || '').slice(1)}
            {account.sub_type ? ` / ${account.sub_type}` : ''}
            {account.account_number ? ` · ${account.account_number}` : ''}
          </p>
        </div>
      </div>

      {/* Account Info Card */}
      <div data-testid="account-info-card" style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: '24px 28px', marginBottom: 24,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20,
      }}>
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
            Current Balance
          </div>
          <div className="mono" style={{
            fontSize: 'clamp(20px, 2.5vw, 32px)', fontWeight: 600, letterSpacing: '-0.02em',
            color: (account.balance || 0) >= 0 ? 'var(--success)' : 'var(--error)',
          }}>
            {formatCurrency(account.balance || 0)}
          </div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
            Opening Balance
          </div>
          {!editingOB ? (
            <div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                {account.opening_balance != null ? formatCurrency(account.opening_balance) : '--'}
              </div>
              {account.balance_as_of_date && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  as of {account.balance_as_of_date}
                </div>
              )}
              <button
                data-testid="set-opening-balance-btn"
                onClick={() => setEditingOB(true)}
                style={{
                  marginTop: 8, background: 'none', border: '1px solid var(--border-strong)',
                  borderRadius: 2, padding: '5px 12px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', color: 'var(--brand-primary)', fontFamily: 'var(--font-body)',
                }}
              >
                Set Opening Balance
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Amount</label>
                <input
                  data-testid="ob-amount-input"
                  type="number"
                  step="0.01"
                  value={obAmount}
                  onChange={e => setObAmount(e.target.value)}
                  style={{ ...inputStyle, width: 160 }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>As-of Date</label>
                <input
                  data-testid="ob-date-input"
                  type="date"
                  value={obDate}
                  onChange={e => setObDate(e.target.value)}
                  style={{ ...inputStyle, width: 160 }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 300 }}>
                Balance will be recalculated: opening balance + income - expenses +/- transfers from this date onward.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  data-testid="save-ob-btn"
                  onClick={handleSaveOB}
                  disabled={obSaving}
                  style={{
                    background: 'var(--brand-primary)', color: '#fff', border: 'none',
                    borderRadius: 2, padding: '6px 16px', fontSize: 12, fontWeight: 600,
                    cursor: obSaving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                    opacity: obSaving ? 0.6 : 1,
                  }}
                >
                  {obSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingOB(false)}
                  style={{
                    background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)',
                    borderRadius: 2, padding: '6px 14px', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {account.currency && (
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
              Currency
            </div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{account.currency}</div>
          </div>
        )}
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
            Total Transactions
          </div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{total}</div>
        </div>
      </div>

      {/* ── Tab Bar (only if account has special sub-type) ─────────────────── */}
      {(() => {
        const sub = account.sub_type || '';
        const isLoan = (sub === 'loan' || sub === 'mortgage') && account.loan_emi_amount;
        const isOD = sub === 'overdraft' && account.loan_interest_rate;
        const isDemat = sub === 'demat';
        if (!isLoan && !isOD && !isDemat) return null;
        const tabs = [
          { key: 'transactions', label: 'Transactions' },
          ...(isLoan ? [{ key: 'amortization', label: 'Loan Schedule' }] : []),
          ...(isOD ? [{ key: 'od_interest', label: 'OD Interest' }] : []),
          ...(isDemat ? [{ key: 'demat', label: 'Demat' }] : []),
        ];
        return (
          <div data-testid="account-tabs" style={{
            display: 'flex', borderBottom: '2px solid var(--border-subtle)',
            marginBottom: 20, gap: 0,
          }}>
            {tabs.map(tab => (
              <button key={tab.key} data-testid={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '10px 20px', fontSize: 13, fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  color: activeTab === tab.key ? 'var(--brand-primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === tab.key ? '2px solid var(--brand-primary)' : '2px solid transparent',
                  marginBottom: -2, transition: 'all 0.15s',
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        );
      })()}

      {/* ── Amortization Tab ─────────────────────────────────────────────── */}
      {activeTab === 'amortization' && (
        <div data-testid="amortization-tab" style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '24px 28px' }}>
          {amortLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <SpinnerGap size={24} className="spin" style={{ color: 'var(--text-muted)' }} />
              <style>{`.spin{animation:spin-anim 1s linear infinite}@keyframes spin-anim{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : amortError ? (
            <div style={{ color: 'var(--error)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Warning size={16} /> {amortError}
            </div>
          ) : amortData ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Outstanding', value: formatCurrency(amortData.outstanding_balance), color: 'var(--text-primary)' },
                  { label: 'Interest Rate', value: `${amortData.interest_rate}% p.a.`, color: 'var(--info)' },
                  { label: 'Monthly EMI', value: formatCurrency(amortData.emi_amount), color: 'var(--accent-1)' },
                  { label: 'Total Interest', value: formatCurrency(amortData.total_interest), color: 'var(--warning)' },
                  { label: 'EMIs Paid', value: `${amortData.payments_made} / ${amortData.tenure_months}`, color: 'var(--success)' },
                  { label: 'Remaining', value: `${amortData.months_remaining} months`, color: 'var(--text-secondary)' },
                ].map(c => (
                  <div key={c.label} style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 2 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ overflow: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-strong)' }}>
                      {['#', 'Due Date', 'EMI', 'Principal', 'Interest', 'Outstanding'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: h === '#' ? 'center' : 'right', fontWeight: 600, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {amortData.schedule.map((row, i) => {
                      const isPaid = i < amortData.payments_made;
                      return (
                        <tr key={row.month} data-testid={`amort-row-${row.month}`} style={{ borderBottom: '1px solid var(--border-subtle)', background: isPaid ? 'rgba(58,92,74,0.04)' : 'transparent', opacity: isPaid ? 0.7 : 1 }}>
                          <td className="mono" style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 500 }}>
                            {isPaid ? <Check size={12} weight="bold" style={{ color: 'var(--success)' }} /> : row.month}
                          </td>
                          <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{row.due_date}</td>
                          <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(row.emi)}</td>
                          <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(row.principal)}</td>
                          <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--warning)' }}>{formatCurrency(row.interest)}</td>
                          <td className="mono" style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(row.outstanding)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── OD Interest Tab ──────────────────────────────────────────────── */}
      {activeTab === 'od_interest' && (
        <div data-testid="od-interest-tab" style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '24px 28px', maxWidth: 640 }}>
          <div style={{ padding: '12px 16px', background: 'rgba(74,110,125,0.06)', borderRadius: 2, marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Interest is calculated daily on your outstanding balance. Select a month, calculate, then save to record the expense.
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Month</label>
              <input data-testid="od-month-input" type="month" value={odMonth}
                onChange={e => { setOdMonth(e.target.value); setOdData(null); setOdSaved(false); }}
                style={{ padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)' }} />
            </div>
            <button data-testid="od-calc-btn" onClick={calculateOD} disabled={odLoading}
              style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: odLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: odLoading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {odLoading ? <><SpinnerGap size={14} className="spin" /> Calculating...</> : 'Calculate'}
            </button>
          </div>
          {odError && <div style={{ background: 'rgba(150,69,58,0.1)', border: '1px solid var(--error)', borderRadius: 2, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: 'var(--error)' }}>{odError}</div>}
          {odData && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 2, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Opening Outstanding</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(odData.daily_breakdown?.[0]?.outstanding || 0)}</div>
                </div>
                <div style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 2, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Closing Outstanding</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(odData.closing_outstanding)}</div>
                </div>
                <div style={{ padding: '14px 16px', background: 'rgba(150,69,58,0.06)', borderRadius: 2, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Total Interest</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--error)' }}>{formatCurrency(odData.total_interest)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Adjust Amount (if needed)</label>
                  <input data-testid="od-amount-input" type="number" step="0.01" value={odEditAmount} onChange={e => setOdEditAmount(e.target.value)}
                    style={{ padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-mono)', width: 160 }} />
                </div>
                {odSaved ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>
                    <Check size={16} weight="bold" /> Recorded!
                  </div>
                ) : (
                  <button data-testid="od-save-btn" onClick={saveODInterest} disabled={odSaving}
                    style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: odSaving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: odSaving ? 0.6 : 1 }}>
                    {odSaving ? 'Saving...' : 'Record as Expense'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Demat Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'demat' && (
        <div data-testid="demat-tab" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* Upload Statement */}
          <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <UploadSimple size={18} weight="duotone" style={{ color: 'var(--brand-primary)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Upload Statement</h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Upload your broker's statement (PDF or CSV) to automatically import trades and P&L entries.
            </p>
            <input data-testid="demat-file-input" type="file" accept=".pdf,.csv,.xlsx,.xls"
              onChange={e => { setDematFile(e.target.files[0] || null); setDematUploadDone(false); setDematUploadError(''); }}
              style={{ fontSize: 12, marginBottom: 16 }} />
            {dematUploadError && <div style={{ color: 'var(--error)', fontSize: 12, marginBottom: 12 }}>{dematUploadError}</div>}
            {dematUploadDone && <div style={{ color: 'var(--success)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}><Check size={14} weight="bold" /> Uploaded successfully</div>}
            <button data-testid="demat-upload-btn" onClick={handleDematUpload}
              disabled={!dematFile || dematUploading}
              style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: (!dematFile || dematUploading) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: (!dematFile || dematUploading) ? 0.6 : 1 }}>
              {dematUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
          {/* Manual Entry */}
          <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <PencilLine size={18} weight="duotone" style={{ color: 'var(--accent-1)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Manual P&L Entry</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Date</label>
                <input type="date" value={dematManual.date} onChange={e => setDematManual(p => ({ ...p, date: e.target.value }))}
                  style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Description</label>
                <input type="text" value={dematManual.description} onChange={e => setDematManual(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. NIFTY50 options profit"
                  style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Amount (₹)</label>
                  <input type="number" step="0.01" value={dematManual.amount} onChange={e => setDematManual(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-mono)', width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Type</label>
                  <select value={dematManual.transaction_type} onChange={e => setDematManual(p => ({ ...p, transaction_type: e.target.value }))}
                    style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)' }}>
                    <option value="income">Profit / Gain</option>
                    <option value="expense">Loss</option>
                  </select>
                </div>
              </div>
              {dematManualError && <div style={{ color: 'var(--error)', fontSize: 12 }}>{dematManualError}</div>}
              {dematManualDone && <div style={{ color: 'var(--success)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} weight="bold" /> Entry recorded</div>}
              <button data-testid="demat-manual-save-btn" onClick={handleDematManual} disabled={dematManualSaving}
                style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: dematManualSaving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: dematManualSaving ? 0.6 : 1, alignSelf: 'flex-start' }}>
                {dematManualSaving ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transactions Tab (default) ───────────────────────────────────── */}
      {activeTab === 'transactions' && <>

      {/* Filter Bar */}
      <div data-testid="filter-bar" style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: '16px 20px', marginBottom: 20,
      }}>
        {/* Top row: search + type + toggle */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <MagnifyingGlass size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              data-testid="filter-search"
              value={search}
              onChange={e => { setSearch(e.target.value); resetAndFilter(); }}
              placeholder={s('search_transactions')}
              style={{ ...inputStyle, width: '100%', paddingLeft: 30 }}
            />
          </div>

          {/* Transaction Type */}
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border-strong)', borderRadius: 2, overflow: 'hidden' }}>
            {[
              { value: '', label: s('all') },
              { value: 'income', label: s('income') },
              { value: 'expense', label: s('expense') },
              { value: 'transfer', label: s('transfer') },
            ].map(opt => (
              <button
                key={opt.value}
                data-testid={`filter-type-${opt.value || 'all'}`}
                onClick={() => { setTransactionType(opt.value); resetAndFilter(); }}
                style={{
                  background: transactionType === opt.value ? 'var(--brand-primary)' : '#fff',
                  color: transactionType === opt.value ? '#fff' : 'var(--text-secondary)',
                  border: 'none', borderRight: '1px solid var(--border-strong)',
                  padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Advanced toggle */}
          <button
            data-testid="toggle-advanced-filters"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: 'none', border: '1px solid var(--border-strong)', borderRadius: 2,
              padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 500, color: showAdvanced ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <Funnel size={13} weight={showAdvanced ? 'fill' : 'regular'} />
            Filters
            <CaretDown size={10} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              data-testid="clear-filters"
              onClick={clearFilters}
              style={{
                background: 'rgba(150,69,58,0.08)', border: '1px solid rgba(150,69,58,0.2)',
                borderRadius: 2, padding: '8px 12px', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, color: 'var(--error)', fontFamily: 'var(--font-body)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <X size={12} weight="bold" /> {s('clear_filters')}
            </button>
          )}
        </div>

        {/* Advanced filters row */}
        {showAdvanced && (
          <div data-testid="advanced-filters" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12,
            marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)',
          }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{s('from_date')}</label>
              <input
                data-testid="filter-start-date"
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); resetAndFilter(); }}
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{s('to_date')}</label>
              <input
                data-testid="filter-end-date"
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); resetAndFilter(); }}
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{s('category')}</label>
              <select
                data-testid="filter-category"
                value={categoryId}
                onChange={e => { setCategoryId(e.target.value); resetAndFilter(); }}
                style={{ ...inputStyle, width: '100%' }}
              >
                <option value="">{s('all_categories')}</option>
                {categories.map(cat => (
                  <option key={cat.category_id} value={cat.category_id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{s('min_amount')}</label>
              <input
                data-testid="filter-min-amount"
                type="number"
                step="0.01"
                value={minAmount}
                onChange={e => { setMinAmount(e.target.value); resetAndFilter(); }}
                placeholder="0"
                style={{ ...inputStyle, width: '100%', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{s('max_amount')}</label>
              <input
                data-testid="filter-max-amount"
                type="number"
                step="0.01"
                value={maxAmount}
                onChange={e => { setMaxAmount(e.target.value); resetAndFilter(); }}
                placeholder={s('no_limit')}
                style={{ ...inputStyle, width: '100%', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Transaction List */}
      <div data-testid="transaction-list" style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>
            Transactions
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
              {total} result{total !== 1 ? 's' : ''}
            </span>
          </h3>
        </div>

        {loadingTxns ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <SpinnerGap size={24} className="spin" style={{ color: 'var(--text-muted)' }} />
            <style>{`.spin { animation: spin-anim 1s linear infinite; } @keyframes spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {hasActiveFilters ? s('no_transactions_match_filters') : s('no_transactions_found')}
          </div>
        ) : (
          <>
            {transactions.map((txn, i) => {
              const type = txn.transaction_type || 'expense';
              const Icon = typeIcons[type] || TrendDown;
              const color = typeColors[type] || 'var(--text-secondary)';

              return (
                <div
                  key={txn.transaction_id || i}
                  data-testid={`txn-row-${txn.transaction_id}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: i < transactions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={14} weight="bold" style={{ color }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {txn.description || type.charAt(0).toUpperCase() + type.slice(1)}
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{txn.date}</span>
                        {txn.category_name && <span>{txn.category_name}</span>}
                        {txn.status === 'pending' && (
                          <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Pending</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="mono" style={{
                    fontSize: 'clamp(12px, 1.5vw, 14px)', fontWeight: 600, color,
                    whiteSpace: 'nowrap', marginLeft: 12,
                  }}>
                    {type === 'income' ? '+' : type === 'expense' ? '-' : ''}
                    {formatCurrency(txn.amount)}
                  </span>
                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
                padding: '16px 20px', borderTop: '1px solid var(--border-subtle)',
              }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{
                    background: 'none', border: '1px solid var(--border-strong)', borderRadius: 2,
                    padding: '6px 14px', fontSize: 12, cursor: page === 0 ? 'not-allowed' : 'pointer',
                    opacity: page === 0 ? 0.4 : 1, fontFamily: 'var(--font-body)',
                  }}
                >
                  Previous
                </button>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={{
                    background: 'none', border: '1px solid var(--border-strong)', borderRadius: 2,
                    padding: '6px 14px', fontSize: 12, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                    opacity: page >= totalPages - 1 ? 0.4 : 1, fontFamily: 'var(--font-body)',
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
      </>}
    </div>
  );
}
