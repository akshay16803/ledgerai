import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import { Plus, ArrowDown, ArrowUp, ArrowsLeftRight, Check, X, Funnel, PencilSimple, Robot, Receipt, UploadSimple, SpinnerGap, Eye, Trash } from '@phosphor-icons/react';
import { EditTransactionModal } from '../components/EditTransactionModal';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

export default function Transactions() {
  const cachedTxn = getCached('transactions');
  const [transactions, setTransactions] = useState(cachedTxn?.transactions || []);
  const [accounts, setAccounts] = useState(cachedTxn?.accounts || []);
  const [categories, setCategories] = useState(cachedTxn?.categories || []);
  const [total, setTotal] = useState(cachedTxn?.total || 0);
  const [loading, setLoading] = useState(!cachedTxn);
  const [showForm, setShowForm] = useState(false);
  const [txnType, setTxnType] = useState('expense');
  const [filterType, setFilterType] = useState('');
  const [error, setError] = useState('');
  const [editingTxn, setEditingTxn] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: '', date: new Date().toISOString().split('T')[0],
    account_id: '', to_account_id: '', category_id: '', subcategory_id: '',
    description: '', payment_method: '', is_recurring: false, recurring_frequency: ''
  });
  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptId, setReceiptId] = useState(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [parsingReceipt, setParsingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const receiptInputRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const [txnRes, accs, cats] = await Promise.all([
        api.get(`/api/transactions?${filterType ? `transaction_type=${filterType}&` : ''}status=approved&limit=100`),
        api.get('/api/accounts'),
        api.get('/api/categories'),
      ]);
      setTransactions(txnRes.transactions);
      setTotal(txnRes.total);
      setAccounts(accs);
      setCategories(cats);
      if (!filterType) {
        setCache('transactions', { transactions: txnRes.transactions, total: txnRes.total, accounts: accs, categories: cats });
      }
    } catch (err) { /* Error handled silently - data will show empty state */ }
    setLoading(false);
  }, [filterType]);

  useEffect(() => { loadData(); }, [loadData]); // eslint-disable-line react-hooks/set-state-in-effect

  // Memoize expensive filter operations
  const parentCategories = useMemo(
    () => categories.filter(c => !c.parent_id && c.category_type === txnType),
    [categories, txnType]
  );
  const subCategories = useMemo(
    () => categories.filter(c => c.parent_id === form.category_id),
    [categories, form.category_id]
  );
  const filteredToAccounts = useMemo(
    () => accounts.filter(a => a.account_id !== form.account_id),
    [accounts, form.account_id]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Amount must be positive'); return; }
    if (!form.date) { setError('Date is required'); return; }
    if (!form.account_id) { setError('Account is required'); return; }
    if (txnType !== 'transfer' && !form.category_id) { setError('Category is required'); return; }
    if (txnType === 'transfer' && !form.to_account_id) { setError('Destination account is required'); return; }

    setSaving(true);
    try {
      await api.post('/api/transactions', {
        transaction_type: txnType,
        amount: parseFloat(form.amount),
        date: form.date,
        account_id: form.account_id,
        to_account_id: txnType === 'transfer' ? form.to_account_id : null,
        category_id: txnType !== 'transfer' ? form.category_id : null,
        subcategory_id: txnType !== 'transfer' ? form.subcategory_id : null,
        description: form.description,
        payment_method: form.payment_method || null,
        is_recurring: form.is_recurring,
        recurring_frequency: form.is_recurring ? form.recurring_frequency : null,
        source: 'manual',
        status: 'approved',
        receipt_id: receiptId || null,
      });
      setShowForm(false);
      setForm({ amount: '', date: new Date().toISOString().split('T')[0], account_id: '', to_account_id: '', category_id: '', subcategory_id: '', description: '', payment_method: '', is_recurring: false, recurring_frequency: '' });
      handleRemoveReceipt();
      loadData();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const handleApprove = async (id) => {
    try { await api.post(`/api/transactions/${id}/approve`); loadData(); }
    catch (err) { alert(err.message); }
  };
  const handleReject = async (id) => {
    try { await api.post(`/api/transactions/${id}/reject`); loadData(); }
    catch (err) { alert(err.message); }
  };
  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    try { await api.del(`/api/transactions/${id}`); loadData(); }
    catch (err) { alert(err.message); }
  };

  const getAccountName = (id) => accounts.find(a => a.account_id === id)?.name || 'Unknown';
  const getCategoryName = (id) => categories.find(c => c.category_id === id)?.name || '';

  // Quick add category inline
  const [showQuickCat, setShowQuickCat] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const handleQuickAddCategory = async () => {
    if (!quickCatName.trim()) return;
    try {
      await api.post('/api/categories', { name: quickCatName.trim(), category_type: txnType });
      setQuickCatName('');
      setShowQuickCat(false);
      const cats = await api.get('/api/categories');
      setCategories(cats);
    } catch (err) { alert(err.message); }
  };

  // Quick add account
  const [showQuickAcc, setShowQuickAcc] = useState(false);
  const [quickAccName, setQuickAccName] = useState('');
  const [quickAccBalance, setQuickAccBalance] = useState('');
  const [quickAccDate, setQuickAccDate] = useState(new Date().toISOString().split('T')[0]);
  const handleQuickAddAccount = async () => {
    if (!quickAccName.trim()) return;
    try {
      await api.post('/api/accounts', { name: quickAccName.trim(), account_type: 'asset', sub_type: 'bank', opening_balance: parseFloat(quickAccBalance) || 0, balance_as_of_date: quickAccDate, currency: 'INR' });
      setQuickAccName('');
      setQuickAccBalance('');
      setQuickAccDate(new Date().toISOString().split('T')[0]);
      setShowQuickAcc(false);
      const accs = await api.get('/api/accounts');
      setAccounts(accs);
    } catch (err) { alert(err.message); }
  };

  // Receipt upload handler
  const handleReceiptUpload = async (file) => {
    if (!file) return;
    setReceiptFile(file);
    setReceiptError('');

    // Generate local preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setReceiptPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null); // PDF — no image preview
    }

    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.upload('/api/receipts/upload', fd);
      setReceiptId(res.receipt_id);

      // Auto-parse with AI if form fields are mostly empty (upload-first flow)
      const formIsEmpty = !form.amount && !form.description;
      if (formIsEmpty) {
        setParsingReceipt(true);
        try {
          const parseRes = await api.post(`/api/receipts/${res.receipt_id}/parse`, {});
          if (parseRes.parsed_data) {
            const pd = parseRes.parsed_data;
            setForm(f => ({
              ...f,
              amount: pd.amount ? String(pd.amount) : f.amount,
              date: pd.date || f.date,
              description: pd.description || pd.vendor || f.description,
              payment_method: pd.payment_method || f.payment_method,
              category_id: pd.category_id || f.category_id,
            }));
            // If AI detected it's an expense, ensure txnType is expense
            if (pd.amount && txnType !== 'expense') {
              setTxnType('expense');
            }
          }
        } catch {
          // AI parse failed — user can fill manually
        } finally {
          setParsingReceipt(false);
        }
      }
    } catch (err) {
      setReceiptError(err.message);
      setReceiptId(null);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptId(null);
    setReceiptError('');
    if (receiptInputRef.current) receiptInputRef.current.value = '';
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)' };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };

  return (
    <div data-testid="transactions-page">
      <style>{`.spin { animation: spin-anim 1s linear infinite; } @keyframes spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div className="action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Transactions</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {total} total transactions
          </p>
        </div>
        <button data-testid="new-transaction-btn" onClick={() => setShowForm(!showForm)} style={{
          background: 'var(--brand-primary)', color: '#fff', border: 'none',
          padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Plus size={14} weight="bold" /> New Transaction
        </button>
      </div>

      {/* Transaction Form */}
      {showForm && (
        <div data-testid="transaction-form" style={{
          background: '#fff', border: '1px solid var(--border-subtle)',
          borderRadius: 2, padding: 28, marginBottom: 24
        }}>
          {/* Type Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
            {[
              { key: 'income', label: 'Income', icon: ArrowDown, color: 'var(--success)' },
              { key: 'expense', label: 'Expense', icon: ArrowUp, color: 'var(--error)' },
              { key: 'transfer', label: 'Transfer', icon: ArrowsLeftRight, color: 'var(--info)' },
            ].map(({ key, label, icon: Icon, color }) => (
              <button key={key} data-testid={`txn-type-${key}`} onClick={() => { setTxnType(key); setForm(f => ({ ...f, category_id: '', subcategory_id: '' })); }}
                style={{
                  padding: '10px 20px', border: 'none', borderBottom: txnType === key ? `2px solid ${color}` : '2px solid transparent',
                  background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: txnType === key ? 600 : 400,
                  color: txnType === key ? color : 'var(--text-muted)', fontFamily: 'var(--font-body)',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s'
                }}>
                <Icon size={16} weight={txnType === key ? 'bold' : 'regular'} /> {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Account */}
              <div>
                <label style={labelStyle}>
                  {txnType === 'income' ? 'Account Receiving Payment *' :
                   txnType === 'expense' ? 'Account Making Payment *' : 'From Account *'}
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select data-testid="txn-account-select" value={form.account_id} onChange={e => setForm(f => ({...f, account_id: e.target.value}))}
                    style={{ ...inputStyle, flex: 1 }}>
                    <option value="">Select account</option>
                    {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.name}</option>)}
                  </select>
                  <button type="button" data-testid="quick-add-account-btn" onClick={() => setShowQuickAcc(!showQuickAcc)}
                    style={{ padding: '0 10px', border: '1px solid var(--border-strong)', borderRadius: 2, background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 16, color: 'var(--accent-1)' }}>
                    +
                  </button>
                </div>
                {showQuickAcc && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <input data-testid="quick-account-name-input" value={quickAccName} onChange={e => setQuickAccName(e.target.value)} placeholder="Account name" style={{ ...inputStyle, flex: 1, padding: '6px 10px', fontSize: 12, minWidth: 100 }} />
                    <input data-testid="quick-account-balance-input" type="number" value={quickAccBalance} onChange={e => setQuickAccBalance(e.target.value)} placeholder="Balance" style={{ ...inputStyle, width: 90, padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-mono)' }} />
                    <input data-testid="quick-account-date-input" type="date" value={quickAccDate} onChange={e => setQuickAccDate(e.target.value)} style={{ ...inputStyle, width: 130, padding: '6px 10px', fontSize: 12 }} title="Balance as of (opening of day)" />
                    <button type="button" data-testid="quick-save-account-btn" data-guard onClick={handleQuickAddAccount} style={{ padding: '6px 12px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 2, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Save</button>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label style={labelStyle}>Amount *</label>
                <input data-testid="txn-amount-input" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} placeholder="0.00" />
              </div>

              {/* Transfer destination */}
              {txnType === 'transfer' && (
                <div>
                  <label style={labelStyle}>To Account *</label>
                  <select data-testid="txn-to-account-select" value={form.to_account_id} onChange={e => setForm(f => ({...f, to_account_id: e.target.value}))}
                    style={inputStyle}>
                    <option value="">Select destination</option>
                    {filteredToAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.name}</option>)}
                  </select>
                </div>
              )}

              {/* Category */}
              {txnType !== 'transfer' && (
                <div>
                  <label style={labelStyle}>Category *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select data-testid="txn-category-select" value={form.category_id} onChange={e => setForm(f => ({...f, category_id: e.target.value, subcategory_id: ''}))}
                      style={{ ...inputStyle, flex: 1 }}>
                      <option value="">Select category</option>
                      {parentCategories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                    </select>
                    <button type="button" data-testid="quick-add-category-btn" onClick={() => setShowQuickCat(!showQuickCat)}
                      style={{ padding: '0 10px', border: '1px solid var(--border-strong)', borderRadius: 2, background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 16, color: 'var(--accent-1)' }}>
                      +
                    </button>
                  </div>
                  {showQuickCat && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <input data-testid="quick-category-name-input" value={quickCatName} onChange={e => setQuickCatName(e.target.value)} placeholder="Category name" style={{ ...inputStyle, flex: 1, padding: '6px 10px', fontSize: 12 }} />
                      <button type="button" data-testid="quick-save-category-btn" data-guard onClick={handleQuickAddCategory} style={{ padding: '6px 12px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 2, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Save</button>
                    </div>
                  )}
                </div>
              )}

              {/* Subcategory */}
              {txnType !== 'transfer' && subCategories.length > 0 && (
                <div>
                  <label style={labelStyle}>Subcategory</label>
                  <select data-testid="txn-subcategory-select" value={form.subcategory_id} onChange={e => setForm(f => ({...f, subcategory_id: e.target.value}))}
                    style={inputStyle}>
                    <option value="">Select subcategory</option>
                    {subCategories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {/* Date */}
              <div>
                <label style={labelStyle}>Date *</label>
                <input data-testid="txn-date-input" type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
                  style={inputStyle} />
              </div>

              {/* Payment Method */}
              <div>
                <label style={labelStyle}>Payment Method</label>
                <select data-testid="txn-payment-method-select" value={form.payment_method} onChange={e => setForm(f => ({...f, payment_method: e.target.value}))}
                  style={inputStyle}>
                  <option value="">Select method (optional)</option>
                  <option value="upi">UPI</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="debit_card">Debit Card</option>
                  <option value="net_banking">Net Banking</option>
                  <option value="cash">Cash</option>
                  <option value="wallet">Wallet</option>
                  <option value="cheque">Cheque</option>
                  <option value="neft">NEFT</option>
                  <option value="rtgs">RTGS</option>
                  <option value="imps">IMPS</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Recurring */}
              <div>
                <label style={labelStyle}>Recurring</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input data-testid="txn-recurring-checkbox" type="checkbox" checked={form.is_recurring} onChange={e => setForm(f => ({...f, is_recurring: e.target.checked}))} />
                    Is Recurring
                  </label>
                  {form.is_recurring && (
                    <select data-testid="txn-frequency-select" value={form.recurring_frequency} onChange={e => setForm(f => ({...f, recurring_frequency: e.target.value}))}
                      style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12 }}>
                      <option value="">Frequency</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Description</label>
              <input data-testid="txn-description-input" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                style={inputStyle} placeholder="Optional description" />
            </div>

            {/* Receipt / Bill Upload */}
            {txnType !== 'transfer' && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  <Receipt size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Receipt / Bill
                </label>
                {!receiptFile ? (
                  <div
                    onClick={() => receiptInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--brand-primary)'; }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                    onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border-strong)'; const f = e.dataTransfer.files[0]; if (f) handleReceiptUpload(f); }}
                    style={{
                      border: '2px dashed var(--border-strong)', borderRadius: 2, padding: '20px 16px',
                      textAlign: 'center', cursor: 'pointer', background: 'var(--bg-primary)',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <UploadSimple size={24} style={{ color: 'var(--text-muted)', marginBottom: 6 }} />
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                      Drop receipt here or <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>browse</span>
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      JPG, PNG, PDF — max 10 MB. AI will auto-fill details if form is empty.
                    </p>
                    <input ref={receiptInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                      onChange={(e) => { const f = e.target.files[0]; if (f) handleReceiptUpload(f); }} />
                  </div>
                ) : (
                  <div style={{
                    border: '1px solid var(--border-strong)', borderRadius: 2, padding: 12,
                    display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-primary)',
                  }}>
                    {/* Thumbnail */}
                    {receiptPreview ? (
                      <img src={receiptPreview} alt="Receipt" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 2, border: '1px solid var(--border-subtle)' }} />
                    ) : (
                      <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: 2 }}>
                        <Receipt size={20} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {receiptFile.name}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        {(receiptFile.size / 1024).toFixed(0)} KB
                        {uploadingReceipt && <span> — Uploading...</span>}
                        {parsingReceipt && <span style={{ color: 'var(--brand-primary)' }}> — <Robot size={12} style={{ verticalAlign: 'middle' }} /> AI reading receipt...</span>}
                        {receiptId && !uploadingReceipt && !parsingReceipt && <span style={{ color: 'var(--success)' }}> — Uploaded ✓</span>}
                      </p>
                    </div>
                    {(uploadingReceipt || parsingReceipt) && (
                      <SpinnerGap size={18} className="spin" style={{ color: 'var(--brand-primary)' }} />
                    )}
                    {!uploadingReceipt && !parsingReceipt && (
                      <button type="button" onClick={handleRemoveReceipt} title="Remove receipt"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                        <Trash size={16} />
                      </button>
                    )}
                  </div>
                )}
                {receiptError && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{receiptError}</p>}
              </div>
            )}

            {error && <p data-testid="transaction-error" style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 12 }}>
              <button data-testid="save-transaction-btn" type="submit" disabled={saving || uploadingReceipt || parsingReceipt} style={{
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
                padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                cursor: (saving || uploadingReceipt || parsingReceipt) ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)', opacity: (saving || uploadingReceipt || parsingReceipt) ? 0.6 : 1,
              }}>{saving ? 'Saving...' : form.transaction_id ? 'Update' : 'Save Transaction'}</button>
              <button type="button" onClick={() => { setShowForm(false); handleRemoveReceipt(); }} style={{
                background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                padding: '10px 24px', borderRadius: 2, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)'
              }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select data-testid="filter-type" value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff' }}>
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </select>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-muted)' }}>Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>No transactions found</p>
          <button onClick={() => setShowForm(true)} style={{
            background: 'var(--brand-primary)', color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)'
          }}>Record First Transaction</button>
        </div>
      ) : (
        <div className="table-responsive" style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Description</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Account</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Category</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Amount</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', position: 'sticky', right: 0, background: 'var(--bg-secondary)', zIndex: 2 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => (
                <tr key={txn.transaction_id} data-testid={`txn-row-${txn.transaction_id}`} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
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
                  <td style={{ padding: '12px 16px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {txn.description || '-'}
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
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12 }}>
                    {getAccountName(txn.account_id)}
                    {txn.to_account_id && <span style={{ color: 'var(--text-muted)' }}> → {getAccountName(txn.to_account_id)}</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12 }}>{getCategoryName(txn.category_id)}</td>
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
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600,
                      color: txn.status === 'approved' ? 'var(--success)' : txn.status === 'pending_review' ? 'var(--warning)' : 'var(--error)',
                      background: txn.status === 'approved' ? 'rgba(58,92,74,0.1)' : txn.status === 'pending_review' ? 'rgba(194,140,60,0.1)' : 'rgba(150,69,58,0.1)'
                    }}>
                      {txn.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', position: 'sticky', right: 0, background: '#fff', zIndex: 1, boxShadow: '-4px 0 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button data-testid={`edit-txn-${txn.transaction_id}`} onClick={() => setEditingTxn(txn)} title="Edit"
                        style={{ background: 'rgba(74,110,125,0.1)', border: 'none', borderRadius: 2, padding: '4px 8px', cursor: 'pointer', color: 'var(--info)' }}>
                        <PencilSimple size={14} weight="bold" />
                      </button>
                      {txn.status === 'pending_review' && (
                        <>
                          <button data-testid={`approve-txn-${txn.transaction_id}`} data-guard onClick={() => handleApprove(txn.transaction_id)} title="Approve"
                            style={{ background: 'rgba(58,92,74,0.1)', border: 'none', borderRadius: 2, padding: '4px 8px', cursor: 'pointer', color: 'var(--success)' }}>
                            <Check size={14} weight="bold" />
                          </button>
                          <button data-testid={`reject-txn-${txn.transaction_id}`} onClick={() => handleReject(txn.transaction_id)} title="Reject"
                            style={{ background: 'rgba(150,69,58,0.1)', border: 'none', borderRadius: 2, padding: '4px 8px', cursor: 'pointer', color: 'var(--error)' }}>
                            <X size={14} weight="bold" />
                          </button>
                        </>
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
