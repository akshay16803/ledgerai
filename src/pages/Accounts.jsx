import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import { Plus, Trash, PencilSimple, Bank, Wallet, CreditCard } from '@phosphor-icons/react';

const accountTypes = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
];

const subTypes = {
  asset: ['bank', 'cash', 'investment', 'fixed_deposit', 'other'],
  liability: ['credit_card', 'loan', 'mortgage', 'other'],
};

const typeIcons = { bank: Bank, cash: Wallet, credit_card: CreditCard };

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', account_type: 'asset', sub_type: 'bank', opening_balance: 0, currency: 'INR', description: '' });
  const [error, setError] = useState('');

  const load = () => {
    api.get('/api/accounts').then(data => { setAccounts(data); setCache('accounts', data); }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Account name is required'); return; }
    try {
      await api.post('/api/accounts', { ...form, opening_balance: parseFloat(form.opening_balance) || 0 });
      setShowForm(false);
      setForm({ name: '', account_type: 'asset', sub_type: 'bank', opening_balance: 0, currency: 'INR', description: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this account?')) return;
    try {
      await api.del(`/api/accounts/${id}`);
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div data-testid="accounts-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Accounts</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Manage your financial accounts</p>
        </div>
        <button data-testid="add-account-btn" onClick={() => setShowForm(!showForm)} style={{
          background: 'var(--brand-primary)', color: '#fff', border: 'none',
          padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Plus size={14} weight="bold" /> Add Account
        </button>
      </div>

      {/* Add Account Form */}
      {showForm && (
        <div data-testid="add-account-form" style={{
          background: '#fff', border: '1px solid var(--border-subtle)',
          borderRadius: 2, padding: 28, marginBottom: 24
        }}>
          <h3 style={{ fontSize: 16, fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: 20 }}>New Account</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Account Name *</label>
                <input data-testid="account-name-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)' }}
                  placeholder="e.g., HDFC Savings" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Type *</label>
                <select data-testid="account-type-select" value={form.account_type} onChange={e => setForm(f => ({...f, account_type: e.target.value, sub_type: subTypes[e.target.value]?.[0] || ''}))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', background: 'var(--bg-primary)' }}>
                  {accountTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Sub Type</label>
                <select data-testid="account-subtype-select" value={form.sub_type} onChange={e => setForm(f => ({...f, sub_type: e.target.value}))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', background: 'var(--bg-primary)' }}>
                  {(subTypes[form.account_type] || []).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Opening Balance</label>
                <input data-testid="account-balance-input" type="number" value={form.opening_balance} onChange={e => setForm(f => ({...f, opening_balance: e.target.value}))}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', outline: 'none' }}
                  placeholder="0" />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Description</label>
              <input data-testid="account-desc-input" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)' }}
                placeholder="Optional description" />
            </div>
            {error && <p data-testid="account-error" style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button data-testid="save-account-btn" type="submit" style={{
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
                padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)'
              }}>Save Account</button>
              <button type="button" onClick={() => setShowForm(false)} style={{
                background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                padding: '10px 24px', borderRadius: 2, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)'
              }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts List */}
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-muted)' }}>Loading accounts...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {accounts.map(acc => {
            const Icon = typeIcons[acc.sub_type] || Bank;
            return (
              <div key={acc.account_id} data-testid={`account-card-${acc.account_id}`} style={{
                background: '#fff', border: '1px solid var(--border-subtle)',
                borderRadius: 2, padding: 24,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(26,54,45,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <Icon size={24} weight="duotone" style={{ color: 'var(--accent-1)' }} />
                  <button data-testid={`delete-account-${acc.account_id}`} onClick={() => handleDelete(acc.account_id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4
                  }}>
                    <Trash size={16} />
                  </button>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-body)', marginBottom: 4 }}>{acc.name}</h3>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {acc.account_type} / {acc.sub_type?.replace(/_/g, ' ') || 'general'}
                </span>
                <div className="mono" style={{
                  fontSize: 24, fontWeight: 600, marginTop: 16,
                  color: acc.balance >= 0 ? 'var(--success)' : 'var(--error)'
                }}>
                  {formatCurrency(acc.balance)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
