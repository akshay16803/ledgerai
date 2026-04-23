import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import { s, getCurrentLanguage } from '../lib/localization';
import { Plus, Trash, PencilSimple, Bank, Wallet, CreditCard, X, Gear, Tag, Check, Warning, CaretRight, CaretDown, CalendarBlank, CurrencyCircleDollar, SpinnerGap, ChartLineUp, UploadSimple, PencilLine, FileText, Robot } from '@phosphor-icons/react';

const accountTypes = [
  { value: 'asset', label: s('asset') },
  { value: 'liability', label: s('liability') },
  { value: 'equity', label: 'Equity' },
  { value: 'investment', label: 'Investment' },
];

const typeIcons = { bank: Bank, cash: Wallet, wallet: Wallet, credit_card: CreditCard, demat: ChartLineUp, chart_line: ChartLineUp };

function formatCurrency(amount) {
  if (Math.abs(amount) >= 1_00_00_000) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(amount);
  }
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
    finally { setBusy(false); }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    setBusy(true); setError('');
    try {
      await api.put(`/api/account-sub-types/${id}`, { name: editName.trim() });
      setEditingId(null); setEditName('');
      onRefresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete sub-type "${name}"? This cannot be undone.`)) return;
    setBusy(true); setError('');
    try {
      await api.del(`/api/account-sub-types/${id}`);
      onRefresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
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
                    <button data-testid="subtype-edit-save" data-guard onClick={() => handleUpdate(item.sub_type_id)} disabled={busy}
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
                        <button data-testid={`subtype-delete-${item.sub_type_id}`} data-guard onClick={() => handleDelete(item.sub_type_id, item.name)}
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
                <button data-testid="subtype-create-save" data-guard onClick={handleCreate} disabled={busy || !newName.trim()}
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


// ─── Amortization Schedule Modal ────────────────────────────────────
function AmortizationModal({ accountId, accountName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/accounts/${accountId}/amortization`)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [accountId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div data-testid="amortization-modal" style={{
        position: 'relative', background: '#fff', borderRadius: 2, width: '100%', maxWidth: 720,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Loan Schedule</h2>
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{accountName}</p>
          </div>
          <button data-testid="close-amortization" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 28px' }}>
          {loading ? (
            <div className="mono" style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Loading schedule...</div>
          ) : error ? (
            <div style={{ color: 'var(--error)', fontSize: 13, padding: 20, textAlign: 'center' }}>{error}</div>
          ) : data ? (
            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Loan Amount', value: formatCurrency(data.outstanding_balance), color: 'var(--text-primary)' },
                  { label: 'Interest Rate', value: `${data.interest_rate}% p.a.`, color: 'var(--info)' },
                  { label: 'Monthly EMI', value: formatCurrency(data.emi_amount), color: 'var(--accent-1)' },
                  { label: 'Total Interest', value: formatCurrency(data.total_interest), color: 'var(--warning)' },
                  { label: 'EMIs Paid', value: `${data.payments_made} / ${data.tenure_months}`, color: 'var(--success)' },
                  { label: 'EMI Day / Remaining', value: `${data.emi_day || '-'}th · ${data.months_remaining}mo left`, color: 'var(--text-secondary)' },
                ].map(c => (
                  <div key={c.label} style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 2 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* Schedule table */}
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
                    {data.schedule.map((row, i) => {
                      const isPaid = i < data.payments_made;
                      return (
                        <tr key={row.month} data-testid={`amort-row-${row.month}`} style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: isPaid ? 'rgba(58,92,74,0.04)' : 'transparent',
                          opacity: isPaid ? 0.7 : 1,
                        }}>
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
      </div>
    </div>
  );
}


// ─── Grouped Accounts List ──────────────────────────────────────────
function AccountsGroupedList({ accounts, onEdit, onDelete, expandedSubTypes, toggleSubType, onViewSchedule, onCalcInterest, onUploadStatement, onManualEntry, onViewDetail }) {
  // Group accounts: account_type → sub_type → accounts[]
  const grouped = useMemo(() => {
    const map = {};
    for (const acc of accounts) {
      const type = acc.account_type || 'asset';
      const sub = acc.sub_type || 'general';
      if (!map[type]) map[type] = {};
      if (!map[type][sub]) map[type][sub] = [];
      map[type][sub].push(acc);
    }
    return map;
  }, [accounts]);

  const typeOrder = ['asset', 'investment', 'liability', 'equity'];
  const typeLabels = { asset: 'Assets', investment: 'Investments', liability: 'Liabilities', equity: 'Equity' };

  return (
    <div data-testid="accounts-grouped-list" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {typeOrder.map(type => {
        const subTypes = grouped[type];
        if (!subTypes || Object.keys(subTypes).length === 0) return null;

        // Total for this account type
        const typeTotal = Object.values(subTypes).flat().reduce((sum, a) => sum + (a.balance || 0), 0);

        return (
          <div key={type} data-testid={`account-type-${type}`}>
            {/* Account Type Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', marginBottom: 4, borderBottom: '2px solid var(--border-strong)',
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, textTransform: 'capitalize', letterSpacing: '-0.01em' }}>
                {typeLabels[type] || type}
              </h2>
              <span className="mono" style={{ fontSize: 'clamp(12px, 1.5vw, 16px)', fontWeight: 600, color: typeTotal >= 0 ? 'var(--success)' : 'var(--error)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '50%', textAlign: 'right' }}>
                {formatCurrency(typeTotal)}
              </span>
            </div>

            {/* Sub-type Rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {Object.entries(subTypes).sort((a, b) => a[0].localeCompare(b[0])).map(([subType, accs]) => {
                const key = `${type}_${subType}`;
                const isExpanded = !!expandedSubTypes[key];
                const subTotal = accs.reduce((sum, a) => sum + (a.balance || 0), 0);
                const Icon = typeIcons[subType] || Bank;

                return (
                  <div key={key} data-testid={`subtype-group-${key}`}>
                    {/* Sub-type header row — clickable to expand */}
                    <button data-testid={`subtype-toggle-${key}`}
                      onClick={() => toggleSubType(key)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', background: isExpanded ? 'var(--bg-secondary)' : '#fff',
                        border: 'none', borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = '#fff'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {isExpanded ? <CaretDown size={14} weight="bold" style={{ color: 'var(--text-muted)' }} /> : <CaretRight size={14} weight="bold" style={{ color: 'var(--text-muted)' }} />}
                        <Icon size={18} weight="duotone" style={{ color: 'var(--accent-1)' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>
                          {subType.replace(/_/g, ' ')}
                        </span>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                          {accs.length} account{accs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="mono" style={{ fontSize: 'clamp(11px, 1.5vw, 15px)', fontWeight: 600, color: subTotal >= 0 ? 'var(--success)' : 'var(--error)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '50%', textAlign: 'right' }}>
                        {formatCurrency(subTotal)}
                      </span>
                    </button>

                    {/* Expanded account list */}
                    {isExpanded && (
                      <div data-testid={`subtype-accounts-${key}`} style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: 'var(--bg-primary)',
                      }}>
                        {accs.map(acc => (
                          <div key={acc.account_id} data-testid={`account-row-${acc.account_id}`} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px 12px 52px',
                            borderTop: '1px solid var(--border-subtle)',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,54,45,0.02)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span
                                  onClick={(e) => { e.stopPropagation(); if (typeof onViewDetail === 'function') onViewDetail(acc); }}
                                  style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', color: 'var(--text-primary)', transition: 'color 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-primary)'; e.currentTarget.style.textDecoration = 'underline'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.textDecoration = 'none'; }}
                                >{acc.name}</span>
                                {acc.ai_created === true && (
                                  <span title="Created by AI" style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    fontSize: 10, fontWeight: 700, color: 'var(--brand-primary)',
                                    background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)',
                                    borderRadius: 10, padding: '2px 7px', flexShrink: 0, lineHeight: 1,
                                  }}>
                                    <Robot size={10} weight="fill" /> AI
                                  </span>
                                )}
                                {acc.account_number && (
                                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                                    {acc.account_number}
                                  </span>
                                )}
                                {!acc.balance_as_of_date && (
                                  <span style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 600, flexShrink: 0 }}>
                                    No date set
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {acc.balance_as_of_date && (
                                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                    Opening: {formatCurrency(acc.opening_balance || 0)} as of {acc.balance_as_of_date}
                                  </span>
                                )}
                                {(acc.sub_type === 'loan' || acc.sub_type === 'mortgage') && acc.loan_emi_amount && (
                                  <span className="mono" style={{ fontSize: 10, color: 'var(--accent-1)' }}>
                                    EMI: {formatCurrency(acc.loan_emi_amount)} &middot; {acc.loan_interest_rate}% &middot; {acc.loan_tenure_months}mo{acc.loan_emi_day ? ` · ${acc.loan_emi_day}th` : ''}
                                  </span>
                                )}
                                {(acc.sub_type === 'loan' || acc.sub_type === 'mortgage') && !acc.loan_emi_amount && (
                                  <span data-testid={`loan-prompt-${acc.account_id}`}
                                    onClick={() => onEdit(acc)}
                                    style={{ fontSize: 10, color: 'var(--info)', cursor: 'pointer', fontWeight: 500 }}>
                                    Add loan details for EMI tracking
                                  </span>
                                )}
                                {acc.sub_type === 'overdraft' && (
                                  <span className="mono" style={{ fontSize: 10, color: 'var(--accent-1)' }}>
                                    Limit: {formatCurrency(acc.loan_sanctioned_amount || 0)}
                                    {acc.loan_interest_rate ? ` · ${acc.loan_interest_rate}% p.a.` : ' · Manual mode'}
                                    {acc.loan_emi_day ? ` · Charge day: ${acc.loan_emi_day}` : ''}
                                    {acc.loan_sanctioned_amount ? ` · Avail: ${formatCurrency((acc.loan_sanctioned_amount || 0) - (acc.balance || 0))}` : ''}
                                  </span>
                                )}
                                {acc.sub_type === 'demat' && (
                                  <span className="mono" style={{ fontSize: 10, color: 'var(--accent-1)' }}>
                                    {acc.broker_name ? `${acc.broker_name}` : 'Demat'}
                                    {' · '}P&L tracked via statement upload or manual entry
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {(acc.sub_type === 'loan' || acc.sub_type === 'mortgage') && acc.loan_emi_amount && (
                                <button data-testid={`view-schedule-${acc.account_id}`}
                                  onClick={() => onViewSchedule(acc)}
                                  style={{
                                    background: 'none', border: '1px solid var(--border-strong)', padding: '3px 10px',
                                    borderRadius: 2, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                    fontFamily: 'var(--font-body)', color: 'var(--text-secondary)',
                                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                                    transition: 'background 0.1s',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                >
                                  <CalendarBlank size={11} /> Schedule
                                </button>
                              )}
                              {acc.sub_type === 'overdraft' && acc.loan_interest_rate && (
                                <button data-testid={`calc-interest-${acc.account_id}`}
                                  onClick={(e) => { e.stopPropagation(); onCalcInterest(acc); }}
                                  style={{
                                    background: 'none', border: '1px solid var(--border-strong)', padding: '3px 10px',
                                    borderRadius: 2, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                    fontFamily: 'var(--font-body)', color: 'var(--text-secondary)',
                                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                                    transition: 'background 0.1s',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                >
                                  <CurrencyCircleDollar size={11} /> Calc Interest
                                </button>
                              )}
                              {acc.sub_type === 'demat' && (
                                <>
                                  <button data-testid={`upload-statement-${acc.account_id}`}
                                    onClick={(e) => { e.stopPropagation(); if (typeof onUploadStatement === 'function') onUploadStatement(acc); }}
                                    style={{
                                      background: 'none', border: '1px solid var(--border-strong)', padding: '3px 10px',
                                      borderRadius: 2, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                      fontFamily: 'var(--font-body)', color: 'var(--text-secondary)',
                                      display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                                      transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                  >
                                    <UploadSimple size={11} /> Upload Statement
                                  </button>
                                  <button data-testid={`manual-entry-${acc.account_id}`}
                                    onClick={(e) => { e.stopPropagation(); if (typeof onManualEntry === 'function') onManualEntry(acc); }}
                                    style={{
                                      background: 'none', border: '1px solid var(--border-strong)', padding: '3px 10px',
                                      borderRadius: 2, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                                      fontFamily: 'var(--font-body)', color: 'var(--text-secondary)',
                                      display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                                      transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                  >
                                    <PencilLine size={11} /> Manual Entry
                                  </button>
                                </>
                              )}
                              <span className="mono" style={{ fontSize: 'clamp(11px, 1.5vw, 14px)', fontWeight: 600, color: acc.balance >= 0 ? 'var(--success)' : 'var(--error)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%', textAlign: 'right' }}>
                                {formatCurrency(acc.balance)}
                              </span>
                              <div style={{ display: 'flex', gap: 2 }}>
                                <button data-testid={`edit-account-${acc.account_id}`} onClick={() => onEdit(acc)} style={{
                                  background: 'rgba(74,110,125,0.1)', border: 'none', cursor: 'pointer', color: 'var(--info)', padding: 5, borderRadius: 2
                                }}>
                                  <PencilSimple size={13} />
                                </button>
                                <button data-testid={`delete-account-${acc.account_id}`} data-guard onClick={() => onDelete(acc.account_id)} style={{
                                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 5
                                }}>
                                  <Trash size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ─── OD Interest Calculator Modal ─────────────────────────────────
function ODInterestModal({ account, onClose }) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const calculate = async () => {
    setLoading(true); setError(''); setData(null); setSaved(false);
    try {
      const res = await api.get(`/api/accounts/${account.account_id}/od-interest?month=${month}`);
      setData(res);
      setEditAmount(String(res.total_interest));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const saveInterest = async () => {
    if (saving) return;
    const amt = parseFloat(editAmount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    setSaving(true); setError('');
    try {
      // Last day of the selected month
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const txnDate = `${month}-${String(lastDay).padStart(2, '0')}`;
      await api.post(`/api/accounts/${account.account_id}/od-interest`, {
        amount: amt, date: txnDate, month,
        description: `OD Interest — ${month}`,
      });
      setSaved(true);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div data-testid="od-interest-modal" style={{
        position: 'relative', background: '#fff', borderRadius: 2, width: '100%', maxWidth: 620,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 8px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Calculate OD Interest</h2>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {account.name} · {account.loan_interest_rate}% p.a.
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {/* Instructions */}
          <div style={{
            padding: '12px 16px', background: 'rgba(74,110,125,0.06)', borderRadius: 2,
            marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            Interest is calculated daily on your outstanding balance. Each time you withdraw or repay,
            the outstanding changes — and interest adjusts accordingly. The total shown below is the sum
            of daily interest for the selected month. You can edit the amount to match your bank's figure
            before saving.
          </div>

          {/* Month Picker + Calculate */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Month</label>
              <input data-testid="od-month-input" type="month" value={month}
                onChange={e => { setMonth(e.target.value); setData(null); setSaved(false); }}
                style={{ padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)' }} />
            </div>
            <button data-testid="od-calc-btn" onClick={calculate} disabled={loading}
              style={{
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {loading ? <><SpinnerGap size={14} className="spin" /> Calculating...</> : 'Calculate'}
            </button>
          </div>

          {error && (
            <div style={{ background: 'rgba(150,69,58,0.1)', border: '1px solid var(--error)', borderRadius: 2, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: 'var(--error)' }}>
              {error}
            </div>
          )}

          {/* Results */}
          {data && (
            <>
              {/* Summary strip */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20,
              }}>
                <div style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 2, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Opening Outstanding</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(data.daily_breakdown[0]?.outstanding || 0)}</div>
                </div>
                <div style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 2, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Closing Outstanding</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(data.closing_outstanding)}</div>
                </div>
                <div style={{ padding: '14px 16px', background: 'rgba(150,69,58,0.06)', borderRadius: 2, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Total Interest</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--error)' }}>{formatCurrency(data.total_interest)}</div>
                </div>
              </div>

              {/* Daily breakdown (scrollable) */}
              <details style={{ marginBottom: 20 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Day-by-day breakdown ({data.daily_breakdown.length} days)
                </summary>
                <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Outstanding</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Interest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.daily_breakdown.map(d => (
                        <tr key={d.date} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td className="mono" style={{ padding: '6px 12px' }}>{d.date}</td>
                          <td className="mono" style={{ padding: '6px 12px', textAlign: 'right' }}>{formatCurrency(d.outstanding)}</td>
                          <td className="mono" style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--error)' }}>{formatCurrency(d.interest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              {/* Editable amount + Save */}
              {!saved ? (
                <div style={{ padding: '16px 18px', background: 'var(--bg-secondary)', borderRadius: 2, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                        Interest Amount (editable)
                      </label>
                      <input data-testid="od-interest-amount" type="number" step="0.01"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 600 }} />
                    </div>
                    <button data-testid="od-save-interest-btn" onClick={saveInterest} disabled={saving}
                      style={{
                        background: saving ? 'var(--text-muted)' : 'var(--success)', color: '#fff', border: 'none',
                        padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                        opacity: saving ? 0.7 : 1, whiteSpace: 'nowrap',
                      }}>
                      {saving ? 'Saving...' : 'Add as Interest Entry'}
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Edit the amount if your bank's figure differs, then save. This creates an expense
                    transaction on your OD account for the last day of the month, increasing the outstanding balance.
                  </p>
                </div>
              ) : (
                <div style={{ padding: '16px 18px', background: 'rgba(58,92,74,0.06)', borderRadius: 2, border: '1px solid var(--success)', textAlign: 'center' }}>
                  <Check size={20} weight="bold" style={{ color: 'var(--success)', marginBottom: 4 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>Interest entry saved!</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {formatCurrency(parseFloat(editAmount))} added as an expense on your OD account. Your outstanding balance has been updated.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`.spin { animation: spin-anim 1s linear infinite; } @keyframes spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}


// ─── Demat Upload Statement Modal ───────────────────────────────────
function DematUploadModal({ account, onClose }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('account_id', account.account_id);
      const res = await fetch(`${window.__API_BASE || ''}/api/demat/upload-statement`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async () => {
    if (!result?.statement_id || approving) return;
    setApproving(true);
    setError('');
    try {
      await api.post(`/api/demat/approve-statement/${result.statement_id}`);
      setApproved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!result?.statement_id) return;
    try {
      await api.post(`/api/demat/reject-statement/${result.statement_id}`);
      setRejected(true);
    } catch (e) {
      setError(e.message);
    }
  };

  const ps = result?.parsed_summary || {};
  const pnl = ps.net_realized_pnl || 0;
  const charges = ps.charges || {};

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div data-testid="demat-upload-modal" style={{
        position: 'relative', background: '#fff', borderRadius: 2, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Upload Broker Statement</h2>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {account.name}{account.broker_name ? ` · ${account.broker_name}` : ''}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '24px 28px' }}>

          {/* ── Step 1: File picker ── */}
          {!result && !approved && !rejected && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                Upload your broker's contract note or trade report (PDF or CSV). AI will parse the trades and calculate your net P&L and charges.
              </p>
              <div style={{
                border: '2px dashed var(--border-strong)', borderRadius: 2, padding: '24px 16px',
                textAlign: 'center', marginBottom: 16, background: file ? 'rgba(58,92,74,0.04)' : 'transparent',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onClick={() => document.getElementById('demat-file-input')?.click()}
              >
                <input id="demat-file-input" type="file" accept=".pdf,.csv" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
                {file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <FileText size={20} style={{ color: 'var(--success)' }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{file.name}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ({(file.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                ) : (
                  <>
                    <UploadSimple size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click to select PDF or CSV</p>
                    <p className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Zerodha, Groww, Angel One, Upstox, etc.</p>
                  </>
                )}
              </div>
              {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button data-testid="demat-upload-btn" onClick={handleUpload} disabled={!file || uploading}
                  style={{
                    flex: 1, padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                    cursor: !file || uploading ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-body)', border: 'none',
                    background: 'var(--brand-primary)', color: '#fff',
                    opacity: !file || uploading ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {uploading && <SpinnerGap size={14} className="spin" />}
                  {uploading ? 'AI is parsing...' : 'Upload & Parse'}
                </button>
                <button onClick={onClose} style={{
                  padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                }}>Cancel</button>
              </div>
            </>
          )}

          {/* ── Step 2: Review & Approve ── */}
          {result && !approved && !rejected && (
            <div>
              {/* Header badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <Robot size={18} style={{ color: 'var(--accent-1)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-1)' }}>AI-Parsed Summary</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {file?.name}
                </span>
              </div>

              {/* Period */}
              {(result.period_from || result.period_to) && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, letterSpacing: '0.03em' }}>
                  Period: {result.period_from || '?'} to {result.period_to || '?'}
                </div>
              )}

              {/* Trade summary card */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '18px 20px', marginBottom: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', fontSize: 13 }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Trades</div>
                  <div className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{ps.num_trades || 'N/A'}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Total Buy Value</div>
                  <div className="mono" style={{ textAlign: 'right' }}>{formatCurrency(ps.total_buy_value || 0)}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Total Sell Value</div>
                  <div className="mono" style={{ textAlign: 'right' }}>{formatCurrency(ps.total_sell_value || 0)}</div>
                </div>
              </div>

              {/* Charges breakdown card */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '18px 20px', marginBottom: 14 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>Charges Breakdown</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: 12.5 }}>
                  {charges.brokerage > 0 && <><div style={{ color: 'var(--text-secondary)' }}>Brokerage</div><div className="mono" style={{ textAlign: 'right' }}>{formatCurrency(charges.brokerage)}</div></>}
                  {charges.stt > 0 && <><div style={{ color: 'var(--text-secondary)' }}>STT</div><div className="mono" style={{ textAlign: 'right' }}>{formatCurrency(charges.stt)}</div></>}
                  {charges.gst > 0 && <><div style={{ color: 'var(--text-secondary)' }}>GST</div><div className="mono" style={{ textAlign: 'right' }}>{formatCurrency(charges.gst)}</div></>}
                  {charges.exchange_fees > 0 && <><div style={{ color: 'var(--text-secondary)' }}>Exchange Fees</div><div className="mono" style={{ textAlign: 'right' }}>{formatCurrency(charges.exchange_fees)}</div></>}
                  {charges.dp_charges > 0 && <><div style={{ color: 'var(--text-secondary)' }}>DP Charges</div><div className="mono" style={{ textAlign: 'right' }}>{formatCurrency(charges.dp_charges)}</div></>}
                  {charges.stamp_duty > 0 && <><div style={{ color: 'var(--text-secondary)' }}>Stamp Duty</div><div className="mono" style={{ textAlign: 'right' }}>{formatCurrency(charges.stamp_duty)}</div></>}
                  {charges.other > 0 && <><div style={{ color: 'var(--text-secondary)' }}>Other</div><div className="mono" style={{ textAlign: 'right' }}>{formatCurrency(charges.other)}</div></>}
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginTop: 4 }}>Total Charges</div>
                  <div className="mono" style={{ textAlign: 'right', fontWeight: 600, borderTop: '1px solid var(--border-subtle)', paddingTop: 6, marginTop: 4 }}>{formatCurrency(charges.total || 0)}</div>
                </div>
              </div>

              {/* Net P&L highlight */}
              <div style={{
                background: pnl >= 0 ? 'rgba(58,92,74,0.08)' : 'rgba(194,109,92,0.08)',
                border: `1px solid ${pnl >= 0 ? 'var(--success)' : 'var(--error)'}`,
                borderRadius: 2, padding: '16px 20px', marginBottom: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Net Realized P&L</span>
                <span className="mono" style={{
                  fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em',
                  color: pnl >= 0 ? 'var(--success)' : 'var(--error)',
                }}>
                  {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                </span>
              </div>

              {/* What happens on approve */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6, padding: '0 2px' }}>
                {pnl !== 0 && charges.total > 0
                  ? `Approving will post ${pnl >= 0 ? 'a profit' : 'a loss'} of ${formatCurrency(Math.abs(pnl))} and charges of ${formatCurrency(charges.total)} to your ledger.`
                  : pnl !== 0
                  ? `Approving will post ${pnl >= 0 ? 'a profit' : 'a loss'} of ${formatCurrency(Math.abs(pnl))} to your ledger.`
                  : charges.total > 0
                  ? `Approving will post charges of ${formatCurrency(charges.total)} to your ledger.`
                  : 'No P&L or charges detected in this statement.'}
              </div>

              {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button data-testid="demat-approve-btn" onClick={handleApprove} disabled={approving || (pnl === 0 && (charges.total || 0) === 0)}
                  style={{
                    flex: 1, padding: '12px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                    cursor: approving ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-body)', border: 'none',
                    background: 'var(--success)', color: '#fff',
                    opacity: approving ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {approving ? <SpinnerGap size={14} className="spin" /> : <Check size={14} weight="bold" />}
                  {approving ? 'Posting...' : 'Approve & Post to Ledger'}
                </button>
                <button data-testid="demat-reject-btn" onClick={handleReject}
                  style={{
                    padding: '12px 20px', borderRadius: 2, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                    background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                  }}>Reject</button>
              </div>
            </div>
          )}

          {/* ── Step 3: Approved confirmation ── */}
          {approved && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: 'rgba(58,92,74,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <Check size={24} weight="bold" style={{ color: 'var(--success)' }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Posted to Ledger</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                {pnl !== 0 && <>{pnl >= 0 ? 'Profit' : 'Loss'} of <strong>{formatCurrency(Math.abs(pnl))}</strong></>}
                {pnl !== 0 && charges.total > 0 && ' and '}
                {charges.total > 0 && <>charges of <strong>{formatCurrency(charges.total)}</strong></>}
                {' '}recorded in your {account.name} account.
              </p>
              <button onClick={onClose} style={{
                padding: '10px 32px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
              }}>Done</button>
            </div>
          )}

          {/* ── Rejected confirmation ── */}
          {rejected && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Statement rejected. No transactions were created.
              </p>
              <button onClick={onClose} style={{
                padding: '10px 32px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
              }}>Close</button>
            </div>
          )}

        </div>
      </div>
      <style>{`.spin { animation: spin-anim 1s linear infinite; } @keyframes spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}


// ─── Demat Manual Entry Modal ───────────────────────────────────────
function DematManualEntryModal({ account, onClose }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    net_pnl: '',
    charges: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.net_pnl && !form.charges) { setError('Enter P&L amount or charges'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/api/demat/manual-entry', {
        account_id: account.account_id,
        date: form.date,
        net_pnl: parseFloat(form.net_pnl) || 0,
        charges: parseFloat(form.charges) || 0,
        description: form.description,
      });
      setSuccess(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div data-testid="demat-manual-modal" style={{
        position: 'relative', background: '#fff', borderRadius: 2, width: '100%', maxWidth: 460,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Manual Trading Entry</h2>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {account.name}{account.broker_name ? ` · ${account.broker_name}` : ''}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '24px 28px' }}>
          {!success ? (
            <form onSubmit={handleSubmit}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                Manually enter your trading P&L and charges. Positive P&L = profit (income), negative P&L = loss (expense).
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Date *</label>
                  <input data-testid="demat-manual-date" type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
                </div>
                <div>
                  <label style={labelStyle}>Net P&L (₹) *</label>
                  <input data-testid="demat-manual-pnl" type="number" step="0.01"
                    value={form.net_pnl}
                    onChange={e => setForm(f => ({ ...f, net_pnl: e.target.value }))}
                    style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                    placeholder="e.g., 5000 or -2000" />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Positive = profit, Negative = loss
                  </span>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Charges (₹)</label>
                <input data-testid="demat-manual-charges" type="number" step="0.01"
                  value={form.charges}
                  onChange={e => setForm(f => ({ ...f, charges: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                  placeholder="Brokerage + STT + GST etc. (optional)" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Description</label>
                <input data-testid="demat-manual-desc" type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={inputStyle}
                  placeholder="e.g., Nifty options expiry (optional)" />
              </div>
              {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button data-testid="demat-manual-submit" type="submit" disabled={saving}
                  style={{
                    flex: 1, padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-body)', border: 'none',
                    background: 'var(--brand-primary)', color: '#fff',
                    opacity: saving ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {saving && <SpinnerGap size={14} className="spin" />}
                  {saving ? 'Saving...' : 'Add Entry'}
                </button>
                <button type="button" onClick={onClose} style={{
                  padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                }}>Cancel</button>
              </div>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: 'rgba(58,92,74,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
              }}>
                <Check size={24} weight="bold" style={{ color: 'var(--success)' }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Posted to Ledger</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.5 }}>
                Your trading entry has been recorded directly in your {account.name} account.
              </p>
              <button onClick={onClose} style={{
                padding: '10px 32px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
              }}>Done</button>
            </div>
          )}
        </div>
      </div>
      <style>{`.spin { animation: spin-anim 1s linear infinite; } @keyframes spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}


// ─── Main Accounts Page ─────────────────────────────────────────────
export default function Accounts() {
  const navigate = useNavigate();
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);
  const [accounts, setAccounts] = useState(() => getCached('accounts') || []);
  const [loading, setLoading] = useState(!getCached('accounts'));
  const [showForm, setShowForm] = useState(false);
  const [showSubTypeManager, setShowSubTypeManager] = useState(false);
  const [editingAcc, setEditingAcc] = useState(null);
  const [form, setForm] = useState({ name: '', account_type: 'asset', sub_type: '', account_number: '', opening_balance: '', balance_as_of_date: new Date().toISOString().split('T')[0], currency: 'INR', description: '', loan_interest_rate: '', loan_tenure_months: '', loan_emi_amount: '', loan_emi_day: '', loan_sanctioned_amount: '', broker_name: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [subTypesMap, setSubTypesMap] = useState(() => getCached('account_sub_types') || { asset: [], liability: [], equity: [], investment: [] });

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
    setForm({ name: '', account_type: 'asset', sub_type: firstSubType, account_number: '', opening_balance: '', balance_as_of_date: new Date().toISOString().split('T')[0], currency: 'INR', description: '', loan_interest_rate: '', loan_tenure_months: '', loan_emi_amount: '', loan_emi_day: '', loan_sanctioned_amount: '', broker_name: '' });
    setShowForm(true);
    setError('');
    // Defensive: if a prior submit left `saving` stuck, a fresh open
    // should not inherit it — otherwise `handleSubmit`'s early-return
    // on `saving` would silently swallow the next click.
    setSaving(false);
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
      loan_interest_rate: acc.loan_interest_rate || '',
      loan_tenure_months: acc.loan_tenure_months || '',
      loan_emi_amount: acc.loan_emi_amount || '',
      loan_emi_day: acc.loan_emi_day || '',
      loan_sanctioned_amount: acc.loan_sanctioned_amount || '',
      broker_name: acc.broker_name || '',
    });
    setShowForm(true);
    setError('');
    setSaving(false);
  };

  // Auto-calculate outstanding balance from EMI, rate, and remaining
  // tenure when sanctioned amount is filled. Formula is present value
  // of remaining EMIs: PV = EMI × [(1 − (1+r)^(−n)) / r].
  // Called from onChange of rate/tenure/EMI/sanctioned fields.
  const autoCalcBalance = (formState) => {
    const emi = parseFloat(formState.loan_emi_amount);
    const rate = parseFloat(formState.loan_interest_rate);
    const months = parseInt(formState.loan_tenure_months);
    const sanctioned = parseFloat(formState.loan_sanctioned_amount);
    if (sanctioned > 0 && emi > 0 && rate > 0 && months > 0) {
      const r = rate / 12 / 100;
      formState.opening_balance = Math.round(emi * ((1 - Math.pow(1 + r, -months)) / r) * 100) / 100;
    }
    return formState;
  };

  const handleTypeChange = (newType) => {
    const options = getSubTypeOptions(newType);
    setForm(f => ({ ...f, account_type: newType, sub_type: options[0]?.value || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    if (!form.name.trim()) { setError('Account name is required'); return; }
    if (form.opening_balance === '' && !editingAcc) { setError('Opening balance is required'); return; }

    setSaving(true);
    try {
      // Build loan fields payload
      const loanFields = {};
      const isLoan = form.sub_type === 'loan' || form.sub_type === 'mortgage';
      const isOD = form.sub_type === 'overdraft';
      if (isLoan) {
        if (form.loan_interest_rate) loanFields.loan_interest_rate = parseFloat(form.loan_interest_rate);
        if (form.loan_tenure_months) loanFields.loan_tenure_months = parseInt(form.loan_tenure_months);
        if (form.loan_emi_amount) loanFields.loan_emi_amount = parseFloat(form.loan_emi_amount);
        if (form.loan_emi_day) loanFields.loan_emi_day = parseInt(form.loan_emi_day);
        if (form.loan_sanctioned_amount) loanFields.loan_sanctioned_amount = parseFloat(form.loan_sanctioned_amount);
      }
      if (isOD) {
        if (form.loan_interest_rate) loanFields.loan_interest_rate = parseFloat(form.loan_interest_rate);
        if (form.loan_sanctioned_amount) loanFields.loan_sanctioned_amount = parseFloat(form.loan_sanctioned_amount);
        if (form.loan_emi_day) loanFields.loan_emi_day = parseInt(form.loan_emi_day);
      }
      const isDemat = form.sub_type === 'demat';
      const dematFields = {};
      if (isDemat && form.broker_name) dematFields.broker_name = form.broker_name;

      if (editingAcc) {
        const update = { name: form.name, sub_type: form.sub_type, account_number: form.account_number, description: form.description, currency: form.currency, ...loanFields, ...dematFields };
        if (form.opening_balance !== undefined) update.opening_balance = parseFloat(form.opening_balance) || 0;
        if (form.balance_as_of_date) update.balance_as_of_date = form.balance_as_of_date;
        await api.put(`/api/accounts/${editingAcc.account_id}`, update);
      } else {
        // Build payload without empty loan fields to avoid validation errors
        const payload = {
          name: form.name,
          account_type: form.account_type,
          sub_type: form.sub_type,
          account_number: form.account_number,
          opening_balance: parseFloat(form.opening_balance) || 0,
          balance_as_of_date: form.balance_as_of_date,
          currency: form.currency,
          description: form.description,
          ...loanFields,
          ...dematFields,
        };
        await api.post('/api/accounts', payload);
      }
      setShowForm(false);
      setEditingAcc(null);
      loadAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      // Always clear `saving` — the `if (saving) return;` guard above
      // would otherwise swallow every subsequent click.
      setSaving(false);
    }
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

  // Expanded sub-type accordion state
  const [expandedSubTypes, setExpandedSubTypes] = useState({});
  const toggleSubType = useCallback((key) => {
    setExpandedSubTypes(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Amortization modal state
  const [amortAcc, setAmortAcc] = useState(null);

  // OD Interest modal state
  const [interestAcc, setInterestAcc] = useState(null);

  // Demat modals state
  const [uploadStatementAcc, setUploadStatementAcc] = useState(null);
  const [manualEntryAcc, setManualEntryAcc] = useState(null);

  return (
    <div data-testid="accounts-page">
      <div className="action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>{s('accounts')}</h1>
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
            <Plus size={14} weight="bold" /> {s('add_account')}
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
                  {(() => {
                    const isLoan = form.sub_type === 'loan' || form.sub_type === 'mortgage';
                    const isOD = form.sub_type === 'overdraft';
                    const loanAutoCalc = isLoan
                      && parseFloat(form.loan_sanctioned_amount) > 0
                      && parseFloat(form.loan_emi_amount) > 0
                      && parseFloat(form.loan_interest_rate) > 0
                      && parseInt(form.loan_tenure_months) > 0;
                    const balLabel = isOD ? 'Current Outstanding *' : isLoan ? 'Outstanding Balance *' : 'Opening Balance *';
                    const balStyle = {
                      ...inputStyle, fontFamily: 'var(--font-mono)',
                      ...(loanAutoCalc ? { borderColor: 'var(--success)', background: 'rgba(58,92,74,0.04)' } : {}),
                    };
                    return editingAcc ? (
                      <>
                        <div>
                          <label style={labelStyle}>{balLabel}</label>
                          <input data-testid="account-balance-input" type="number" step="0.01"
                            value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
                            style={balStyle} placeholder="0" />
                          {loanAutoCalc && <span className="mono" style={{ fontSize: 10, color: 'var(--success)', marginTop: 4, display: 'block' }}>Auto-calculated from loan details</span>}
                        </div>
                        <div>
                          <label style={labelStyle}>Balance as of (opening of day)</label>
                          <input data-testid="account-balance-date" type="date"
                            value={form.balance_as_of_date} onChange={e => setForm(f => ({ ...f, balance_as_of_date: e.target.value }))}
                            style={inputStyle} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                            Transactions from this date onward adjust the balance
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label style={labelStyle}>{balLabel}</label>
                          <input data-testid="account-balance-input" type="number" step="0.01"
                            value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
                            style={balStyle} placeholder="0.00" />
                          {loanAutoCalc && <span className="mono" style={{ fontSize: 10, color: 'var(--success)', marginTop: 4, display: 'block' }}>Auto-calculated from loan details</span>}
                        </div>
                        <div>
                          <label style={labelStyle}>Balance as of (opening of day)</label>
                          <input data-testid="account-balance-date" type="date"
                            value={form.balance_as_of_date} onChange={e => setForm(f => ({ ...f, balance_as_of_date: e.target.value }))}
                            style={inputStyle} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                            Opening balance at the start of this day
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Description</label>
                  <input data-testid="account-desc-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={inputStyle} placeholder="Optional description" />
                </div>

                {/* Loan Details — shown for loan/mortgage sub-types */}
                {(form.sub_type === 'loan' || form.sub_type === 'mortgage') && (
                  <div data-testid="loan-details-section" style={{
                    marginBottom: 16, padding: '16px 18px', background: 'var(--bg-secondary)', borderRadius: 2,
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <CurrencyCircleDollar size={16} weight="duotone" style={{ color: 'var(--accent-1)' }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Loan Details</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(optional — for EMI tracking)</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Interest Rate (% p.a.)</label>
                        <input data-testid="loan-rate-input" type="number" step="0.01"
                          value={form.loan_interest_rate} onChange={e => setForm(f => autoCalcBalance({ ...f, loan_interest_rate: e.target.value }))}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="e.g., 8.5" />
                      </div>
                      <div>
                        <label style={labelStyle}>Remaining Tenure (months)</label>
                        <input data-testid="loan-tenure-input" type="number"
                          value={form.loan_tenure_months} onChange={e => setForm(f => autoCalcBalance({ ...f, loan_tenure_months: e.target.value }))}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="e.g., 240" />
                      </div>
                      <div>
                        <label style={labelStyle}>EMI Amount</label>
                        <input data-testid="loan-emi-input" type="number" step="0.01"
                          value={form.loan_emi_amount} onChange={e => setForm(f => autoCalcBalance({ ...f, loan_emi_amount: e.target.value }))}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="e.g., 43391" />
                      </div>
                      <div>
                        <label style={labelStyle}>EMI Date (day of month)</label>
                        <input data-testid="loan-emi-day-input" type="number" min="1" max="31"
                          value={form.loan_emi_day} onChange={e => setForm(f => ({ ...f, loan_emi_day: e.target.value }))}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="e.g., 5" />
                      </div>
                      <div style={{ gridColumn: '1 / -1', marginTop: 4, paddingTop: 10, borderTop: '1px dashed var(--border-subtle)' }}>
                        <label style={labelStyle}>Sanctioned Amount</label>
                        <input data-testid="loan-sanctioned-input" type="number" step="0.01"
                          value={form.loan_sanctioned_amount}
                          onChange={e => setForm(f => autoCalcBalance({ ...f, loan_sanctioned_amount: e.target.value }))}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="e.g., 2000000 (optional)" />
                        <p className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                          {(() => {
                            const emi = parseFloat(form.loan_emi_amount);
                            const rate = parseFloat(form.loan_interest_rate);
                            const months = parseInt(form.loan_tenure_months);
                            const sanctioned = parseFloat(form.loan_sanctioned_amount);
                            if (sanctioned > 0 && emi > 0 && rate > 0 && months > 0) {
                              return 'Outstanding balance auto-calculated from EMI, rate & tenure.';
                            }
                            return 'Fill this along with EMI, rate & tenure to auto-calculate outstanding balance.';
                          })()}
                        </p>
                      </div>
                    </div>
                    <p className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
                      Fill these to generate an amortization schedule and auto-create a recurring EMI in your cash flow.
                    </p>
                  </div>
                )}
                {form.sub_type === 'demat' && (
                  <div data-testid="demat-details-section" style={{
                    marginBottom: 16, padding: '16px 18px', background: 'var(--bg-secondary)', borderRadius: 2,
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <ChartLineUp size={16} weight="duotone" style={{ color: 'var(--accent-1)' }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Demat Account Details</span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                      Enter your Demat account's current value as the opening balance above.
                      You can track trading P&L by uploading broker statements or adding manual entries from the account card.
                    </p>
                    <div>
                      <label style={labelStyle}>Broker Name (optional)</label>
                      <input data-testid="demat-broker-input" type="text"
                        value={form.broker_name}
                        onChange={e => setForm(f => ({ ...f, broker_name: e.target.value }))}
                        style={inputStyle} placeholder="e.g., Zerodha, Groww, Angel One" />
                    </div>
                  </div>
                )}
                {form.sub_type === 'overdraft' && (
                  <div data-testid="od-details-section" style={{
                    marginBottom: 16, padding: '16px 18px', background: 'var(--bg-secondary)', borderRadius: 2,
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <CurrencyCircleDollar size={16} weight="duotone" style={{ color: 'var(--accent-1)' }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Overdraft Details</span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                      An overdraft gives you a credit limit — you withdraw as needed and repay anytime.
                      Interest is charged only on what you've used, calculated daily.
                      Record withdrawals as transfers <strong>from</strong> this OD account to your bank, and repayments
                      as transfers <strong>to</strong> this OD account.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Sanctioned Limit *</label>
                        <input data-testid="od-sanctioned-input" type="number" step="0.01"
                          value={form.loan_sanctioned_amount}
                          onChange={e => setForm(f => ({ ...f, loan_sanctioned_amount: e.target.value }))}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="e.g., 1000000" />
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                          The maximum credit your bank has approved
                        </span>
                      </div>
                      <div>
                        <label style={labelStyle}>Interest Rate (% p.a.)</label>
                        <input data-testid="od-rate-input" type="number" step="0.01"
                          value={form.loan_interest_rate}
                          onChange={e => setForm(f => ({ ...f, loan_interest_rate: e.target.value }))}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="e.g., 10.5 (optional)" />
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                          {form.loan_interest_rate ? 'Auto-interest calculation enabled — you can calculate monthly interest from the account card' : 'Leave blank for manual mode — you\'ll add interest entries yourself'}
                        </span>
                      </div>
                      <div>
                        <label style={labelStyle}>Interest Charge Day</label>
                        <input data-testid="od-emi-day-input" type="number" min="1" max="31"
                          value={form.loan_emi_day}
                          onChange={e => setForm(f => ({ ...f, loan_emi_day: e.target.value }))}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="e.g., 5 (optional)" />
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                          Day of month your bank charges interest — used in cash flow projection
                        </span>
                      </div>
                    </div>
                    {parseFloat(form.loan_sanctioned_amount) > 0 && parseFloat(form.opening_balance) > 0 && (
                      <div className="mono" style={{ fontSize: 11, color: 'var(--info)', marginTop: 12, padding: '8px 12px', background: 'rgba(74,110,125,0.06)', borderRadius: 2 }}>
                        Available credit: {formatCurrency(parseFloat(form.loan_sanctioned_amount) - parseFloat(form.opening_balance))}
                      </div>
                    )}
                  </div>
                )}
                {error && <p data-testid="account-error" style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button data-testid="save-account-btn" type="submit" disabled={saving} style={{
                    background: saving ? 'var(--text-muted)' : 'var(--brand-primary)', color: '#fff', border: 'none',
                    padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', opacity: saving ? 0.7 : 1,
                  }}>{saving ? 'Saving...' : editingAcc ? 'Update Account' : 'Save Account'}</button>
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
            Edit {accountsMissingDate.length > 1 ? 'them' : 'it'} to set the date your opening balance was recorded.
          </span>
        </div>
      )}

      {/* Accounts List - Grouped by Type → Sub-type */}
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-muted)' }}>Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{s('no_accounts_yet')}</p>
        </div>
      ) : (
        <AccountsGroupedList
          accounts={accounts}
          onEdit={openEdit}
          onDelete={handleDelete}
          expandedSubTypes={expandedSubTypes}
          toggleSubType={toggleSubType}
          onViewSchedule={(acc) => setAmortAcc(acc)}
          onCalcInterest={(acc) => setInterestAcc(acc)}
          onUploadStatement={(acc) => setUploadStatementAcc(acc)}
          onManualEntry={(acc) => setManualEntryAcc(acc)}
          onViewDetail={(acc) => navigate(`/accounts/${acc.account_id}`)}
        />
      )}

      {/* OD Interest Calculator Modal */}
      {interestAcc && (
        <ODInterestModal
          account={interestAcc}
          onClose={() => { setInterestAcc(null); loadAccounts(); }}
        />
      )}

      {/* Amortization Schedule Modal */}
      {amortAcc && (
        <AmortizationModal
          accountId={amortAcc.account_id}
          accountName={amortAcc.name}
          onClose={() => setAmortAcc(null)}
        />
      )}

      {/* Demat Upload Statement Modal */}
      {uploadStatementAcc && (
        <DematUploadModal
          account={uploadStatementAcc}
          onClose={() => { setUploadStatementAcc(null); loadAccounts(); }}
        />
      )}

      {/* Demat Manual Entry Modal */}
      {manualEntryAcc && (
        <DematManualEntryModal
          account={manualEntryAcc}
          onClose={() => { setManualEntryAcc(null); loadAccounts(); }}
        />
      )}
    </div>
  );
}
