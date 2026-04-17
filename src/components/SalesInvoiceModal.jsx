import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '../lib/api';
import { X, Plus, Trash, Receipt, SpinnerGap, Check, MagnifyingGlass, CaretDown } from '@phosphor-icons/react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
];

const TAX_RATES = [0, 5, 12, 18, 28];

const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'net_banking', label: 'Net Banking' },
  { value: 'cash', label: 'Cash' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'imps', label: 'IMPS' },
  { value: 'other', label: 'Other' },
];

function emptyLineItem() {
  return {
    id: Date.now() + Math.random(),
    description: '',
    hsn_sac: '',
    quantity: 1,
    rate: '',
    discount_percent: '',
    tax_rate: 18,
  };
}

function emptyCustomerForm() {
  return { name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', gstin: '' };
}

export function SalesInvoiceModal({ invoice, accounts, onSave, onClose }) {
  const isEdit = !!invoice;

  // Invoice type
  const [invoiceType, setInvoiceType] = useState(invoice?.invoice_type || 'simple');

  // Customer
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(invoice?.customer || null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState(emptyCustomerForm());
  const [savingCustomer, setSavingCustomer] = useState(false);
  const searchTimerRef = useRef(null);
  const customerDropdownRef = useRef(null);

  // Line items
  const [lineItems, setLineItems] = useState(
    invoice?.line_items?.length
      ? invoice.line_items.map((li, i) => ({ ...li, id: li.id || Date.now() + i }))
      : [emptyLineItem()]
  );

  // Place of supply (GST)
  const [placeOfSupply, setPlaceOfSupply] = useState(invoice?.place_of_supply || '');

  // Firm state from settings
  const [firmState, setFirmState] = useState('');

  // Payment
  const [paymentStatus, setPaymentStatus] = useState(invoice?.payment_status || 'unpaid');
  const [amountPaid, setAmountPaid] = useState(invoice?.amount_paid ?? '');
  const [paymentAccountId, setPaymentAccountId] = useState(invoice?.payment_account_id || '');
  const [paymentDate, setPaymentDate] = useState(invoice?.payment_date || new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState(invoice?.payment_method || '');

  // Metadata
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoice_date || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(invoice?.due_date || '');
  const [notes, setNotes] = useState(invoice?.notes || '');

  // UI state
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Load firm settings on mount
  useEffect(() => {
    api.get('/api/settings').then(settings => {
      if (settings?.firm_state) setFirmState(settings.firm_state);
    }).catch(() => {});
  }, []);

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setCustomerResults([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Customer search with debounce
  const handleCustomerSearch = useCallback((value) => {
    setCustomerQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      setCustomerResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchingCustomer(true);
      try {
        const results = await api.get(`/api/customers?q=${encodeURIComponent(value.trim())}`, { bypassCache: true });
        setCustomerResults(Array.isArray(results) ? results : []);
      } catch {
        setCustomerResults([]);
      } finally {
        setSearchingCustomer(false);
      }
    }, 300);
  }, []);

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setCustomerQuery('');
    setCustomerResults([]);
    setShowQuickCreate(false);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
  };

  const handleQuickCreateCustomer = async () => {
    if (!quickCustomer.name.trim()) return;
    setSavingCustomer(true);
    try {
      const created = await api.post('/api/customers', {
        name: quickCustomer.name.trim(),
        phone: quickCustomer.phone || null,
        email: quickCustomer.email || null,
        address: quickCustomer.address || null,
        city: quickCustomer.city || null,
        state: quickCustomer.state || null,
        pincode: quickCustomer.pincode || null,
        gstin: quickCustomer.gstin || null,
      });
      selectCustomer(created);
      setQuickCustomer(emptyCustomerForm());
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCustomer(false);
    }
  };

  // Line item helpers
  const updateLineItem = (id, field, value) => {
    setLineItems(items => items.map(li => li.id === id ? { ...li, [field]: value } : li));
  };

  const addLineItem = () => {
    setLineItems(items => [...items, emptyLineItem()]);
  };

  const removeLineItem = (id) => {
    setLineItems(items => items.length > 1 ? items.filter(li => li.id !== id) : items);
  };

  // Calculations
  const computedLines = useMemo(() => {
    return lineItems.map(li => {
      const qty = parseFloat(li.quantity) || 0;
      const rate = parseFloat(li.rate) || 0;
      const discountPct = parseFloat(li.discount_percent) || 0;
      const lineSubtotal = qty * rate;
      const discountAmt = lineSubtotal * (discountPct / 100);
      const taxableAmount = lineSubtotal - discountAmt;
      const taxRate = invoiceType === 'gst' ? (parseFloat(li.tax_rate) || 0) : 0;
      const taxAmount = taxableAmount * (taxRate / 100);
      const lineTotal = taxableAmount + taxAmount;
      return { ...li, lineSubtotal, discountAmt, taxableAmount, taxRate, taxAmount, lineTotal };
    });
  }, [lineItems, invoiceType]);

  const totals = useMemo(() => {
    const subtotal = computedLines.reduce((s, l) => s + l.lineSubtotal, 0);
    const discountTotal = computedLines.reduce((s, l) => s + l.discountAmt, 0);
    const taxableTotal = computedLines.reduce((s, l) => s + l.taxableAmount, 0);
    const taxTotal = computedLines.reduce((s, l) => s + l.taxAmount, 0);

    // Determine same-state vs inter-state
    const supplyState = placeOfSupply || selectedCustomer?.state || '';
    const isSameState = firmState && supplyState && firmState.toLowerCase() === supplyState.toLowerCase();
    const cgst = isSameState ? taxTotal / 2 : 0;
    const sgst = isSameState ? taxTotal / 2 : 0;
    const igst = !isSameState ? taxTotal : 0;

    const beforeRound = taxableTotal + taxTotal;
    const roundOff = Math.round(beforeRound) - beforeRound;
    const grandTotal = Math.round(beforeRound);

    return { subtotal, discountTotal, taxableTotal, taxTotal, cgst, sgst, igst, isSameState, roundOff, grandTotal };
  }, [computedLines, placeOfSupply, selectedCustomer, firmState]);

  // When payment status changes to paid, default amount to grand total
  useEffect(() => {
    if (paymentStatus === 'paid') {
      setAmountPaid(totals.grandTotal || '');
    }
  }, [paymentStatus, totals.grandTotal]);

  // Validation and submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedCustomer) {
      setError('Please select or create a customer');
      return;
    }

    const validLines = lineItems.filter(li => li.description.trim() && (parseFloat(li.rate) || 0) > 0);
    if (validLines.length === 0) {
      setError('At least one line item with description and rate is required');
      return;
    }

    if ((paymentStatus === 'paid' || paymentStatus === 'partial') && !paymentAccountId) {
      setError('Please select a payment account');
      return;
    }

    if (paymentStatus === 'partial' && (!amountPaid || parseFloat(amountPaid) <= 0)) {
      setError('Please enter the amount paid');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        invoice_type: invoiceType,
        customer_id: selectedCustomer.customer_id || selectedCustomer.id,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        notes: notes || null,
        place_of_supply: invoiceType === 'gst' ? placeOfSupply : null,
        payment_status: paymentStatus,
        amount_paid: paymentStatus !== 'unpaid' ? parseFloat(amountPaid) || 0 : 0,
        payment_account_id: paymentStatus !== 'unpaid' ? paymentAccountId : null,
        payment_date: paymentStatus !== 'unpaid' ? paymentDate : null,
        payment_method: paymentStatus !== 'unpaid' ? paymentMethod : null,
        line_items: validLines.map(li => ({
          description: li.description.trim(),
          hsn_sac: invoiceType === 'gst' ? (li.hsn_sac || null) : null,
          quantity: parseFloat(li.quantity) || 1,
          rate: parseFloat(li.rate) || 0,
          discount_percent: parseFloat(li.discount_percent) || 0,
          tax_rate: invoiceType === 'gst' ? (parseFloat(li.tax_rate) || 0) : 0,
        })),
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        tax_total: totals.taxTotal,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        round_off: totals.roundOff,
        grand_total: totals.grandTotal,
      };

      if (isEdit) {
        await api.put(`/api/invoices/${invoice.invoice_id || invoice.id}`, payload);
      } else {
        await api.post('/api/invoices', payload);
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 2, width: '100%', maxWidth: 800,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 8px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-heading)', margin: 0 }}>
            {isEdit ? 'Edit Invoice' : 'New Sales Invoice'}
          </h2>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {/* Invoice Type Toggle */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
            {[
              { key: 'simple', label: 'Simple Invoice', color: 'var(--brand-primary)' },
              { key: 'gst', label: 'GST Invoice', color: 'var(--info)' },
            ].map(({ key, label, color }) => (
              <button key={key} type="button" onClick={() => setInvoiceType(key)}
                style={{
                  padding: '10px 20px', border: 'none',
                  borderBottom: invoiceType === key ? `2px solid ${color}` : '2px solid transparent',
                  background: 'transparent', cursor: 'pointer', fontSize: 14,
                  fontWeight: invoiceType === key ? 600 : 400,
                  color: invoiceType === key ? color : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}>
                <Receipt size={16} weight={invoiceType === key ? 'bold' : 'regular'} /> {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* ── Customer Section ── */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Customer *</label>
              {!selectedCustomer ? (
                <div ref={customerDropdownRef} style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <MagnifyingGlass size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        value={customerQuery}
                        onChange={e => handleCustomerSearch(e.target.value)}
                        placeholder="Search customers by name..."
                        style={{ ...inputStyle, paddingLeft: 32 }}
                      />
                      {searchingCustomer && (
                        <SpinnerGap size={14} className="spin" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      )}
                    </div>
                    <button type="button" onClick={() => setShowQuickCreate(!showQuickCreate)}
                      style={quickAddBtnStyle} title="Quick create customer">
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Search results dropdown */}
                  {customerResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                      background: '#fff', border: '1px solid var(--border-strong)', borderRadius: 2,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflow: 'auto', marginTop: 2,
                    }}>
                      {customerResults.map(c => (
                        <button key={c.customer_id || c.id} type="button"
                          onClick={() => selectCustomer(c)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                            border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
                            fontFamily: 'var(--font-body)', borderBottom: '1px solid var(--border-subtle)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                        >
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</div>
                          {(c.city || c.gstin) && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {[c.city, c.state, c.gstin].filter(Boolean).join(' | ')}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick create customer form */}
                  {showQuickCreate && (
                    <div style={{ marginTop: 12, padding: 16, border: '1px solid var(--border-strong)', borderRadius: 2, background: 'var(--bg-primary)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>Quick Create Customer</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={labelStyle}>Name *</label>
                          <input value={quickCustomer.name} onChange={e => setQuickCustomer(f => ({ ...f, name: e.target.value }))}
                            placeholder="Customer name" style={smallInputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Phone</label>
                          <input value={quickCustomer.phone} onChange={e => setQuickCustomer(f => ({ ...f, phone: e.target.value }))}
                            placeholder="Phone number" style={smallInputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Email</label>
                          <input value={quickCustomer.email} onChange={e => setQuickCustomer(f => ({ ...f, email: e.target.value }))}
                            placeholder="Email address" style={smallInputStyle} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={labelStyle}>Address</label>
                          <input value={quickCustomer.address} onChange={e => setQuickCustomer(f => ({ ...f, address: e.target.value }))}
                            placeholder="Street address" style={smallInputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>City</label>
                          <input value={quickCustomer.city} onChange={e => setQuickCustomer(f => ({ ...f, city: e.target.value }))}
                            placeholder="City" style={smallInputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>State</label>
                          <select value={quickCustomer.state} onChange={e => setQuickCustomer(f => ({ ...f, state: e.target.value }))}
                            style={smallInputStyle}>
                            <option value="">Select state</option>
                            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Pincode</label>
                          <input value={quickCustomer.pincode} onChange={e => setQuickCustomer(f => ({ ...f, pincode: e.target.value }))}
                            placeholder="Pincode" style={smallInputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>GSTIN</label>
                          <input value={quickCustomer.gstin} onChange={e => setQuickCustomer(f => ({ ...f, gstin: e.target.value }))}
                            placeholder="GSTIN (optional)" style={smallInputStyle} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button type="button" onClick={handleQuickCreateCustomer} disabled={savingCustomer}
                          style={{
                            padding: '8px 16px', background: 'var(--success)', color: '#fff', border: 'none',
                            borderRadius: 2, fontSize: 12, fontWeight: 600, cursor: savingCustomer ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 4,
                            opacity: savingCustomer ? 0.6 : 1,
                          }}>
                          <Check size={12} /> {savingCustomer ? 'Saving...' : 'Save Customer'}
                        </button>
                        <button type="button" onClick={() => { setShowQuickCreate(false); setQuickCustomer(emptyCustomerForm()); }}
                          style={{
                            padding: '8px 16px', background: 'none', border: '1px solid var(--border-strong)',
                            borderRadius: 2, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
                            color: 'var(--text-secondary)',
                          }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Selected customer display */
                <div style={{
                  padding: 14, border: '1px solid var(--border-strong)', borderRadius: 2,
                  background: 'var(--bg-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                }}>
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{selectedCustomer.name}</div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 12 }}>
                      {selectedCustomer.address && <div>{selectedCustomer.address}</div>}
                      {(selectedCustomer.city || selectedCustomer.state || selectedCustomer.pincode) && (
                        <div>{[selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode].filter(Boolean).join(', ')}</div>
                      )}
                      {selectedCustomer.gstin && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>GSTIN: {selectedCustomer.gstin}</div>}
                      {selectedCustomer.phone && <div>Phone: {selectedCustomer.phone}</div>}
                      {selectedCustomer.email && <div>Email: {selectedCustomer.email}</div>}
                    </div>
                  </div>
                  <button type="button" onClick={clearCustomer}
                    style={{
                      padding: '6px 12px', background: 'none', border: '1px solid var(--border-strong)',
                      borderRadius: 2, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)',
                      color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                    }}>Change</button>
                </div>
              )}
            </div>

            {/* ── Line Items ── */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Line Items *</label>
              <div style={{
                border: '1px solid var(--border-strong)', borderRadius: 2, overflow: 'hidden',
              }}>
                {/* Header row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: invoiceType === 'gst'
                    ? '1fr 90px 60px 90px 70px 70px 90px 32px'
                    : '1fr 60px 90px 70px 90px 32px',
                  gap: 0, padding: '8px 10px', background: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}>
                  <div>Description</div>
                  {invoiceType === 'gst' && <div>HSN/SAC</div>}
                  <div>Qty</div>
                  <div>Rate</div>
                  <div>Disc %</div>
                  {invoiceType === 'gst' && <div>Tax %</div>}
                  <div style={{ textAlign: 'right' }}>Amount</div>
                  <div />
                </div>

                {/* Line item rows */}
                {computedLines.map((li, idx) => (
                  <div key={li.id} style={{
                    display: 'grid',
                    gridTemplateColumns: invoiceType === 'gst'
                      ? '1fr 90px 60px 90px 70px 70px 90px 32px'
                      : '1fr 60px 90px 70px 90px 32px',
                    gap: 0, padding: '6px 10px', alignItems: 'center',
                    borderBottom: idx < computedLines.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <div style={{ paddingRight: 6 }}>
                      <input value={li.description}
                        onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                        placeholder="Item description"
                        style={lineInputStyle} />
                    </div>
                    {invoiceType === 'gst' && (
                      <div style={{ paddingRight: 6 }}>
                        <input value={li.hsn_sac}
                          onChange={e => updateLineItem(li.id, 'hsn_sac', e.target.value)}
                          placeholder="HSN/SAC"
                          style={{ ...lineInputStyle, fontFamily: 'var(--font-mono)' }} />
                      </div>
                    )}
                    <div style={{ paddingRight: 6 }}>
                      <input type="number" min="0" step="any" value={li.quantity}
                        onChange={e => updateLineItem(li.id, 'quantity', e.target.value)}
                        style={{ ...lineInputStyle, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                    </div>
                    <div style={{ paddingRight: 6 }}>
                      <input type="number" min="0" step="0.01" value={li.rate}
                        onChange={e => updateLineItem(li.id, 'rate', e.target.value)}
                        placeholder="0.00"
                        style={{ ...lineInputStyle, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                    </div>
                    <div style={{ paddingRight: 6 }}>
                      <input type="number" min="0" max="100" step="0.01" value={li.discount_percent}
                        onChange={e => updateLineItem(li.id, 'discount_percent', e.target.value)}
                        placeholder="0"
                        style={{ ...lineInputStyle, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                    </div>
                    {invoiceType === 'gst' && (
                      <div style={{ paddingRight: 6 }}>
                        <select value={li.tax_rate}
                          onChange={e => updateLineItem(li.id, 'tax_rate', e.target.value)}
                          style={lineInputStyle}>
                          {TAX_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </div>
                    )}
                    <div style={{ textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--text-primary)', paddingRight: 6 }}>
                      {formatCurrency(li.lineTotal)}
                      {invoiceType === 'gst' && li.taxAmount > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                          tax: {formatCurrency(li.taxAmount)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      {lineItems.length > 1 && (
                        <button type="button" onClick={() => removeLineItem(li.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                          title="Remove item">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={addLineItem}
                style={{
                  marginTop: 8, padding: '8px 14px', background: 'none',
                  border: '1px dashed var(--border-strong)', borderRadius: 2,
                  fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
                  color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: 4,
                  fontWeight: 500,
                }}>
                <Plus size={12} /> Add Item
              </button>
            </div>

            {/* ── Place of Supply (GST only) ── */}
            {invoiceType === 'gst' && (
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Place of Supply</label>
                <select value={placeOfSupply}
                  onChange={e => setPlaceOfSupply(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 320 }}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Determines whether CGST+SGST or IGST applies
                </div>
              </div>
            )}

            {/* ── Totals ── */}
            <div style={{
              marginBottom: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 2,
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320, marginLeft: 'auto' }}>
                <TotalRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
                {totals.discountTotal > 0 && (
                  <TotalRow label="Discount" value={`-${formatCurrency(totals.discountTotal)}`} color="var(--error)" />
                )}
                {invoiceType === 'gst' && totals.taxTotal > 0 && (
                  <>
                    {totals.isSameState ? (
                      <>
                        <TotalRow label="CGST" value={formatCurrency(totals.cgst)} />
                        <TotalRow label="SGST" value={formatCurrency(totals.sgst)} />
                      </>
                    ) : (
                      <TotalRow label="IGST" value={formatCurrency(totals.igst)} />
                    )}
                  </>
                )}
                {totals.roundOff !== 0 && (
                  <TotalRow label="Round-off" value={(totals.roundOff >= 0 ? '+' : '') + formatCurrency(totals.roundOff)} />
                )}
                <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: 8, marginTop: 4 }}>
                  <TotalRow label="Grand Total" value={`INR ${formatCurrency(totals.grandTotal)}`} bold />
                </div>
              </div>
            </div>

            {/* ── Invoice Metadata ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>Invoice Date *</label>
                <input type="date" value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input type="date" value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  style={inputStyle} />
              </div>
            </div>

            {/* ── Payment Section ── */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Payment Status</label>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                {[
                  { key: 'paid', label: 'Paid' },
                  { key: 'partial', label: 'Partially Paid' },
                  { key: 'unpaid', label: 'Unpaid' },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    <input type="radio" name="paymentStatus" value={key}
                      checked={paymentStatus === key}
                      onChange={() => setPaymentStatus(key)} />
                    {label}
                  </label>
                ))}
              </div>

              {paymentStatus !== 'unpaid' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>
                      {paymentStatus === 'paid' ? 'Amount Paid' : 'Amount Paid *'}
                    </label>
                    <input type="number" step="0.01" value={amountPaid}
                      onChange={e => setAmountPaid(e.target.value)}
                      placeholder="0.00"
                      style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                      readOnly={paymentStatus === 'paid'}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Account *</label>
                    <select value={paymentAccountId}
                      onChange={e => setPaymentAccountId(e.target.value)}
                      style={inputStyle}>
                      <option value="">Select account</option>
                      {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Payment Date</label>
                    <input type="date" value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Payment Method</label>
                    <select value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      style={inputStyle}>
                      <option value="">Select method</option>
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* ── Notes ── */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Notes</label>
              <textarea value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3} placeholder="Optional notes or terms..."
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {/* ── Error ── */}
            {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

            {/* ── Actions ── */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" disabled={saving}
                style={{
                  background: 'var(--brand-primary)', color: '#fff', border: 'none',
                  padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                  opacity: saving ? 0.6 : 1,
                }}>
                {saving ? 'Saving...' : isEdit ? 'Update Invoice' : 'Save Invoice'}
              </button>
              <button type="button" onClick={onClose}
                style={{
                  background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                  padding: '10px 24px', borderRadius: 2, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}>Cancel</button>
            </div>
          </form>
        </div>
      </div>

      {/* Spin keyframe for loading spinners */}
      <style>{`.spin { animation: spin-anim 1s linear infinite; } @keyframes spin-anim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Helper Components ── */

function TotalRow({ label, value, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{
        fontSize: bold ? 14 : 12, fontWeight: bold ? 700 : 400,
        color: color || 'var(--text-secondary)',
      }}>{label}</span>
      <span style={{
        fontSize: bold ? 16 : 13, fontWeight: bold ? 700 : 500,
        fontFamily: 'var(--font-mono)', color: color || 'var(--text-primary)',
      }}>{value}</span>
    </div>
  );
}

/* ── Shared Styles ── */

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)',
  borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)',
};

const smallInputStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--border-strong)',
  borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)',
};

const lineInputStyle = {
  width: '100%', padding: '6px 8px', border: '1px solid var(--border-subtle)',
  borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none',
  background: 'transparent',
};

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
};

const quickAddBtnStyle = {
  padding: '0 10px', border: '1px solid var(--border-strong)', borderRadius: 2,
  background: 'var(--bg-primary)', cursor: 'pointer', color: 'var(--accent-1)',
  display: 'flex', alignItems: 'center',
};
