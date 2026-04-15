import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import { Plus, Trash, PencilSimple, Bank, Wallet, CreditCard, X, Gear, Tag, Check, Warning } from '@phosphor-icons/react';

const accountTypes = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
];

const typeIcons = { bank: Bank, cash: Wallet, wallet: Wallet, credit_card: CreditCard };

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)',
  borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)',
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };
// ─── Sub-type Management Modal ──────────────────────────────────────
function SubTypeManager({ subTypesMap, onClose, onRefresh }) {
  const [activeTab, setActiveTab] = useState('asset');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('asset');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => subTypesMap[activeTab] || [], [subTypesMap, activeTab]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true); setError('');
    try {
      await api.post('/api/account-sub-types', { name: newName.trim(), account_type: newType });
      setNewName(''); setCreating(false);
      onRefresh();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    setBusy(true); setError('');
    try {
      await api.put(`/api/account-sub-types/${id}`, { name: editName.trim() });
      setEditingId(null); setEditName('');
      onRefresh();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete sub-type "${name}"? This cannot be undone.`)) return;
    setBusy(true); setError('');
    try {
      await api.del(`/api/account-sub-types/${id}`);
      onRefresh();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const startEdit = (item) => {
    setEditingId(item.sub_type_id);
    setEditName(item.name);
    setError('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div data-testid="subtype-manager-modal" style={{
        position: 'relative', background: '#fff', borderRadius: 2, width: '100%', maxWidth: 600,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 8px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Tag size={20} weight="duotone" style={{ color: 'var(--accent-1)' }} />
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Manage Sub-types</h2>
          </div>
          <button data-testid="close-subtype-manager" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 28px' }}>
          {accountTypes.map(t => (
            <button key={t.value} data-testid={`subtype-tab-${t.value}`}
              onClick={() => { setActiveTab(t.value); setCreating(false); setEditingId(null); setError(''); }}
              style={{
                background: 'none', border: 'none', borderBottom: activeTab === t.value ? '2px solid var(--brand-primary)' : '2px solid transparent',
                padding: '12px 20px', fontSize: 13, fontWeight: activeTab === t.value ? 600 : 400,
                color: activeTab === t.value ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s ease',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 28px' }}>
          {error && (
            <div data-testid="subtype-error" style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 16,
              background: 'rgba(150,69,58,0.08)', border: '1px solid rgba(150,69,58,0.2)', borderRadius: 2,
              fontSize: 13, color: 'var(--error)',
            }}>
              <Warning size={14} weight="bold" /> {error}
            </div>
          )}

          {/* Sub-type list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(item => (
              <div key={item.sub_type_id} data-testid={`subtype-item-${item.sub_type_id}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', border: '1px solid var(--border-subtle)', borderRadius: 2,
                  background: item.is_default ? 'var(--bg-secondary)' : '#fff',
                }}>
                {editingId === item.sub_type_id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <input data-testid="subtype-edit-input" autoFocus value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(item.sub_type_id); if (e.key === 'Escape') setEditingId(null); }}
                      style={{ ...inputStyle, padding: '6px 10px', fontSize: 13, flex: 1 }} />
                    <button data-testid="subtype-edit-save" onClick={() => handleUpdate(item.sub_type_id)} disabled={busy}
                      style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '6px 8px', borderRadius: 2, cursor: 'pointer' }}>
                      <Check size={14} weight="bold" />
                    </button>
                    <button data-testid="subtype-edit-cancel" onClick={() => setEditingId(null)}
                      style={{ background: 'none', border: '1px solid var(--border-strong)', padding: '6px 8px', borderRadius: 2, cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</span>
                      {item.is_default && (
                        <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 2 }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    {!item.is_default && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button data-testid={`subtype-edit-${item.sub_type_id}`} onClick={() => startEdit(item)}
                          style={{ background: 'rgba(74,110,125,0.1)', border: 'none', cursor: 'pointer', color: 'var(--info)', padding: 5, borderRadius: 2 }}>
                          <PencilSimple size={13} />
                        </button>
                        <button data-testid={`subtype-delete-${item.sub_type_id}`} onClick={() => handleDelete(item.sub_type_id, item.name)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 5 }}>
                          <Trash size={13} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {items.length === 0 && (
              <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No sub-types for this category</p>
            )}
          </div>

          {/* Add new sub-type */}
          {creating ? (
            <div data-testid="subtype-create-form" style={{
              marginTop: 16, padding: 16, border: '1px dashed var(--accent-1)', borderRadius: 2, background: 'rgba(194,109,92,0.04)',
            }}>
              <label style={labelStyle}>New Sub-type Name</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input data-testid="subtype-create-input" autoFocus value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setError(''); } }}
                  style={{ ...inputStyle, flex: 1, padding: '8px 12px', fontSize: 13 }}
                  placeholder={`e.g., ${activeTab === 'asset' ? 'Mutual Fund' : activeTab === 'liability' ? 'BNPL' : 'Drawings'}`} />
                <button data-testid="subtype-create-save" onClick={handleCreate} disabled={busy || !newName.trim()}
                  style={{
                    background: 'var(--brand-primary)', color: '#fff', border: 'none',
                    padding: '8px 16px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                    cursor: newName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-body)',
                    opacity: newName.trim() ? 1 : 0.5,
                  }}>Save</button>
                <button onClick={() => { setCreating(false); setError(''); }}
                  style={{ background: 'none', border: '1px solid var(--border-strong)', padding: '8px 12px', borderRadius: 2, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
                  Cancel</button>
              </div>
              <p className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                This will be added as a <strong style={{ color: 'var(--text-secondary)' }}>{activeTab}</strong> sub-type
              </p>
            </div>
          ) : (
            <button data-testid="subtype-add-btn" onClick={() => { setCreating(true); setNewName(''); setNewType(activeTab); setError(''); }}
              style={{
                marginTop: 16, width: '100%', background: 'none', border: '1px dashed var(--border-strong)',
                padding: '12px', borderRadius: 2, fontSize: 13, color: 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-1)'; e.currentTarget.style.color = 'var(--accent-1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
              <Plus size={14} weight="bold" /> Add Custom Sub-type
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Main Accounts Page ─────────────────────────────────────────────
export default function Accounts() {
  const [accounts, setAccounts] = useState(() => getCached('accounts') || []);
  const [loading, setLoading] = useState(!getCached('accounts'));
  const [showForm, setShowForm] = useState(false);
  const [showSubTypeManager, setShowSubTypeManager] = useState(false);
  const [editingAcc, setEditingAcc] = useState(null);
  const [form, setForm] = useState({ name: '', account_type: 'asset', sub_type: '', account_number: '', opening_balance: '', balance_as_of_date: new Date().toISOString().split('T')[0], currency: 'INR', description: '' });
  const [error, setError] = useState('');
  const [subTypesMap, setSubTypesMap] = useState(() => getCached('account_sub_types') || { asset: [], liability: [], equity: [] });

  const loadAccounts = useCallback(() => {
    api.get('/api/accounts').then(data => { setAccounts(data); setCache('accounts', data); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadSubTypes = useCallback(() => {
    api.get('/api/account-sub-types').then(data => { setSubTypesMap(data); setCache('account_sub_types', data); }).catch(() => {});
  }, []);

  useEffect(() => { loadAccounts(); loadSubTypes(); }, [loadAccounts, loadSubTypes]);

  // Get sub-type options for a given account type
  const getSubTypeOptions = useCallback((accType) => {
    return (subTypesMap[accType] || []).map(st => ({ value: st.name.toLowerCase().replace(/\s+/g, '_'), label: st.name }));
  }, [subTypesMap]);

  const openCreate = () => {
    setEditingAcc(null);
    const firstSubType = getSubTypeOptions('asset')[0]?.value || '';
    setForm({ name: '', account_type: 'asset', sub_type: firstSubType, account_number: '', opening_balance: '', balance_as_of_date: new Date().toISOString().split('T')[0], currency: 'INR', description: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (acc) => {
    setEditingAcc(acc);
    setForm({
      name: acc.name,
      account_type: acc.account_type,
      sub_type: acc.sub_type || '',
      account_number: acc.account_number || '',
      opening_balance: acc.opening_balance || 0,
      balance_as_of_date: acc.balance_as_of_date || '',
      balance: acc.balance || 0,
      currency: acc.currency || 'INR',
      description: acc.description || '',
    });
    setShowForm(true);
    setError('');
  };

  const handleTypeChange = (newType) => {
    const options = getSubTypeOptions(newType);
    setForm(f => ({ ...f, account_type: newType, sub_type: options[0]?.value || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Account name is required'); return; }
    if (form.opening_balance === '' && !editingAcc) { setError('Opening balance is required'); return; }

    try {
      if (editingAcc) {
        const update = { name: form.name, sub_type: form.sub_type, account_number: form.account_number, description: form.description, currency: form.currency };
        if (form.opening_balance !== undefined) update.opening_balance = parseFloat(form.opening_balance) || 0;
        if (form.balance_as_of_date) update.balance_as_of_date = form.balance_as_of_date;
        await api.put(`/api/accounts/${editingAcc.account_id}`, update);
      } else {
        await api.post('/api/accounts', { ...form, opening_balance: parseFloat(form.opening_balance) || 0 });
      }
      setShowForm(false);
      setEditingAcc(null);
      loadAccounts();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this account?')) return;
    try {
      await api.del(`/api/accounts/${id}`);
      loadAccounts();
    } catch (err) { alert(err.message); }
  };

  // Count custom sub-types
  const customCount = useMemo(() => {
    return Object.values(subTypesMap).flat().filter(st => !st.is_default).length;
  }, [subTypesMap]);

  // Accounts missing balance_as_of_date
  const accountsMissingDate = useMemo(() => {
    return accounts.filter(acc => !acc.balance_as_of_date);
  }, [accounts]);

  return (
    <div data-testid="accounts-page">
      <div className="action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Accounts</h1>
          <p className="mono page-subtitle" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Manage your financial accounts</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button data-testid="manage-subtypes-btn" onClick={() => setShowSubTypeManager(true)} style={{
            background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)',
            padding: '10px 16px', borderRadius: 2, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
            <Gear size={14} weight="bold" /> Sub-types
            {customCount > 0 && (
              <span style={{
                background: 'var(--accent-1)', color: '#fff', fontSize: 10, fontWeight: 700,
                padding: '1px 6px', borderRadius: 10, marginLeft: 2,
              }}>{customCount}</span>
            )}
          </button>
          <button data-testid="add-account-btn" onClick={openCreate} style={{
            background: 'var(--brand-primary)', color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <Plus size={14} weight="bold" /> Add Account
          </button>
        </div>
      </div>

      {/* Sub-type Manager Modal */}
      {showSubTypeManager && (
        <SubTypeManager
          subTypesMap={subTypesMap}
          onClose={() => setShowSubTypeManager(false)}
          onRefresh={loadSubTypes}
        />
      )}

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
                    <label style={labelStyle}>Account Number</label>
                    <input data-testid="account-number-input" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                      style={inputStyle} placeholder="e.g., XX1234 (optional)" />
                  </div>
                  <div>
                    <label style={labelStyle}>Type *</label>
                    <select data-testid="account-type-select" value={form.account_type}
                      onChange={e => handleTypeChange(e.target.value)}
                      style={inputStyle} disabled={!!editingAcc}>
                      {accountTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Sub Type</label>
                    <select data-testid="account-subtype-select" value={form.sub_type}
                      onChange={e => setForm(f => ({ ...f, sub_type: e.target.value }))}
                      style={inputStyle}>
                      {getSubTypeOptions(form.account_type).map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  {editingAcc ? (
                    <>
                      <div>
                        <label style={labelStyle}>Opening Balance *</label>
                        <input data-testid="account-balance-input" type="number" step="0.01"
                          value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="0" />
                      </div>
                      <div>
                        <label style={labelStyle}>Balance as of (end of day)</label>
                        <input data-testid="account-balance-date" type="date"
                          value={form.balance_as_of_date} onChange={e => setForm(f => ({ ...f, balance_as_of_date: e.target.value }))}
                          style={inputStyle} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                          Transactions after this date adjust the balance
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={labelStyle}>Opening Balance *</label>
                        <input data-testid="account-balance-input" type="number" step="0.01"
                          value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="0.00" />
                      </div>
                      <div>
                        <label style={labelStyle}>Balance as of (end of day)</label>
                        <input data-testid="account-balance-date" type="date"
                          value={form.balance_as_of_date} onChange={e => setForm(f => ({ ...f, balance_as_of_date: e.target.value }))}
                          style={inputStyle} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                          Closing balance on this date
                        </span>
                      </div>
                    </>
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

      {/* Balance Date Missing Banner */}
      {!loading && accountsMissingDate.length > 0 && (
        <div data-testid="balance-date-banner" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', marginBottom: 20,
          background: 'rgba(194,140,60,0.08)', border: '1px solid rgba(194,140,60,0.25)', borderRadius: 2,
          fontSize: 13, color: 'var(--warning)',
        }}>
          <Warning size={16} weight="bold" style={{ flexShrink: 0 }} />
          <span>
            <strong>{accountsMissingDate.length} account{accountsMissingDate.length > 1 ? 's' : ''}</strong> missing a balance date.
            Edit {accountsMissingDate.length > 1 ? 'them' : 'it'} to set the date your opening balance was recorded — this ensures accurate balance calculations.
          </span>
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
                background: '#fff', border: !acc.balance_as_of_date ? '1px solid rgba(194,140,60,0.35)' : '1px solid var(--border-subtle)',
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
                {acc.account_number && (
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    A/c: {acc.account_number}
                  </span>
                )}
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
                    {acc.balance_as_of_date && <span> (as of {acc.balance_as_of_date})</span>}
                  </div>
                )}
                {!acc.balance_as_of_date && (
                  <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 6, cursor: 'pointer' }} onClick={() => openEdit(acc)}>
                    Set balance date
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
