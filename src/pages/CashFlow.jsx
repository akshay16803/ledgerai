import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import {
  TrendUp, TrendDown, Repeat, ArrowRight,
  CurrencyInr, CalendarBlank, Check, X, CaretDown, Receipt, Pause, Play, Trash
} from '@phosphor-icons/react';

function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const FREQ_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

function SummaryCard({ label, value, color, sub }) {
  return (
    <div style={{
      flex: 1, minWidth: 180, padding: '24px', background: '#fff',
      border: '1px solid var(--border-subtle)', borderRadius: 2
    }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
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

  const toggleMandateStatus = async (mandateId, currentStatus) => {
    setMandateBusyId(mandateId);
    try {
      const next = currentStatus === 'active' ? 'paused' : 'active';
      await api.patch(`/api/mandates/${mandateId}`, { status: next });
      await loadData();
    } catch (err) { alert(err.message); }
    setMandateBusyId('');
  };

  const deleteMandate = async (mandateId) => {
    if (!confirm('Delete this mandate? It will be removed from cash flow projection.')) return;
    setMandateBusyId(mandateId);
    try {
      await api.del(`/api/mandates/${mandateId}`);
      await loadData();
    } catch (err) { alert(err.message); }
    setMandateBusyId('');
  };

  const updateMandateAmount = async (mandateId, newAmount) => {
    setMandateBusyId(mandateId);
    try {
      await api.patch(`/api/mandates/${mandateId}`, { amount: Number(newAmount) });
      await loadData();
    } catch (err) { alert(err.message); }
    setMandateBusyId('');
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
      <div data-testid="cashflow-summary" style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <SummaryCard label="Monthly Income" value={proj.monthly_recurring_income} color="var(--success)"
          sub={`${recurringItems.filter(r => r.transaction_type === 'income').length} sources`} />
        <SummaryCard label="Monthly Expense" value={proj.monthly_recurring_expense} color="var(--error)"
          sub={`${recurringItems.filter(r => r.transaction_type === 'expense').length} sources`} />
        <SummaryCard label="Monthly Mandates" value={proj.monthly_mandate_expense || 0} color="var(--error)"
          sub={`${(mandates || []).filter(m => m.status === 'active').length} active`} />
        <SummaryCard label="Monthly Net" value={proj.monthly_net}
          color={proj.monthly_net >= 0 ? 'var(--success)' : 'var(--error)'}
          sub="Projected savings" />
      </div>

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
