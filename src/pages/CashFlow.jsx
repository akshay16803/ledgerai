import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import {
  TrendUp, TrendDown, Repeat, ArrowRight,
  CurrencyInr, CalendarBlank, Check, X, CaretDown, Receipt, Pause, Play, Trash,
  CaretUp, Eye
} from '@phosphor-icons/react';
import { EditTransactionModal } from '../components/EditTransactionModal.jsx';

const API = import.meta.env.REACT_APP_BACKEND_URL || '';

function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const FREQ_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

function SummaryCard({ label, value, color, sub, onClick, active }) {
  return (
    <div onClick={onClick} style={{
      flex: 1, minWidth: 180, padding: '24px', background: '#fff',
      border: active ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)', borderRadius: 2,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          {label}
        </div>
        {onClick && (active ? <CaretUp size={14} style={{ color: 'var(--brand-primary)' }} /> : <CaretDown size={14} style={{ color: 'var(--text-muted)' }} />)}
      </div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 700, color, letterSpacing: '-0.02em' }}>
        {formatCurrency(value)}
      </div>
      {sub && <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ProjectionChart({ data }) {
  if (!data || data.length === 0) return null;

  const maxIncome = Math.max(...data.map(d => d.projected_income), 1);
  const maxExpense = Math.max(...data.map(d => d.projected_expense), 1);
  const maxVal = Math.max(maxIncome, maxExpense);

  const chartH = 220;
  const barW = Math.max(12, Math.floor((900 - 48) / data.length) - 8);

  return (
    <div data-testid="projection-chart" style={{ overflowX: 'auto', padding: '20px 0' }}>
      <svg width={Math.max(900, data.length * (barW + 8) + 48)} height={chartH + 40} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct} x1="20" y1={chartH - 20 - pct * (chartH - 40)} x2="100%" y2={chartH - 20 - pct * (chartH - 40)}
            stroke="var(--border-subtle)" strokeDasharray="4,4" />
        ))}

        {data.map((d, i) => {
          const x = 24 + i * (barW + 8);
          const incomeH = maxVal > 0 ? (d.projected_income / maxVal) * (chartH - 40) : 0;
          const expenseH = maxVal > 0 ? (d.projected_expense / maxVal) * (chartH - 40) : 0;

          return (
            <g key={d.label}>
              {/* Income bar */}
              <rect x={x} y={chartH - 20 - incomeH} width={barW / 2 - 1} height={incomeH}
                fill="var(--success)" opacity="0.7" rx="1" />
              {/* Expense bar */}
              <rect x={x + barW / 2 + 1} y={chartH - 20 - expenseH} width={barW / 2 - 1} height={expenseH}
                fill="var(--error)" opacity="0.7" rx="1" />
              {/* Month label */}
              {(i % 3 === 0 || data.length <= 12) && (
                <text x={x + barW / 2} y={chartH + 16} textAnchor="middle"
                  style={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {d.label.replace(' ', '\n')}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8, fontSize: 11 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: 'var(--success)', borderRadius: 1, opacity: 0.7 }} /> Income
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: 'var(--error)', borderRadius: 1, opacity: 0.7 }} /> Expense
        </span>
      </div>
    </div>
  );
}

export default function CashFlow() {
  const cached = getCached('cashflow');
  const [projection, setProjection] = useState(cached?.projection || null);
  const [allTransactions, setAllTransactions] = useState(cached?.transactions || []);
  const [accounts, setAccounts] = useState(cached?.accounts || []);
  const [categories, setCategories] = useState(cached?.categories || []);
  const [loading, setLoading] = useState(!cached);
  const [editingId, setEditingId] = useState(null);
  const [editFreq, setEditFreq] = useState('monthly');
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [mandates, setMandates] = useState(cached?.mandates || []);
  const [mandateBusyId, setMandateBusyId] = useState('');
  const [expandedTile, setExpandedTile] = useState(null);
  const [editTxn, setEditTxn] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadingTxnId, setLoadingTxnId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [proj, txnData, accs, cats, mnd] = await Promise.all([
        api.get('/api/cashflow/projection'),
        api.get('/api/transactions?status=approved&limit=500'),
        api.get('/api/accounts'),
        api.get('/api/categories'),
        api.get('/api/mandates').catch(() => ({ mandates: [] })),
      ]);
      setProjection(proj);
      setAllTransactions(txnData.transactions || []);
      setAccounts(accs);
      setCategories(cats);
      setMandates(mnd.mandates || []);
      setCache('cashflow', {
        projection: proj, transactions: txnData.transactions || [],
        accounts: accs, categories: cats, mandates: mnd.mandates || [],
      });
    } catch {
      // Cash flow will show empty state on error
    }
    setLoading(false);
  }, []);

  const toggleTile = (tile) => {
    setExpandedTile(prev => prev === tile ? null : tile);
  };

  const handleRecurringItemClick = async (item) => {
    if (!item.transaction_id) return;
    setLoadingTxnId(item.transaction_id);
    try {
      const txn = await api.get(`/api/transactions/${item.transaction_id}`);
      setEditTxn(txn);
      setShowEditModal(true);
    } catch (err) {
      alert('Could not load transaction: ' + err.message);
    } finally {
      setLoadingTxnId(null);
    }
  };

  const handleEditModalSave = () => {
    setShowEditModal(false);
    setEditTxn(null);
    loadData();
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setEditTxn(null);
  };

  const openReceipt = (receiptId, e) => {
    e.stopPropagation();
    window.open(`${API}/api/receipts/${receiptId}/download`, '_blank');
  };

  const toggleMandateStatus = async (mandateId, currentStatus) => {
    const next = currentStatus === 'active' ? 'paused' : 'active';
    const prev = mandates;
    // Optimistic: update UI immediately
    setMandates(prev.map(m => m.mandate_id === mandateId ? { ...m, status: next } : m));
    try {
      await api.patch(`/api/mandates/${mandateId}`, { status: next });
      loadData(); // refresh projection totals in background
    } catch (err) {
      setMandates(prev); // rollback
      alert(err.message);
    }
  };

  const deleteMandate = async (mandateId) => {
    if (!confirm('Delete this mandate? It will be removed from cash flow projection.')) return;
    const prev = mandates;
    // Optimistic: remove immediately
    setMandates(prev.filter(m => m.mandate_id !== mandateId));
    try {
      await api.del(`/api/mandates/${mandateId}`);
      loadData();
    } catch (err) {
      setMandates(prev);
      alert(err.message);
    }
  };

  const updateMandateAmount = async (mandateId, newAmount) => {
    const amt = Number(newAmount);
    const prev = mandates;
    // Optimistic: update amount immediately
    setMandates(prev.map(m => m.mandate_id === mandateId ? { ...m, amount: amt } : m));
    try {
      await api.patch(`/api/mandates/${mandateId}`, { amount: amt });
      loadData();
    } catch (err) {
      setMandates(prev);
      alert(err.message);
    }
  };

  useEffect(() => {
    let active = true;
    loadData().then(() => { if (!active) return; }); // eslint-disable-line react-hooks/set-state-in-effect
    return () => { active = false; };
  }, [loadData]);

  const toggleRecurring = async (txnId, isRecurring, frequency) => {
    try {
      await api.post(`/api/transactions/${txnId}/toggle-recurring`, {
        is_recurring: isRecurring,
        recurring_frequency: isRecurring ? frequency : null,
      });
      setEditingId(null);
      loadData();
    } catch (err) { alert(err.message); }
  };

  const getAccountName = (id) => accounts.find(a => a.account_id === id)?.name || '';
  const getCategoryName = (id) => categories.find(c => c.category_id === id)?.name || '';

  const nonRecurringTxns = allTransactions.filter(t => !t.is_recurring && t.transaction_type !== 'transfer');

  if (loading) {
    return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>Loading cash flow data...</div>;
  }

  const proj = projection || {};
  const recurringItems = proj.recurring_items || [];
  const projectionData = proj.projection || [];

  return (
    <div data-testid="cashflow-page">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Cash Flow Projection</h1>
        <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          24-month forecast based on your confirmed recurring transactions
        </p>
      </div>

      {/* Summary Cards */}
      <div data-testid="cashflow-summary" style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <SummaryCard label="Monthly Income" value={proj.monthly_recurring_income} color="var(--success)"
          sub={`${recurringItems.filter(r => r.transaction_type === 'income').length} sources`}
          onClick={() => toggleTile('income')} active={expandedTile === 'income'} />
        <SummaryCard label="Monthly Expense" value={proj.monthly_recurring_expense} color="var(--error)"
          sub={`${recurringItems.filter(r => r.transaction_type === 'expense').length} sources`}
          onClick={() => toggleTile('expense')} active={expandedTile === 'expense'} />
        <SummaryCard label="Monthly Mandates" value={proj.monthly_mandate_expense || 0} color="var(--error)"
          sub={`${(mandates || []).filter(m => m.status === 'active').length} active`}
          onClick={() => toggleTile('mandates')} active={expandedTile === 'mandates'} />
        {(proj.monthly_od_interest || 0) > 0 && (
          <SummaryCard label="OD Interest" value={proj.monthly_od_interest} color="var(--error)"
            sub={`${(proj.od_interest_items || []).length} OD account${(proj.od_interest_items || []).length !== 1 ? 's' : ''}`}
            onClick={() => toggleTile('odInterest')} active={expandedTile === 'odInterest'} />
        )}
        <SummaryCard label="Monthly Net" value={proj.monthly_net}
          color={proj.monthly_net >= 0 ? 'var(--success)' : 'var(--error)'}
          sub="Projected savings"
          onClick={() => toggleTile('net')} active={expandedTile === 'net'} />
      </div>

      {/* Drill-Down Section */}
      {expandedTile && (
        <div data-testid={`drilldown-${expandedTile}`} style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
          marginBottom: 32, overflow: 'hidden',
        }}>
          {/* Income drill-down */}
          {expandedTile === 'income' && (() => {
            const incomeItems = recurringItems.filter(r => r.transaction_type === 'income');
            return incomeItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
                No recurring income sources found.
              </div>
            ) : (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px 8px' }}>
                  {incomeItems.length} recurring income source{incomeItems.length !== 1 ? 's' : ''}
                </div>
                {incomeItems.map(item => (
                  <div key={item.transaction_id}
                    onClick={() => handleRecurringItemClick(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
                      border: '1px solid var(--border-subtle)', borderRadius: 2, cursor: 'pointer',
                      background: 'var(--bg-primary)', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                        {item.description || '—'}
                        {loadingTxnId === item.transaction_id && <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Loading...</span>}
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {item.frequency || 'monthly'} {item.recurrence_date ? `on day ${item.recurrence_date}` : ''}
                        {getAccountName(item.account_id) ? ` \u00b7 ${getAccountName(item.account_id)}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {item.receipt_id && (
                        <button onClick={(e) => openReceipt(item.receipt_id, e)} title="View receipt"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-1)', padding: 4 }}>
                          <Receipt size={18} weight="duotone" />
                        </button>
                      )}
                      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)', whiteSpace: 'nowrap' }}>
                        {formatCurrency(item.monthly_amount || item.amount)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
                      </div>
                      <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Expense drill-down */}
          {expandedTile === 'expense' && (() => {
            const expenseItems = recurringItems.filter(r => r.transaction_type === 'expense');
            return expenseItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
                No recurring expense sources found.
              </div>
            ) : (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px 8px' }}>
                  {expenseItems.length} recurring expense source{expenseItems.length !== 1 ? 's' : ''}
                </div>
                {expenseItems.map(item => (
                  <div key={item.transaction_id}
                    onClick={() => handleRecurringItemClick(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
                      border: '1px solid var(--border-subtle)', borderRadius: 2, cursor: 'pointer',
                      background: 'var(--bg-primary)', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                        {item.description || '—'}
                        {loadingTxnId === item.transaction_id && <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Loading...</span>}
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {item.frequency || 'monthly'} {item.recurrence_date ? `on day ${item.recurrence_date}` : ''}
                        {getAccountName(item.account_id) ? ` \u00b7 ${getAccountName(item.account_id)}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {item.receipt_id && (
                        <button onClick={(e) => openReceipt(item.receipt_id, e)} title="View receipt"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-1)', padding: 4 }}>
                          <Receipt size={18} weight="duotone" />
                        </button>
                      )}
                      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--error)', whiteSpace: 'nowrap' }}>
                        {formatCurrency(item.monthly_amount || item.amount)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
                      </div>
                      <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Mandates drill-down */}
          {expandedTile === 'mandates' && (() => {
            const activeMandates = (mandates || []).filter(m => m.status === 'active');
            return activeMandates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
                No active mandates found.
              </div>
            ) : (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px 8px' }}>
                  {activeMandates.length} active mandate{activeMandates.length !== 1 ? 's' : ''}
                </div>
                {activeMandates.map(m => {
                  const monthlyEq = m.frequency === 'weekly' ? m.amount * (52 / 12)
                    : m.frequency === 'yearly' ? m.amount / 12
                    : m.frequency === 'quarterly' ? m.amount / 3
                    : m.amount;
                  return (
                    <div key={m.mandate_id} style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
                      border: '1px solid var(--border-subtle)', borderRadius: 2,
                      background: 'var(--bg-primary)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                          {m.merchant || '—'}
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {m.mandate_type || 'mandate'} \u00b7 {m.frequency || 'monthly'}
                          {m.start_date ? ` \u00b7 since ${m.start_date}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--error)', whiteSpace: 'nowrap' }}>
                          {formatCurrency(monthlyEq)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* OD Interest drill-down */}
          {expandedTile === 'odInterest' && (() => {
            const odItems = proj.od_interest_items || [];
            return odItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
                No OD interest items found.
              </div>
            ) : (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px 8px' }}>
                  {odItems.length} OD account{odItems.length !== 1 ? 's' : ''}
                </div>
                {odItems.map((item, idx) => (
                  <div key={item.account_id || idx} style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
                    border: '1px solid var(--border-subtle)', borderRadius: 2,
                    background: 'var(--bg-primary)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                        {item.account_name || getAccountName(item.account_id) || 'OD Account'}
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Rate: {(item.rate ?? item.interest_rate) != null ? `${item.rate ?? item.interest_rate}%` : '—'}
                        {(item.balance ?? item.od_balance) != null ? ` \u00b7 Balance: ${formatCurrency(item.balance ?? item.od_balance)}` : ''}
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--error)', whiteSpace: 'nowrap' }}>
                      {formatCurrency(item.monthly_interest || item.amount)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Net drill-down (summary breakdown) */}
          {expandedTile === 'net' && (
            <div style={{ padding: 24 }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                Monthly Net Breakdown
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 14 }}>Recurring Income</span>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)' }}>
                    + {formatCurrency(proj.monthly_recurring_income || 0)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 14 }}>Recurring Expenses</span>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--error)' }}>
                    - {formatCurrency(proj.monthly_recurring_expense || 0)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 14 }}>Mandates</span>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--error)' }}>
                    - {formatCurrency(proj.monthly_mandate_expense || 0)}
                  </span>
                </div>
                {(proj.monthly_od_interest || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 14 }}>OD Interest</span>
                    <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--error)' }}>
                      - {formatCurrency(proj.monthly_od_interest || 0)}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '2px solid var(--border-strong)' }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>Monthly Net</span>
                  <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: (proj.monthly_net || 0) >= 0 ? 'var(--success)' : 'var(--error)' }}>
                    {formatCurrency(proj.monthly_net || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 24-Month Chart */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: '24px', marginBottom: 32
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>24-Month Projection</h2>
        {projectionData.length > 0 ? (
          <ProjectionChart data={projectionData} />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
            No recurring transactions yet. Mark transactions as recurring below to generate projections.
          </div>
        )}
      </div>

      {/* Recurring Transactions */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        overflow: 'hidden', marginBottom: 32
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-secondary)'
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Repeat size={20} weight="duotone" style={{ color: 'var(--accent-1)' }} />
              Recurring Transactions
              <span className="mono" style={{
                fontSize: 12, padding: '2px 8px', background: 'rgba(194,109,92,0.15)',
                color: 'var(--accent-1)', borderRadius: 2, fontWeight: 600
              }}>{recurringItems.length}</span>
            </h2>
            <p className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Only transactions confirmed as recurring from email/SMS evidence or manually marked
            </p>
          </div>
          <button data-testid="add-recurring-btn"
            onClick={() => setShowAddRecurring(!showAddRecurring)}
            style={{
              background: 'var(--brand-primary)', color: '#fff', border: 'none',
              padding: '8px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
            {showAddRecurring ? 'Hide' : 'Mark as Recurring'}
          </button>
        </div>

        {recurringItems.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Frequency</th>
                <th style={thStyle}>Day</th>
                <th style={thStyle}>Monthly Equiv.</th>
                <th style={thStyle}>Account</th>
                <th style={thStyle}>Category</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recurringItems.map(item => (
                <tr key={item.transaction_id} data-testid={`recurring-${item.transaction_id}`}
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={tdStyle}>{item.description || '—'}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      color: item.transaction_type === 'income' ? 'var(--success)' : 'var(--error)',
                      background: item.transaction_type === 'income' ? 'rgba(58,92,74,0.1)' : 'rgba(150,69,58,0.1)'
                    }}>
                      {item.transaction_type}
                    </span>
                  </td>
                  <td className="mono" style={{ ...tdStyle, fontWeight: 600 }}>{formatCurrency(item.amount)}</td>
                  <td style={tdStyle}>
                    {editingId === item.transaction_id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <select value={editFreq} onChange={e => setEditFreq(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--border-strong)', borderRadius: 2 }}>
                          {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        <button onClick={() => toggleRecurring(item.transaction_id, true, editFreq)}
                          style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 2, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>
                          <Check size={12} weight="bold" />
                        </button>
                        <button onClick={() => setEditingId(null)}
                          style={{ background: 'none', border: '1px solid var(--border-strong)', borderRadius: 2, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <span onClick={() => { setEditingId(item.transaction_id); setEditFreq(item.frequency || 'monthly'); }}
                        style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                        {item.frequency || 'monthly'}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>{item.recurrence_date ? `${item.recurrence_date}` : '—'}</td>
                  <td className="mono" style={{ ...tdStyle, color: 'var(--text-muted)' }}>{formatCurrency(item.monthly_amount)}/mo</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{getAccountName(item.account_id)}</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{getCategoryName(item.category_id)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button data-testid={`remove-recurring-${item.transaction_id}`} data-guard
                      onClick={() => toggleRecurring(item.transaction_id, false)}
                      style={{
                        background: 'none', border: '1px solid var(--error)', color: 'var(--error)',
                        borderRadius: 2, padding: '4px 10px', cursor: 'pointer', fontSize: 11,
                        fontWeight: 600, fontFamily: 'var(--font-body)'
                      }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {recurringItems.length === 0 && !showAddRecurring && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
            No recurring transactions yet. Click &ldquo;Mark as Recurring&rdquo; to add from your approved transactions.
          </div>
        )}
      </div>

      {/* Mandates detected from emails */}
      <div data-testid="mandates-section" style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        overflow: 'hidden', marginBottom: 32
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={20} weight="duotone" style={{ color: 'var(--accent-1)' }} />
            Mandates & Auto-Debits
            <span className="mono" style={{
              fontSize: 12, padding: '2px 8px', background: 'rgba(194,109,92,0.15)',
              color: 'var(--accent-1)', borderRadius: 2, fontWeight: 600
            }}>{(mandates || []).length}</span>
          </h2>
          <p className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Committed future outflows detected from mandate / auto-pay / NACH / UPI AutoPay emails. Active mandates are folded into the 24-month projection.
          </p>
        </div>

        {(mandates || []).length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={thStyle}>Merchant</th>
                <th style={thStyle}>Type</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                <th style={thStyle}>Frequency</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Monthly Equiv.</th>
                <th style={thStyle}>Start</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Source</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(mandates || []).map(m => {
                const monthlyEq = m.frequency === 'weekly' ? m.amount * (52 / 12)
                  : m.frequency === 'yearly' ? m.amount / 12
                  : m.frequency === 'quarterly' ? m.amount / 3
                  : m.amount;
                const paused = m.status !== 'active';
                const busy = mandateBusyId === m.mandate_id;
                return (
                  <tr key={m.mandate_id} data-testid={`mandate-${m.mandate_id}`}
                    style={{ borderBottom: '1px solid var(--border-subtle)', opacity: paused ? 0.55 : 1 }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{m.merchant || '—'}</div>
                      {m.source_email_subject && (
                        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          {m.source_email_subject.length > 60 ? m.source_email_subject.slice(0, 57) + '…' : m.source_email_subject}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {m.mandate_type || '—'}
                    </td>
                    <td className="mono" style={{ ...tdStyle, fontWeight: 600, textAlign: 'right' }}>
                      <input
                        type="number"
                        defaultValue={m.amount}
                        disabled={busy}
                        onBlur={(ev) => {
                          const v = Number(ev.target.value);
                          if (v > 0 && v !== m.amount) updateMandateAmount(m.mandate_id, v);
                        }}
                        style={{
                          width: 100, textAlign: 'right', padding: '4px 6px', fontSize: 13,
                          border: '1px solid var(--border-subtle)', borderRadius: 2,
                          fontFamily: 'var(--font-mono)', background: '#fff',
                        }}
                      />
                    </td>
                    <td style={tdStyle}>{m.frequency || 'monthly'}</td>
                    <td className="mono" style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-muted)' }}>
                      {formatCurrency(monthlyEq)}/mo
                    </td>
                    <td className="mono" style={{ ...tdStyle, fontSize: 12 }}>{m.start_date || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        color: paused ? 'var(--text-muted)' : 'var(--success)',
                        background: paused ? 'var(--bg-secondary)' : 'rgba(58,92,74,0.1)',
                      }}>{m.status || 'active'}</span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 11 }}>
                      <span style={{
                        padding: '2px 6px', borderRadius: 2, fontSize: 10, fontWeight: 600,
                        background: (m.source || '').startsWith('email') ? '#2563EB18' : '#00000010',
                        color: (m.source || '').startsWith('email') ? '#2563EB' : 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}>{(m.source || 'manual').replace(/^email:/, '')}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          data-testid={`mandate-toggle-${m.mandate_id}`}
                          onClick={() => toggleMandateStatus(m.mandate_id, m.status)}
                          disabled={busy}
                          title={paused ? 'Resume' : 'Pause'}
                          style={{
                            background: 'none', border: '1px solid var(--border-strong)',
                            borderRadius: 2, padding: '4px 8px', cursor: busy ? 'not-allowed' : 'pointer',
                            fontSize: 11, color: 'var(--text-primary)',
                          }}>
                          {paused ? <Play size={12} weight="bold" /> : <Pause size={12} weight="bold" />}
                        </button>
                        <button
                          data-testid={`mandate-delete-${m.mandate_id}`}
                          data-guard
                          onClick={() => deleteMandate(m.mandate_id)}
                          disabled={busy}
                          style={{
                            background: 'none', border: '1px solid var(--error)', color: 'var(--error)',
                            borderRadius: 2, padding: '4px 8px', cursor: busy ? 'not-allowed' : 'pointer',
                            fontSize: 11,
                          }}>
                          <Trash size={12} weight="bold" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
            No mandates detected yet. Connect your email and we&rsquo;ll pick up NACH / e-mandate / UPI AutoPay confirmations automatically.
          </div>
        )}
      </div>

      {/* Add Recurring from existing transactions */}
      {showAddRecurring && (
        <div data-testid="add-recurring-section" style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(194,109,92,0.04)'
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              Select transactions to mark as recurring
            </h3>
            <p className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Only mark transactions that you know are recurring (subscriptions, rent, salary, etc.)
            </p>
          </div>

          {nonRecurringTxns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
              No approved non-recurring transactions available.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Source</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Mark Recurring</th>
                </tr>
              </thead>
              <tbody>
                {nonRecurringTxns.slice(0, 30).map(txn => (
                  <RecurringRow key={txn.transaction_id} txn={txn} onMark={toggleRecurring} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Monthly Breakdown Table */}
      {projectionData.length > 0 && (
        <div data-testid="monthly-breakdown" style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
          overflow: 'hidden', marginTop: 32
        }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 500 }}>Monthly Breakdown</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={thStyle}>Month</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Income</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Expense</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Mandates</th>
                {(proj.monthly_od_interest || 0) > 0 && <th style={{ ...thStyle, textAlign: 'right' }}>OD Interest</th>}
                <th style={{ ...thStyle, textAlign: 'right' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {projectionData.map((m, idx) => (
                <tr key={m.label} style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: idx % 2 === 0 ? '#fff' : 'var(--bg-secondary)'
                }}>
                  <td style={tdStyle}>{m.label}</td>
                  <td className="mono" style={{ ...tdStyle, textAlign: 'right', color: 'var(--success)', fontWeight: 500 }}>
                    {formatCurrency(m.projected_income)}
                  </td>
                  <td className="mono" style={{ ...tdStyle, textAlign: 'right', color: 'var(--error)', fontWeight: 500 }}>
                    {formatCurrency(m.projected_expense)}
                  </td>
                  <td className="mono" style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {formatCurrency(m.mandate_expense || 0)}
                  </td>
                  {(proj.monthly_od_interest || 0) > 0 && (
                    <td className="mono" style={{ ...tdStyle, textAlign: 'right', color: 'var(--error)', fontWeight: 500 }}>
                      {formatCurrency(m.od_interest || 0)}
                    </td>
                  )}
                  <td className="mono" style={{
                    ...tdStyle, textAlign: 'right', fontWeight: 600,
                    color: m.net >= 0 ? 'var(--success)' : 'var(--error)'
                  }}>
                    {formatCurrency(m.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && editTxn && (
        <EditTransactionModal
          transaction={editTxn}
          accounts={accounts}
          categories={categories}
          onSave={handleEditModalSave}
          onClose={handleEditModalClose}
        />
      )}
    </div>
  );
}

function RecurringRow({ txn, onMark }) {
  const [freq, setFreq] = useState('monthly');
  const [open, setOpen] = useState(false);

  return (
    <tr data-testid={`mark-recurring-${txn.transaction_id}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <td className="mono" style={{ ...tdStyle, fontSize: 12 }}>{txn.date}</td>
      <td style={tdStyle}>
        <span style={{
          padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          color: txn.transaction_type === 'income' ? 'var(--success)' : 'var(--error)',
          background: txn.transaction_type === 'income' ? 'rgba(58,92,74,0.1)' : 'rgba(150,69,58,0.1)'
        }}>
          {txn.transaction_type}
        </span>
      </td>
      <td style={tdStyle}>{txn.description || '—'}</td>
      <td className="mono" style={{ ...tdStyle, fontWeight: 600 }}>{formatCurrency(txn.amount)}</td>
      <td style={{ ...tdStyle, fontSize: 11 }}>
        <span style={{
          padding: '2px 6px', borderRadius: 2, fontSize: 10, fontWeight: 600,
          background: txn.source === 'sms' ? '#7C3AED18' : '#2563EB18',
          color: txn.source === 'sms' ? '#7C3AED' : '#2563EB',
          textTransform: 'uppercase'
        }}>
          {txn.source}
        </span>
      </td>
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        {open ? (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
            <select value={freq} onChange={e => setFreq(e.target.value)}
              data-testid={`freq-select-${txn.transaction_id}`}
              style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--border-strong)', borderRadius: 2 }}>
              {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <button data-testid={`confirm-recurring-${txn.transaction_id}`}
              onClick={() => { onMark(txn.transaction_id, true, freq); setOpen(false); }}
              style={{
                background: 'var(--success)', color: '#fff', border: 'none',
                borderRadius: 2, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600
              }}>
              Confirm
            </button>
            <button onClick={() => setOpen(false)}
              style={{
                background: 'none', border: '1px solid var(--border-strong)',
                borderRadius: 2, padding: '5px 8px', cursor: 'pointer', fontSize: 11
              }}>
              Cancel
            </button>
          </div>
        ) : (
          <button data-testid={`mark-btn-${txn.transaction_id}`}
            onClick={() => setOpen(true)}
            style={{
              background: 'var(--brand-primary)', color: '#fff', border: 'none',
              borderRadius: 2, padding: '5px 14px', cursor: 'pointer', fontSize: 11,
              fontWeight: 600, fontFamily: 'var(--font-body)',
              display: 'inline-flex', alignItems: 'center', gap: 4
            }}>
            <Repeat size={12} weight="bold" /> Mark
          </button>
        )}
      </td>
    </tr>
  );
}

const thStyle = {
  padding: '10px 16px', textAlign: 'left', fontWeight: 600,
  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--text-muted)'
};

const tdStyle = {
  padding: '10px 16px'
};
