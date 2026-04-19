import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  ArrowLeft, MagnifyingGlass, Funnel, X, TrendUp, TrendDown,
  ArrowsLeftRight, SpinnerGap, CaretDown
} from '@phosphor-icons/react';

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

  // Account info
  const [account, setAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

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
  useEffect(() => {
    setLoadingAccount(true);
    api.get(`/api/accounts/${accountId}`)
      .then(data => {
        // Backend may return { account: {...} } or bare object
        setAccount(data.account || data);
      })
      .catch(() => setAccount(null))
      .finally(() => setLoadingAccount(false));
  }, [accountId]);

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
    return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>Loading account...</div>;
  }

  if (!account) {
    return (
      <div style={{ padding: 40 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          <ArrowLeft size={14} /> Back
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
          <ArrowLeft size={14} weight="bold" /> Back
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
        {account.opening_balance !== undefined && account.opening_balance !== null && (
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
              Opening Balance
            </div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatCurrency(account.opening_balance)}
            </div>
          </div>
        )}
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
              placeholder="Search transactions..."
              style={{ ...inputStyle, width: '100%', paddingLeft: 30 }}
            />
          </div>

          {/* Transaction Type */}
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border-strong)', borderRadius: 2, overflow: 'hidden' }}>
            {[
              { value: '', label: 'All' },
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
              { value: 'transfer', label: 'Transfer' },
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
              <X size={12} weight="bold" /> Clear
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
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Start Date</label>
              <input
                data-testid="filter-start-date"
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); resetAndFilter(); }}
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>End Date</label>
              <input
                data-testid="filter-end-date"
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); resetAndFilter(); }}
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
              <select
                data-testid="filter-category"
                value={categoryId}
                onChange={e => { setCategoryId(e.target.value); resetAndFilter(); }}
                style={{ ...inputStyle, width: '100%' }}
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.category_id} value={cat.category_id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Min Amount</label>
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
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Max Amount</label>
              <input
                data-testid="filter-max-amount"
                type="number"
                step="0.01"
                value={maxAmount}
                onChange={e => { setMaxAmount(e.target.value); resetAndFilter(); }}
                placeholder="No limit"
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
            {hasActiveFilters ? 'No transactions match your filters.' : 'No transactions found for this account.'}
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
    </div>
  );
}
