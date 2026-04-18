import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../lib/api';
import { X, ArrowDown, ArrowUp, ArrowsLeftRight, Plus, Check, CheckCircle, Receipt, UploadSimple, SpinnerGap, Trash, Robot, FileText, Package } from '@phosphor-icons/react';

export function EditTransactionModal({ transaction, accounts, categories, onSave, onClose, isPendingReview = false, onSwitchToInvoice }) {
  const isEdit = !!transaction;
  const [txnType, setTxnType] = useState(transaction?.transaction_type || 'expense');
  const [form, setForm] = useState({
    amount: transaction?.amount || '',
    date: transaction?.date || new Date().toISOString().split('T')[0],
    account_id: transaction?.account_id || '',
    to_account_id: transaction?.to_account_id || '',
    category_id: transaction?.category_id || '',
    subcategory_id: transaction?.subcategory_id || '',
    description: transaction?.description || '',
    payment_method: transaction?.payment_method || '',
    is_recurring: transaction?.is_recurring || false,
    recurring_frequency: transaction?.recurring_frequency || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  // Quick-add state
  const [showQuickCat, setShowQuickCat] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [showQuickSubCat, setShowQuickSubCat] = useState(false);
  const [quickSubCatName, setQuickSubCatName] = useState('');
  const [showQuickAcc, setShowQuickAcc] = useState(false);
  const [quickAccName, setQuickAccName] = useState('');
  const [quickAccBalance, setQuickAccBalance] = useState('');
  const [quickAccDate, setQuickAccDate] = useState(new Date().toISOString().split('T')[0]);
  const [localAccounts, setLocalAccounts] = useState(accounts);
  const [localCategories, setLocalCategories] = useState(categories);

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptId, setReceiptId] = useState(transaction?.receipt_id || null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [parsingReceipt, setParsingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [existingReceipt, setExistingReceipt] = useState(null);
  const receiptInputRef = useRef(null);

  useEffect(() => { setLocalAccounts(accounts); }, [accounts]);
  useEffect(() => { setLocalCategories(categories); }, [categories]);

  // Load existing receipt if transaction has one
  useEffect(() => {
    if (transaction?.receipt_id) {
      api.get(`/api/receipts/by-transaction/${transaction.transaction_id}`).then(r => {
        setExistingReceipt(r);
        setReceiptId(r.receipt_id);
      }).catch(() => {});
    }
  }, [transaction]);

  // Memoize expensive filter operations
  const parentCategories = useMemo(
    () => localCategories.filter(c => !c.parent_id && c.category_type === txnType),
    [localCategories, txnType]
  );
  const subCategories = useMemo(
    () => localCategories.filter(c => c.parent_id === form.category_id),
    [localCategories, form.category_id]
  );
  const filteredToAccounts = useMemo(
    () => localAccounts.filter(a => a.account_id !== form.account_id),
    [localAccounts, form.account_id]
  );

  const handleQuickAddCategory = async () => {
    if (!quickCatName.trim()) return;
    try {
      await api.post('/api/categories', { name: quickCatName.trim(), category_type: txnType });
      const cats = await api.get('/api/categories');
      setLocalCategories(cats);
      setQuickCatName('');
      setShowQuickCat(false);
    } catch (err) { alert(err.message); }
  };

  const handleQuickAddSubCategory = async () => {
    if (!quickSubCatName.trim() || !form.category_id) return;
    try {
      await api.post('/api/categories', { name: quickSubCatName.trim(), category_type: txnType, parent_id: form.category_id });
      const cats = await api.get('/api/categories');
      setLocalCategories(cats);
      setQuickSubCatName('');
      setShowQuickSubCat(false);
    } catch (err) { alert(err.message); }
  };

  const handleQuickAddAccount = async () => {
    if (!quickAccName.trim()) return;
    if (quickAccBalance === '') { alert('Please enter the account balance'); return; }
    try {
      await api.post('/api/accounts', { name: quickAccName.trim(), account_type: 'asset', sub_type: 'bank', opening_balance: parseFloat(quickAccBalance) || 0, balance_as_of_date: quickAccDate, currency: 'INR' });
      const accs = await api.get('/api/accounts');
      setLocalAccounts(accs);
      setQuickAccName('');
      setQuickAccBalance('');
      setQuickAccDate(new Date().toISOString().split('T')[0]);
      setShowQuickAcc(false);
    } catch (err) { alert(err.message); }
  };

  // Receipt upload handler
  const handleReceiptUpload = async (file) => {
    if (!file) return;
    setReceiptFile(file);
    setReceiptError('');
    setExistingReceipt(null);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setReceiptPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.upload('/api/receipts/upload', fd);
      setReceiptId(res.receipt_id);
      // Auto-parse if form fields are mostly empty
      const formIsEmpty = !form.amount && !form.description;
      if (formIsEmpty && !isEdit) {
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
            if (pd.amount && txnType !== 'expense') setTxnType('expense');
          }
        } catch { /* user fills manually */ }
        finally { setParsingReceipt(false); }
      }
    } catch (err) {
      setReceiptError(err.message);
      setReceiptId(null);
    } finally { setUploadingReceipt(false); }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptId(null);
    setReceiptError('');
    setExistingReceipt(null);
    if (receiptInputRef.current) receiptInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Amount must be positive'); return; }
    if (!form.date) { setError('Date is required'); return; }
    if (!form.account_id) { setError('Account is required'); return; }
    if (txnType !== 'transfer' && !form.category_id) { setError('Category is required'); return; }
    if (txnType === 'transfer' && !form.to_account_id) { setError('Destination account is required'); return; }

    setSaving(true);
    try {
      const payload = {
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
        receipt_id: receiptId || null,
      };

      if (isEdit) {
        await api.put(`/api/transactions/${transaction.transaction_id}`, payload);
      } else {
        await api.post('/api/transactions', { ...payload, source: 'manual', status: 'approved' });
      }
      onSave();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  // Save changes and approve transaction in one action
  const handleSaveAndApprove = async () => {
    setError('');
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Amount must be positive'); return; }
    if (!form.date) { setError('Date is required'); return; }
    if (!form.account_id) { setError('Account is required'); return; }
    if (txnType !== 'transfer' && !form.category_id) { setError('Category is required'); return; }
    if (txnType === 'transfer' && !form.to_account_id) { setError('Destination account is required'); return; }

    setApproving(true);
    try {
      // First save any changes
      const payload = {
        transaction_type: txnType,
        amount: parseFloat(form.amount),
        date: form.date,
        account_id: form.account_id,
        to_account_id: txnType === 'transfer' ? form.to_account_id : null,
        category_id: txnType !== 'transfer' ? form.category_id : null,
        subcategory_id: txnType !== 'transfer' ? form.subcategory_id : null,
        description: form.description,
        payment_method: form.payment_method || null,
        receipt_id: receiptId || null,
        is_recurring: form.is_recurring,
        recurring_frequency: form.is_recurring ? form.recurring_frequency : null,
      };
      await api.put(`/api/transactions/${transaction.transaction_id}`, payload);
      
      // Then approve the transaction
      await api.post(`/api/transactions/${transaction.transaction_id}/approve`);
      
      onSave();
    } catch (err) { setError(err.message); }
    finally { setApproving(false); }
  };

  return (
    <div data-testid="edit-transaction-modal" style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <style>{`.spin { animation: spin-anim 1s linear infinite; } @keyframes spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 2, width: '100%', maxWidth: 580,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        margin: '0 8px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>{isEdit ? 'Edit Transaction' : 'New Transaction'}</h2>
          <button data-testid="close-edit-modal" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {/* Type Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            {[
              { key: 'income', label: 'Income', icon: ArrowDown, color: 'var(--success)' },
              { key: 'expense', label: 'Expense', icon: ArrowUp, color: 'var(--error)' },
              { key: 'transfer', label: 'Transfer', icon: ArrowsLeftRight, color: 'var(--info)' },
              ...(isEdit ? [] : [
                { key: 'sales_invoice', label: 'Sales Invoice', icon: FileText, color: 'var(--info)' },
                { key: 'purchase_invoice', label: 'Purchase Invoice', icon: Package, color: 'var(--brand-primary)' },
              ]),
            ].map(({ key, label, icon: Icon, color }) => (
              <button key={key} data-testid={`modal-txn-type-${key}`}
                onClick={() => {
                  if (key === 'sales_invoice' || key === 'purchase_invoice') {
                    if (onSwitchToInvoice) onSwitchToInvoice(key);
                    return;
                  }
                  setTxnType(key); setForm(f => ({ ...f, category_id: '', subcategory_id: '' }));
                }}
                style={{
                  padding: '10px 16px', border: 'none',
                  borderBottom: txnType === key ? `2px solid ${color}` : '2px solid transparent',
                  background: 'transparent', cursor: 'pointer', fontSize: 13,
                  fontWeight: txnType === key ? 600 : 400,
                  color: txnType === key ? color : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.15s',
                }}>
                <Icon size={15} weight={txnType === key ? 'bold' : 'regular'} /> {label}
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
                  <select data-testid="modal-account-select" value={form.account_id}
                    onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
                    style={{ ...inputStyle, flex: 1 }}>
                    <option value="">Select account</option>
                    {localAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.name}</option>)}
                  </select>
                  <button type="button" data-testid="modal-quick-add-account" data-guard onClick={() => setShowQuickAcc(!showQuickAcc)}
                    style={quickAddBtnStyle}><Plus size={14} /></button>
                </div>
                {showQuickAcc && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <input value={quickAccName} onChange={e => setQuickAccName(e.target.value)} placeholder="Account name"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleQuickAddAccount())}
                      style={{ ...inputStyle, flex: 1, padding: '6px 10px', fontSize: 12, minWidth: 120 }} />
                    <input type="number" value={quickAccBalance} onChange={e => setQuickAccBalance(e.target.value)} placeholder="Balance"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleQuickAddAccount())}
                      style={{ ...inputStyle, width: 100, padding: '6px 10px', fontSize: 12, fontFamily: 'var(--font-mono)' }} />
                    <input type="date" data-testid="modal-quick-acc-date" value={quickAccDate} onChange={e => setQuickAccDate(e.target.value)}
                      style={{ ...inputStyle, width: 130, padding: '6px 10px', fontSize: 12 }} title="Balance as of (opening of day)" />
                    <button type="button" onClick={handleQuickAddAccount}
                      style={{ padding: '6px 12px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 2, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Check size={12} /> Save
                    </button>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label style={labelStyle}>Amount *</label>
                <input data-testid="modal-amount-input" type="number" step="0.01" placeholder="0.00"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }} />
              </div>

              {/* Transfer destination */}
              {txnType === 'transfer' && (
                <div>
                  <label style={labelStyle}>To Account *</label>
                  <select data-testid="modal-to-account-select" value={form.to_account_id}
                    onChange={e => setForm(f => ({ ...f, to_account_id: e.target.value }))}
                    style={inputStyle}>
                    <option value="">Select destination</option>
                    {filteredToAccounts.map(a =>
                      <option key={a.account_id} value={a.account_id}>{a.name}</option>
                    )}
                  </select>
                </div>
              )}

              {/* Category */}
              {txnType !== 'transfer' && (
                <div>
                  <label style={labelStyle}>Category *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select data-testid="modal-category-select" value={form.category_id}
                      onChange={e => setForm(f => ({ ...f, category_id: e.target.value, subcategory_id: '' }))}
                      style={{ ...inputStyle, flex: 1 }}>
                      <option value="">Select category</option>
                      {parentCategories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                    </select>
                    <button type="button" data-testid="modal-quick-add-category" onClick={() => setShowQuickCat(!showQuickCat)}
                      style={quickAddBtnStyle}><Plus size={14} /></button>
                  </div>
                  {showQuickCat && <QuickAddInput value={quickCatName} onChange={setQuickCatName} onSave={handleQuickAddCategory} placeholder="Category name" />}
                </div>
              )}

              {/* Subcategory */}
              {txnType !== 'transfer' && (
                <div>
                  <label style={labelStyle}>Subcategory</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select data-testid="modal-subcategory-select" value={form.subcategory_id}
                      onChange={e => setForm(f => ({ ...f, subcategory_id: e.target.value }))}
                      style={{ ...inputStyle, flex: 1 }}>
                      <option value="">{subCategories.length === 0 ? 'No subcategories' : 'Select subcategory'}</option>
                      {subCategories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                    </select>
                    {form.category_id && (
                      <button type="button" data-testid="modal-quick-add-subcategory" onClick={() => setShowQuickSubCat(!showQuickSubCat)}
                        style={quickAddBtnStyle}><Plus size={14} /></button>
                    )}
                  </div>
                  {showQuickSubCat && <QuickAddInput value={quickSubCatName} onChange={setQuickSubCatName} onSave={handleQuickAddSubCategory} placeholder="Subcategory name" />}
                </div>
              )}

              {/* Date */}
              <div>
                <label style={labelStyle}>Date *</label>
                <input data-testid="modal-date-input" type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  style={inputStyle} />
              </div>

              {/* Payment Method */}
              <div>
                <label style={labelStyle}>Payment Method</label>
                <select data-testid="modal-payment-method-select" value={form.payment_method}
                  onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
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
                    <input data-testid="modal-recurring-checkbox" type="checkbox" checked={form.is_recurring}
                      onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} />
                    Is Recurring
                  </label>
                  {form.is_recurring && (
                    <select data-testid="modal-frequency-select" value={form.recurring_frequency}
                      onChange={e => setForm(f => ({ ...f, recurring_frequency: e.target.value }))}
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
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Description</label>
              <input data-testid="modal-description-input" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={inputStyle} placeholder="Optional description" />
            </div>

            {/* Receipt / Bill Upload */}
            {txnType !== 'transfer' && (
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  <Receipt size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Receipt / Bill
                </label>
                {!receiptFile && !existingReceipt ? (
                  <div
                    onClick={() => receiptInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--brand-primary)'; }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                    onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border-strong)'; const f = e.dataTransfer.files[0]; if (f) handleReceiptUpload(f); }}
                    style={{
                      border: '2px dashed var(--border-strong)', borderRadius: 2, padding: '16px 12px',
                      textAlign: 'center', cursor: 'pointer', background: 'var(--bg-primary)',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <UploadSimple size={20} style={{ color: 'var(--text-muted)', marginBottom: 4 }} />
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                      Drop receipt here or <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>browse</span>
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '3px 0 0' }}>
                      JPG, PNG, PDF — max 10 MB
                    </p>
                    <input ref={receiptInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                      onChange={(e) => { const f = e.target.files[0]; if (f) handleReceiptUpload(f); }} />
                  </div>
                ) : (
                  <div style={{
                    border: '1px solid var(--border-strong)', borderRadius: 2, padding: 10,
                    display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-primary)',
                  }}>
                    {receiptPreview ? (
                      <img src={receiptPreview} alt="Receipt" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 2, border: '1px solid var(--border-subtle)' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: 2 }}>
                        <Receipt size={18} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {receiptFile?.name || existingReceipt?.filename || 'Receipt attached'}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        {receiptFile ? `${(receiptFile.size / 1024).toFixed(0)} KB` : existingReceipt ? `${(existingReceipt.file_size / 1024).toFixed(0)} KB` : ''}
                        {uploadingReceipt && <span> — Uploading...</span>}
                        {parsingReceipt && <span style={{ color: 'var(--brand-primary)' }}> — <Robot size={11} style={{ verticalAlign: 'middle' }} /> AI reading...</span>}
                        {receiptId && !uploadingReceipt && !parsingReceipt && <span style={{ color: 'var(--success)' }}> — Attached ✓</span>}
                      </p>
                    </div>
                    {(uploadingReceipt || parsingReceipt) && (
                      <SpinnerGap size={16} className="spin" style={{ color: 'var(--brand-primary)' }} />
                    )}
                    {!uploadingReceipt && !parsingReceipt && (
                      <button type="button" onClick={handleRemoveReceipt} title="Remove receipt"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                        <Trash size={14} />
                      </button>
                    )}
                  </div>
                )}
                {receiptError && <p style={{ color: 'var(--error)', fontSize: 11, marginTop: 4 }}>{receiptError}</p>}
              </div>
            )}

            {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {/* Save/Update Button */}
              <button data-testid="modal-save-btn" type="submit" disabled={saving || approving || uploadingReceipt || parsingReceipt}
                style={{
                  background: 'var(--brand-primary)', color: '#fff', border: 'none',
                  padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                  cursor: (saving || approving) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                  opacity: (saving || approving) ? 0.6 : 1,
                }}>
                {saving ? 'Saving...' : isEdit ? 'Update Transaction' : 'Save Transaction'}
              </button>

              {/* Approve Button - only show for pending review transactions */}
              {isPendingReview && isEdit && (
                <button 
                  data-testid="modal-approve-btn" data-guard 
                  type="button" 
                  onClick={handleSaveAndApprove}
                  disabled={saving || approving}
                  style={{
                    background: 'var(--success)', color: '#fff', border: 'none',
                    padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                    cursor: (saving || approving) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                    opacity: (saving || approving) ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  <CheckCircle size={16} weight="fill" />
                  {approving ? 'Approving...' : 'Save & Approve'}
                </button>
              )}

              <button type="button" onClick={onClose}
                style={{
                  background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                  padding: '10px 24px', borderRadius: 2, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function QuickAddInput({ value, onChange, onSave, placeholder }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onSave())}
        style={{ ...inputStyle, flex: 1, padding: '6px 10px', fontSize: 12 }} />
      <button type="button" onClick={onSave}
        style={{ padding: '6px 12px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 2, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 3 }}>
        <Check size={12} /> Save
      </button>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)',
  borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)',
};

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
};

const quickAddBtnStyle = {
  padding: '0 10px', border: '1px solid var(--border-strong)', borderRadius: 2,
  background: 'var(--bg-primary)', cursor: 'pointer', color: 'var(--accent-1)',
  display: 'flex', alignItems: 'center',
};
