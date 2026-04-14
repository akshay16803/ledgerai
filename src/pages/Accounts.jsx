import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import { Plus, Trash, PencilSimple, Bank, Wallet, CreditCard, X } from '@phosphor-icons/react';

const accountTypes = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
];

const subTypes = {
  asset: ['bank', 'cash', 'wallet', 'investment', 'savings', 'fixed_deposit'],
  liability: ['credit_card', 'loan', 'mortgage'],
  equity: ['capital', 'retained_earnings'],
};

const typeIcons = { bank: Bank, cash: Wallet, wallet: Wallet, credit_card: CreditCard };

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)',
  borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)',
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };

export default function Accounts() {
  const [accounts, setAccounts] = useState(() => getCached('accounts') || []);
  const [loading, setLoading] = useState(!getCached('accounts'));
  const [showForm, setShowForm] = useState(false);
  const [editingAcc, setEditingAcc] = useState(null);
  const [form, setForm] = useState({ name: '', account_type: 'asset', sub_type: 'bank', opening_balance: '', currency: 'INR', description: '' });
  const [error, setError] = useState('');

  const load = () => {
    api.get('/api/accounts').then(data => { setAccounts(data); setCache('accounts', data); }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingAcc(null);
    setForm({ name: '', account_type: 'asset', sub_type: 'bank', opening_balance: '', currency: 'INR', description: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (acc) => {
    setEditingAcc(acc);
    setForm({
      name: acc.name,
      account_type: acc.account_type,
      sub_type: acc.sub_type || '',
      opening_balance: acc.opening_balance || 0,
      balance: acc.balance || 0,
      currency: acc.currency || 'INR',
      description: acc.description || '',
    });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Account name is required'); return; }
    if (form.opening_balance === '' && !editingAcc) { setError('Opening balance is required'); return; }

    try {
      if (editingAcc) {
        const update = { name: form.name, sub_type: form.sub_type, description: form.description, currency: form.currency };
        if (form.balance !== undefined) update.balance = parseFloat(form.balance) || 0;
        await api.put(`/api/accounts/${editingAcc.account_id}`, update);
      } else {
        await api.post('/api/accounts', { ...form, opening_balance: parseFloat(form.opening_balance) || 0 });
      }
      setShowForm(false);
      setEditingAcc(null);
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
      <div className="action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Accounts</h1>
          <p className="mono page-subtitle" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Manage your financial accounts</p>
        </div>
        <button data-testid="add-account-btn" onClick={openCreate} style={{
          background: 'var(--brand-primary)', color: '#fff', border: 'none',
          padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Plus size={14} weight="bold" /> Add Account
        </button>
      </div>

      {/* Add/Edit Account Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => { setShowForm(false); setEditingAcc(null); }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'relative', background: '#fff', borderRadius: 2, width: '100%', maxWidth: 520,
            maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>{editingAcc ? 'Edit Account' : 'New Account'}</h2>
              <button onClick={() => { setShowForm(false); setEditingAcc(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '24px 28px' }}>
              <form onSubmit={handleSubmit}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>Account Name *</label>
                    <input data-testid="account-name-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      style={inputStyle} placeholder="e.g., HDFC Savings" />
                  </div>
                  <div>
                    <label style={labelStyle}>Type *</label>
                    <select data-testid="account-type-select" value={form.account_type}
                      onChange={e => setForm(f => ({ ...f, account_type: e.target.value, sub_type: subTypes[e.target.value]?.[0] || '' }))}
                      style={inputStyle} disabled={!!editingAcc}>
                      {accountTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Sub Type</label>
                    <select data-testid="account-subtype-select" value={form.sub_type}
                      onChange={e => setForm(f => ({ ...f, sub_type: e.target.value }))}
                      style={inputStyle}>
                      {(subTypes[form.account_type] || []).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  {editingAcc ? (
                    <div>
                      <label style={labelStyle}>Current Balance *</label>
                      <input data-testid="account-balance-input" type="number" step="0.01"
                        value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                        style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="0" />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        Opening: {formatCurrency(editingAcc.opening_balance || 0)}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <label style={labelStyle}>Opening Balance *</label>
                      <input data-testid="account-balance-input" type="number" step="0.01"
                        value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
                        style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="0.00" />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        Enter the current balance of this account
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Description</label>
                  <input data-testid="account-desc-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={inputStyle} placeholder="Optional description" />
                </div>
                {error && <p data-testid="account-error" style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button data-testid="save-account-btn" type="submit" style={{
                    background: 'var(--brand-primary)', color: '#fff', border: 'none',
                    padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)'
                  }}>{editingAcc ? 'Update Account' : 'Save Account'}</button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingAcc(null); }} style={{
                    background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                    padding: '10px 24px', borderRadius: 2, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)'
                  }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Accounts List */}
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-muted)' }}>Loading accounts...</div>
      ) : (
        <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
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
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button data-testid={`edit-account-${acc.account_id}`} onClick={() => openEdit(acc)} style={{
                      background: 'rgba(74,110,125,0.1)', border: 'none', cursor: 'pointer', color: 'var(--info)', padding: 6, borderRadius: 2
                    }}>
                      <PencilSimple size={14} />
                    </button>
                    <button data-testid={`delete-account-${acc.account_id}`} onClick={() => handleDelete(acc.account_id)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6
                    }}>
                      <Trash size={14} />
                    </button>
                  </div>
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
                {acc.opening_balance !== acc.balance && (
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Opening: {formatCurrency(acc.opening_balance || 0)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
