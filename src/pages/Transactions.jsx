import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import { Plus, X, Funnel, PencilSimple, Robot, Receipt, BookOpen, ListBullets, MagnifyingGlass, Trash, CheckSquare, Square, Check, Clock } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { EditTransactionModal } from '../components/EditTransactionModal';
import { SalesInvoiceModal } from '../components/SalesInvoiceModal';
import { PurchaseBillModal } from '../components/PurchaseBillModal';
import { InternationalInvoiceModal } from '../components/InternationalInvoiceModal';
import { usesExistingForms } from '../lib/countryConfig';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

const API = import.meta.env.REACT_APP_BACKEND_URL || '';

export default function Transactions() {
  const cachedTxn = getCached('transactions');
  const [transactions, setTransactions] = useState(cachedTxn?.transactions || []);
  const [accounts, setAccounts] = useState(cachedTxn?.accounts || []);
  const [categories, setCategories] = useState(cachedTxn?.categories || []);
  const [total, setTotal] = useState(cachedTxn?.total || 0);
  const [loading, setLoading] = useState(!cachedTxn);
  const [showNewTxn, setShowNewTxn] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'ledger'
  const [filterAccount, setFilterAccount] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [editingTxn, setEditingTxn] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showSalesInvoice, setShowSalesInvoice] = useState(false);
  const [showPurchaseInvoice, setShowPurchaseInvoice] = useState(false);
  const [businessCountry, setBusinessCountry] = useState('IN');
  const [pendingCount, setPendingCount] = useState(0);
  const [viewTab, setViewTab] = useState('approved'); // 'approved' | 'pending'
  const [pendingTxns, setPendingTxns] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingTotal, setPendingTotal] = useState(0);
  const navigate = useNavigate();
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);

  // Handle switch from transaction modal to invoice modals
  const handleSwitchToInvoice = async (type) => {
    setShowNewTxn(false);
    try {
      const settings = await api.get('/api/settings');
      setBusinessCountry(settings.business_country || 'IN');
      if (!settings.firm_name?.trim()) {
        navigate(type === 'sales_invoice' ? '/settings?setup=invoice' : '/settings?setup=bill');
        return;
      }
    } catch { /* proceed anyway */ }
    if (type === 'sales_invoice') setShowSalesInvoice(true);
    else setShowPurchaseInvoice(true);
  };

  const loadData = useCallback(async () => {
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('transaction_type', filterType);
      if (filterAccount) params.set('account_id', filterAccount);
      if (filterDateFrom) params.set('from_date', filterDateFrom);
      if (filterDateTo) params.set('to_date', filterDateTo);
      if (filterSearch.trim()) params.set('search', filterSearch.trim());
      params.set('status', 'approved');
      params.set('limit', viewMode === 'ledger' ? '500' : '100');
      const [txnRes, accs, cats] = await Promise.all([
        api.get(`/api/transactions?${params.toString()}`),
        api.get('/api/accounts'),
        api.get('/api/categories'),
      ]);
      setTransactions(txnRes.transactions);
      setTotal(txnRes.total);
      setAccounts(accs);
      setCategories(cats);
      if (!filterType && !filterAccount && !filterDateFrom && !filterDateTo) {
        setCache('transactions', { transactions: txnRes.transactions, total: txnRes.total, accounts: accs, categories: cats });
      }
    } catch (err) { /* Error handled silently - data will show empty state */ }
    setLoading(false);
  }, [filterType, filterAccount, filterDateFrom, filterDateTo, filterSearch, viewMode]);

  useEffect(() => { loadData(); }, [loadData]); // eslint-disable-line react-hooks/set-state-in-effect

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { loadData(); }, 400);
    return () => clearTimeout(t);
  }, [filterSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch pending count for empty state messaging
  useEffect(() => {
    api.get('/api/transactions?status=pending_review&limit=1').then(res => {
      setPendingCount(res.total || 0);
    }).catch(() => {});
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    try { await api.del(`/api/transactions/${id}`); loadData(); }
    catch (err) { alert(err.message); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected transaction${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    try {
      await Promise.all([...selectedIds].map(id => api.del(`/api/transactions/${id}`)));
      setSelectedIds(new Set());
      loadData();
    } catch (err) { alert(err.message); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.transaction_id)));
    }
  };

  const getAccountName = (id) => accounts.find(a => a.account_id === id)?.name || 'Unidentified Account';
  const getCategoryName = (id) => categories.find(c => c.category_id === id)?.name || '';

  // ── Pending tab ──────────────────────────────────────────────────────
  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await api.get('/api/transactions?status=pending_review&limit=100');
      setPendingTxns(res.transactions || []);
      setPendingTotal(res.total || 0);
      setPendingCount(res.total || 0);
    } catch { setPendingTxns([]); setPendingTotal(0); }
    finally { setPendingLoading(false); }
  }, []);

  useEffect(() => {
    if (viewTab === 'pending') loadPending();
  }, [viewTab, loadPending]);

  const handleApproveTxn = async (txnId) => {
    try {
      await api.post(`/api/transactions/${txnId}/approve`);
      loadPending();
    } catch (err) { alert(err.message); }
  };

  const handleRejectTxn = async (txnId) => {
    if (!confirm('Reject this transaction? It will be removed from pending.')) return;
    try {
      await api.post(`/api/transactions/${txnId}/reject`);
      loadPending();
    } catch (err) { alert(err.message); }
  };

  return (
    <div data-testid="transactions-page">
      <div className="action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>{s('transactions')}</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {total} total transactions
          </p>
        </div>
        <button data-testid="new-transaction-btn" onClick={() => setShowNewTxn(true)} style={{
          background: 'var(--brand-primary)', color: '#fff', border: 'none',
          padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Plus size={14} weight="bold" /> {s('new_transaction')}
        </button>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-subtle)', marginBottom: 20 }}>
        <button data-testid="tab-approved" onClick={() => setViewTab('approved')}
          style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', color: viewTab === 'approved' ? 'var(--brand-primary)' : 'var(--text-muted)', borderBottom: viewTab === 'approved' ? '2px solid var(--brand-primary)' : '2px solid transparent', marginBottom: -2, transition: 'all 0.15s' }}>
          {s('transactions') || 'Transactions'}
        </button>
        <button data-testid="tab-pending" onClick={() => setViewTab('pending')}
          style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', color: viewTab === 'pending' ? 'var(--warning)' : 'var(--text-muted)', borderBottom: viewTab === 'pending' ? '2px solid var(--warning)' : '2px solid transparent', marginBottom: -2, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={13} weight="duotone" />
          Pending Review
          {pendingCount > 0 && (
            <span className="mono" style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(194,140,60,0.15)', color: 'var(--warning)', borderRadius: 10, fontWeight: 700 }}>{pendingCount}</span>
          )}
        </button>
      </div>

      {/* Pending Tab Content */}
      {viewTab === 'pending' && (
        <div data-testid="pending-transactions-section">
          {pendingLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading pending transactions...</div>
          ) : pendingTxns.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
              <Check size={32} weight="duotone" style={{ color: 'var(--success)', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              No pending transactions — you're all caught up!
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Date</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Description</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Type</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Account</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Amount</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTxns.map(txn => (
                    <tr key={txn.transaction_id} data-testid={`pending-txn-${txn.transaction_id}`}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="mono" style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{txn.date}</td>
                      <td style={{ padding: '10px 16px', maxWidth: 280 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.description || '—'}</div>
                        {txn.category_name && <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{txn.category_name}</div>}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: txn.transaction_type === 'income' ? 'rgba(58,92,74,0.1)' : 'rgba(150,69,58,0.1)', color: txn.transaction_type === 'income' ? 'var(--success)' : txn.transaction_type === 'expense' ? 'var(--error)' : 'var(--info)' }}>
                          {txn.transaction_type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{getAccountName(txn.account_id)}</td>
                      <td className="mono" style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: txn.transaction_type === 'income' ? 'var(--success)' : 'var(--error)' }}>
                        {txn.transaction_type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button data-testid={`approve-txn-${txn.transaction_id}`}
                            onClick={() => handleApproveTxn(txn.transaction_id)}
                            style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 2, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={11} weight="bold" /> Approve
                          </button>
                          <button data-testid={`reject-txn-${txn.transaction_id}`}
                            onClick={() => handleRejectTxn(txn.transaction_id)}
                            style={{ background: 'none', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 2, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <X size={11} weight="bold" /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewTab === 'approved' && <>

      {/* Bulk Delete Bar */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
          padding: '10px 16px', background: 'rgba(194,109,92,0.08)', border: '1px solid rgba(194,109,92,0.3)',
          borderRadius: 2,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)' }}>
            {selectedIds.size} selected
          </span>
          <button
            data-testid="bulk-delete-btn"
            onClick={handleBulkDelete}
            style={{
              background: '#dc3545', color: '#fff', border: 'none', borderRadius: 2,
              padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Trash size={13} weight="bold" /> Delete selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center',
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '12px 16px',
      }}>
        <Funnel size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <MagnifyingGlass size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            data-testid="txn-search"
            type="text"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder={s('search') || 'Search transactions...'}
            style={{
              padding: '8px 12px 8px 32px',
              border: '1px solid var(--border-strong)',
              borderRadius: 2, fontSize: 13,
              fontFamily: 'var(--font-body)',
              background: 'var(--bg-primary)',
              width: 220,
              outline: 'none',
            }}
          />
        </div>
        <select data-testid="filter-type" value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff' }}>
          <option value="">{s('all')}</option>
          <option value="income">{s('income')}</option>
          <option value="expense">{s('expense')}</option>
          <option value="transfer">{s('transfer')}</option>
        </select>
        <select data-testid="filter-account" value={filterAccount} onChange={e => setFilterAccount(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff' }}>
          <option value="">{s('all_accounts')}</option>
          {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.name}</option>)}
        </select>
        <input data-testid="filter-date-from" type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff' }}
          title={s('from_date')} />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s('to')}</span>
        <input data-testid="filter-date-to" type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff' }}
          title={s('to_date')} />
        {(filterType || filterAccount || filterDateFrom || filterDateTo || filterSearch) && (
          <button onClick={() => { setFilterType(''); setFilterAccount(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterSearch(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-1)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            Clear filters
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 0, border: '1px solid var(--border-strong)', borderRadius: 2, overflow: 'hidden' }}>
          <button data-testid="view-list" onClick={() => setViewMode('list')}
            style={{
              padding: '7px 14px', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5,
              background: viewMode === 'list' ? 'var(--brand-primary)' : '#fff',
              color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
            }}>
            <ListBullets size={14} /> {s('list')}
          </button>
          <button data-testid="view-ledger" onClick={() => setViewMode('ledger')}
            style={{
              padding: '7px 14px', border: 'none', borderLeft: '1px solid var(--border-strong)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5,
              background: viewMode === 'ledger' ? 'var(--brand-primary)' : '#fff',
              color: viewMode === 'ledger' ? '#fff' : 'var(--text-secondary)',
            }}>
            <BookOpen size={14} /> {s('ledger')}
          </button>
        </div>
      </div>

      {/* Transactions Content */}
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-muted)' }}>{s('syncing')}</div>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
          {pendingCount > 0 ? (
            <>
              <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{s('no_approved_transactions')}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
                You have {pendingCount} pending for review.
              </p>
              <button onClick={() => navigate('/dashboard')} style={{
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)'
              }}>{s('pending_review')}</button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>{s('no_transactions_yet')}</p>
              <button onClick={() => setShowNewTxn(true)} style={{
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)'
              }}>{s('add_transaction')}</button>
            </>
          )}
        </div>
      ) : viewMode === 'ledger' ? (
        /* ── Ledger View ── */
        (() => {
          let runningBalance = 0;
          let balanceAsOfDate = null;
          if (filterAccount) {
            const acc = accounts.find(a => a.account_id === filterAccount);
            runningBalance = acc?.opening_balance || 0;
            balanceAsOfDate = acc?.balance_as_of_date || null;
          }
          const sortedTxns = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
          return (
            <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'auto' }}>
              {!filterAccount && (
                <div style={{ padding: '10px 16px', background: 'rgba(74,110,125,0.06)', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--info)', fontWeight: 500 }}>
                  Select an account above to see running balance
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-strong)', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('date')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('description')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('account_label')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--success)' }}>{s('debit')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--error)' }}>{s('credit')}</th>
                    {filterAccount && (
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('balance')}</th>
                    )}
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', width: 80, position: 'sticky', right: 0, background: 'var(--bg-secondary)', zIndex: 2 }}>{s('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTxns.map(txn => {
                    let debit = 0, credit = 0;
                    if (txn.transaction_type === 'income') {
                      debit = txn.amount;
                    } else if (txn.transaction_type === 'expense') {
                      credit = txn.amount;
                    } else if (txn.transaction_type === 'transfer') {
                      if (filterAccount === txn.account_id) {
                        credit = txn.amount;
                      } else if (filterAccount === txn.to_account_id) {
                        debit = txn.amount;
                      } else {
                        debit = txn.amount;
                      }
                    }
                    if (filterAccount) {
                      const afterSnapshotDate = !balanceAsOfDate || txn.date >= balanceAsOfDate;
                      if (afterSnapshotDate) {
                        runningBalance += debit - credit;
                      }
                    }
                    return (
                      <tr key={txn.transaction_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="mono" style={{ padding: '10px 16px', fontSize: 12, whiteSpace: 'nowrap' }}>{txn.date}</td>
                        <td style={{ padding: '10px 16px', maxWidth: 200 }}>
                          <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {txn.description || getCategoryName(txn.category_id) || txn.transaction_type}
                            {txn.source === 'ai_chat' && (
                              <span title="Posted by AI Assistant" style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                padding: '1px 7px', borderRadius: 10, fontSize: 9.5, fontWeight: 600,
                                background: 'rgba(26,54,45,0.08)', color: 'var(--brand-primary)',
                                whiteSpace: 'nowrap', letterSpacing: '0.03em',
                              }}>
                                <Robot size={10} weight="fill" /> AI
                              </span>
                            )}
                          </div>
                          {txn.category_id && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{getCategoryName(txn.category_id)}</span>}
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 12 }}>
                          {getAccountName(txn.account_id)}
                          {txn.to_account_id && <span style={{ color: 'var(--text-muted)' }}> → {getAccountName(txn.to_account_id)}</span>}
                        </td>
                        <td className="mono" style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500, color: debit > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                          {debit > 0 ? formatCurrency(debit) : '—'}
                        </td>
                        <td className="mono" style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500, color: credit > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                          {credit > 0 ? formatCurrency(credit) : '—'}
                        </td>
                        {filterAccount && (
                          <td className="mono" style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: runningBalance >= 0 ? 'var(--success)' : 'var(--error)' }}>
                            {formatCurrency(runningBalance)}
                          </td>
                        )}
                        <td style={{ padding: '10px 16px', textAlign: 'center', position: 'sticky', right: 0, background: '#fff', zIndex: 1, boxShadow: '-4px 0 8px rgba(0,0,0,0.04)' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button onClick={() => setEditingTxn(txn)} title="Edit"
                              style={{ background: 'rgba(74,110,125,0.1)', border: 'none', borderRadius: 2, padding: '4px 8px', cursor: 'pointer', color: 'var(--info)' }}>
                              <PencilSimple size={14} />
                            </button>
                            {txn.receipt_id && (
                              <button onClick={() => window.open(`${API}/api/receipts/${txn.receipt_id}/download`, '_blank')} title="View Receipt"
                                style={{ background: 'rgba(194,109,92,0.1)', border: 'none', borderRadius: 2, padding: '4px 8px', cursor: 'pointer', color: 'var(--brand-primary)' }}>
                                <Receipt size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()
      ) : (
        /* ── List View ── */
        <div className="table-responsive" style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', width: 36 }}>
                  <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                    {selectedIds.size === transactions.length && transactions.length > 0
                      ? <CheckSquare size={16} weight="fill" style={{ color: 'var(--brand-primary)' }} />
                      : <Square size={16} />}
                  </button>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('date')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('type')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('description')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('account_label')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('category')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s('amount')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', position: 'sticky', right: 0, background: 'var(--bg-secondary)', zIndex: 2 }}>{s('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => (
                <tr key={txn.transaction_id} data-testid={`txn-row-${txn.transaction_id}`} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s', background: selectedIds.has(txn.transaction_id) ? 'rgba(194,109,92,0.05)' : 'transparent' }}
                  onMouseEnter={e => { if (!selectedIds.has(txn.transaction_id)) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={e => { if (!selectedIds.has(txn.transaction_id)) e.currentTarget.style.background = 'transparent'; }}>
                  <td style={{ padding: '12px 16px', width: 36 }}>
                    <button onClick={() => toggleSelect(txn.transaction_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                      {selectedIds.has(txn.transaction_id)
                        ? <CheckSquare size={16} weight="fill" style={{ color: 'var(--brand-primary)' }} />
                        : <Square size={16} />}
                    </button>
                  </td>
                  <td className="mono" style={{ padding: '12px 16px', fontSize: 12 }}>{txn.date}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      color: txn.transaction_type === 'income' ? 'var(--success)' : txn.transaction_type === 'expense' ? 'var(--error)' : 'var(--info)',
                      background: txn.transaction_type === 'income' ? 'rgba(58,92,74,0.1)' : txn.transaction_type === 'expense' ? 'rgba(150,69,58,0.1)' : 'rgba(74,110,125,0.1)'
                    }}>
                      {txn.transaction_type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.description || '-'}</span>
                      {txn.source === 'ai_chat' && (
                        <span title="Posted by AI Assistant" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '1px 7px', borderRadius: 10, fontSize: 9.5, fontWeight: 600,
                          background: 'rgba(26,54,45,0.08)', color: 'var(--brand-primary)',
                          whiteSpace: 'nowrap', letterSpacing: '0.03em', flexShrink: 0,
                        }}>
                          <Robot size={10} weight="fill" /> AI
                        </span>
                      )}
                    </div>
                    {txn.payment_method && (
                      <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {txn.payment_method.replace(/_/g, ' ')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12 }}>
                    {getAccountName(txn.account_id)}
                    {txn.to_account_id && <span style={{ color: 'var(--text-muted)' }}> → {getAccountName(txn.to_account_id)}</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12 }}>
                    <div>{getCategoryName(txn.category_id)}</div>
                    {txn.subcategory_name && (
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                        ↳ {txn.subcategory_name}
                      </div>
                    )}
                    {txn.status === 'pending_review' && (
                      <span style={{
                        display: 'inline-block', marginTop: 3,
                        padding: '1px 6px', borderRadius: 2, fontSize: 10, fontWeight: 600,
                        background: 'rgba(234,179,8,0.12)', color: 'var(--warning)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>pending</span>
                    )}
                  </td>
                  <td className="mono" style={{
                    padding: '12px 16px', textAlign: 'right', fontWeight: 600,
                    color: txn.transaction_type === 'income' ? 'var(--success)' : txn.transaction_type === 'expense' ? 'var(--error)' : 'var(--text-primary)'
                  }}>
                    <div>
                      {txn.transaction_type === 'income' ? '+' : txn.transaction_type === 'expense' ? '-' : ''}
                      {formatCurrency(txn.amount)}
                    </div>
                    {txn.original_currency && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }} title={`Original: ${txn.original_currency} ${txn.original_amount} @ ${txn.exchange_rate}`}>
                        {txn.original_currency} {txn.original_amount?.toLocaleString()}
                        {txn.is_estimated_rate && <span style={{ color: 'var(--warning)', marginLeft: 4 }}>est.</span>}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', position: 'sticky', right: 0, background: '#fff', zIndex: 1, boxShadow: '-4px 0 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button data-testid={`edit-txn-${txn.transaction_id}`} onClick={() => setEditingTxn(txn)} title="Edit"
                        style={{ background: 'rgba(74,110,125,0.1)', border: 'none', borderRadius: 2, padding: '4px 8px', cursor: 'pointer', color: 'var(--info)' }}>
                        <PencilSimple size={14} weight="bold" />
                      </button>
                      {txn.receipt_id && (
                        <button data-testid={`receipt-txn-${txn.transaction_id}`} onClick={() => window.open(`${API}/api/receipts/${txn.receipt_id}/download`, '_blank')} title="View Receipt"
                          style={{ background: 'rgba(194,109,92,0.1)', border: 'none', borderRadius: 2, padding: '4px 8px', cursor: 'pointer', color: 'var(--brand-primary)' }}>
                          <Receipt size={14} />
                        </button>
                      )}
                      <button data-testid={`delete-txn-${txn.transaction_id}`} data-guard onClick={() => handleDelete(txn.transaction_id)} title="Delete"
                        style={{ background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>}

      {/* New Transaction Modal */}
      {showNewTxn && (
        <EditTransactionModal
          transaction={null}
          accounts={accounts}
          categories={categories}
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
            accounts={accounts}
            onSave={() => { setShowSalesInvoice(false); loadData(); }}
            onClose={() => setShowSalesInvoice(false)}
          />
        ) : (
          <InternationalInvoiceModal
            mode="sales"
            invoice={null}
            accounts={accounts}
            countryCode={businessCountry}
            onSave={() => { setShowSalesInvoice(false); loadData(); }}
            onClose={() => setShowSalesInvoice(false)}
          />
        )
      )}

      {/* Purchase Invoice Modal */}
      {showPurchaseInvoice && (
        usesExistingForms(businessCountry) ? (
          <PurchaseBillModal
            bill={null}
            accounts={accounts}
            onSave={() => { setShowPurchaseInvoice(false); loadData(); }}
            onClose={() => setShowPurchaseInvoice(false)}
          />
        ) : (
          <InternationalInvoiceModal
            mode="purchase"
            bill={null}
            accounts={accounts}
            countryCode={businessCountry}
            onSave={() => { setShowPurchaseInvoice(false); loadData(); }}
            onClose={() => setShowPurchaseInvoice(false)}
          />
        )
      )}

      {/* Edit Transaction Modal */}
      {editingTxn && (
        <EditTransactionModal
          transaction={editingTxn}
          accounts={accounts}
          categories={categories}
          onSave={() => { setEditingTxn(null); loadData(); }}
          onClose={() => setEditingTxn(null)}
        />
      )}
    </div>
  );
}
