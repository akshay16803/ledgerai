import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import { Funnel, PencilSimple } from '@phosphor-icons/react';
import { EditTransactionModal } from '../components/EditTransactionModal';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

export default function Ledger() {
  const cached = getCached('ledger');
  const [transactions, setTransactions] = useState(cached?.transactions || []);
  const [accounts, setAccounts] = useState(cached?.accounts || []);
  const [categories, setCategories] = useState(cached?.categories || []);
  const [loading, setLoading] = useState(!cached);
  const [editingTxn, setEditingTxn] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadRefData = useCallback(async () => {
    try {
      const [accs, cats] = await Promise.all([api.get('/api/accounts'), api.get('/api/categories')]);
      setAccounts(accs);
      setCategories(cats);
    } catch {
      // Reference data will show empty state on error
    }
  }, []);

  useEffect(() => {
    loadRefData();
  }, [loadRefData]);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('status', 'approved');
    params.set('limit', '500');
    if (selectedAccount) params.set('account_id', selectedAccount);
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);
    try {
      const res = await api.get(`/api/transactions?${params.toString()}`);
      setTransactions(res.transactions);
      if (!selectedAccount && !fromDate && !toDate) {
        setCache('ledger', { transactions: res.transactions, accounts, categories });
      }
    } catch {
      // Transactions will show empty state on error
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, fromDate, toDate, accounts, categories]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const getAccountName = (id) => accounts.find(a => a.account_id === id)?.name || '';
  const getCategoryName = (id) => categories.find(c => c.category_id === id)?.name || '';

  // Calculate running balance for selected account
  let runningBalance = 0;
  let balanceAsOfDate = null;
  if (selectedAccount) {
    const acc = accounts.find(a => a.account_id === selectedAccount);
    runningBalance = acc?.opening_balance || 0;
    balanceAsOfDate = acc?.balance_as_of_date || null;
  }

  const sortedTxns = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const inputStyle = { padding: '8px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff' };

  return (
    <div data-testid="ledger-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Ledger</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Double-entry ledger view</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <Funnel size={16} style={{ color: 'var(--text-muted)' }} />
        <select data-testid="ledger-account-filter" value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} style={inputStyle}>
          <option value="">All Accounts</option>
          {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.name}</option>)}
        </select>
        <input data-testid="ledger-from-date" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputStyle} />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
        <input data-testid="ledger-to-date" type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inputStyle} />
        {(selectedAccount || fromDate || toDate) && (
          <button data-testid="clear-ledger-filters" onClick={() => { setSelectedAccount(''); setFromDate(''); setToDate(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-1)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Ledger Table */}
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-muted)' }}>Loading ledger...</div>
      ) : sortedTxns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No approved transactions found</p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-strong)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Description</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Account</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--success)' }}>Debit</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--error)' }}>Credit</th>
                {selectedAccount && (
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Balance</th>
                )}
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', width: 60, position: 'sticky', right: 0, background: 'var(--bg-secondary)', zIndex: 2 }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {sortedTxns.map(txn => {
                let debit = 0, credit = 0;
                if (txn.transaction_type === 'income') {
                  debit = txn.amount; // Money comes IN (debit the asset account)
                } else if (txn.transaction_type === 'expense') {
                  credit = txn.amount; // Money goes OUT (credit the asset account)
                } else if (txn.transaction_type === 'transfer') {
                  if (selectedAccount === txn.account_id) {
                    credit = txn.amount; // Money goes OUT of this account
                  } else if (selectedAccount === txn.to_account_id) {
                    debit = txn.amount; // Money comes IN to this account
                  } else {
                    debit = txn.amount; // Show debit by default
                  }
                }
                // Only apply to running balance if transaction is after balance_as_of_date
                if (selectedAccount) {
                  const afterSnapshotDate = !balanceAsOfDate || txn.date > balanceAsOfDate;
                  if (afterSnapshotDate) {
                    runningBalance += debit - credit;
                  }
                }
                return (
                  <tr key={txn.transaction_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="mono" style={{ padding: '10px 16px', fontSize: 12, whiteSpace: 'nowrap' }}>{txn.date}</td>
                    <td style={{ padding: '10px 16px', maxWidth: 200 }}>
                      <div style={{ fontWeight: 500 }}>{txn.description || getCategoryName(txn.category_id) || txn.transaction_type}</div>
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
                    {selectedAccount && (
                      <td className="mono" style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: runningBalance >= 0 ? 'var(--success)' : 'var(--error)' }}>
                        {formatCurrency(runningBalance)}
                      </td>
                    )}
                    <td style={{ padding: '10px 16px', textAlign: 'center', position: 'sticky', right: 0, background: '#fff', zIndex: 1, boxShadow: '-4px 0 8px rgba(0,0,0,0.04)' }}>
                      <button data-testid={`ledger-edit-${txn.transaction_id}`} onClick={() => setEditingTxn(txn)} title="Edit"
                        style={{ background: 'rgba(74,110,125,0.1)', border: 'none', borderRadius: 2, padding: '4px 8px', cursor: 'pointer', color: 'var(--info)' }}>
                        <PencilSimple size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingTxn && (
        <EditTransactionModal
          transaction={editingTxn}
          accounts={accounts}
          categories={categories}
          onSave={() => { setEditingTxn(null); loadTransactions(); }}
          onClose={() => setEditingTxn(null)}
        />
      )}
    </div>
  );
}