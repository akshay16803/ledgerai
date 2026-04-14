import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import {
  TrendUp, TrendDown, Scales, Clock, ArrowRight, Plus
} from '@phosphor-icons/react';

function StatCard({ testId, label, value, icon: Icon, color, accent }) {
  return (
    <div data-testid={testId} style={{
      background: '#fff', border: '1px solid var(--border-subtle)',
      padding: '24px 28px', borderRadius: 2,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,54,45,0.06)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
          {label}
        </span>
        <Icon size={20} weight="duotone" style={{ color: accent || 'var(--text-muted)' }} />
      </div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 600, color: color || 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  );
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function Dashboard() {
  const [summary, setSummary] = useState(() => getCached('dashboard'));
  const [loading, setLoading] = useState(!getCached('dashboard'));
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const data = await api.get('/api/dashboard/summary');
      setSummary(data);
      setCache('dashboard', data);
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>Loading dashboard...</div>;
  }

  if (!summary) {
    return <div style={{ color: 'var(--error)', padding: 40 }}>Failed to load dashboard data.</div>;
  }

  return (
    <div data-testid="dashboard-page">
      <div className="action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Dashboard</h1>
          <p className="mono page-subtitle" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Financial overview
          </p>
        </div>
        <button data-testid="add-transaction-btn" onClick={() => navigate('/transactions')} style={{
          background: 'var(--brand-primary)', color: '#fff', border: 'none',
          padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'background 0.2s ease'
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#2A463D'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--brand-primary)'}
        >
          <Plus size={14} weight="bold" /> New Transaction
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard testId="stat-net-worth" label="Net Worth" value={formatCurrency(summary.net_worth)} icon={Scales} color="var(--brand-primary)" accent="var(--accent-3)" />
        <StatCard testId="stat-income" label="Income This Month" value={formatCurrency(summary.income_this_month)} icon={TrendUp} color="var(--success)" accent="var(--success)" />
        <StatCard testId="stat-expenses" label="Expenses This Month" value={formatCurrency(summary.expense_this_month)} icon={TrendDown} color="var(--error)" accent="var(--error)" />
        <StatCard testId="stat-pending" label="Pending Review" value={summary.pending_review} icon={Clock} color="var(--warning)" accent="var(--warning)" />
      </div>

      {/* Two columns: Accounts + Recent Transactions */}
      <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Accounts */}
        <div data-testid="accounts-overview" style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontFamily: 'var(--font-body)', fontWeight: 600 }}>Accounts</h3>
            <button data-testid="view-all-accounts-btn" onClick={() => navigate('/accounts')} style={{
              background: 'none', border: 'none', color: 'var(--accent-1)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
              View all <ArrowRight size={12} />
            </button>
          </div>
          {summary.accounts?.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No accounts yet. Create your first account.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {summary.accounts?.map(acc => (
                <div key={acc.account_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 2
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{acc.name}</div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {acc.account_type} {acc.sub_type ? `/ ${acc.sub_type}` : ''}
                    </span>
                  </div>
                  <span className="mono" style={{
                    fontSize: 15, fontWeight: 600,
                    color: acc.balance >= 0 ? 'var(--success)' : 'var(--error)'
                  }}>
                    {formatCurrency(acc.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div data-testid="recent-transactions" style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontFamily: 'var(--font-body)', fontWeight: 600 }}>Recent Transactions</h3>
            <button data-testid="view-all-transactions-btn" onClick={() => navigate('/transactions')} style={{
              background: 'none', border: 'none', color: 'var(--accent-1)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
              View all <ArrowRight size={12} />
            </button>
          </div>
          {summary.recent_transactions?.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No transactions yet. Record your first one!</p>
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
                    fontSize: 14, fontWeight: 600,
                    color: txn.transaction_type === 'income' ? 'var(--success)' :
                           txn.transaction_type === 'expense' ? 'var(--error)' : 'var(--info)'
                  }}>
                    {txn.transaction_type === 'income' ? '+' : txn.transaction_type === 'expense' ? '-' : ''}
                    {formatCurrency(txn.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
