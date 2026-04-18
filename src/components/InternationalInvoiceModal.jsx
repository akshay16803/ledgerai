import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '../lib/api';
import { getCountryConfig, calculateCountryTax, formatCountryCurrency } from '../lib/countryConfig';
import { X, Plus, Trash, Receipt, SpinnerGap, Check, MagnifyingGlass, CaretDown, Warning, FileText, CurrencyDollar, Users, Notebook } from '@phosphor-icons/react';

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque / Check' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'wire', label: 'Wire Transfer' },
  { value: 'other', label: 'Other' },
];

function emptyLineItem(defaultTaxRate = 0) {
  return {
    id: Date.now() + Math.random(),
    description: '',
    quantity: 1,
    rate: '',
    discount_percent: '',
    tax_rate: defaultTaxRate,
    custom_tax_rate: '',
  };
}

function emptyPartyForm() {
  return { name: '', address: '', city: '', region: '', tax_id: '' };
}

export function InternationalInvoiceModal({ mode = 'sales', invoice, bill, accounts, countryCode, onSave, onClose }) {
  const config = getCountryConfig(countryCode);
  const isSales = mode === 'sales';
  const existing = isSales ? invoice : bill;
  const isEdit = !!existing;
  const hasTax = config.hasTaxInvoice !== false;

  // Invoice type
  const [invoiceType, setInvoiceType] = useState(() => {
    if (existing) {
      const t = isSales ? existing.invoice_type : existing.bill_type;
      return t || 'simple';
    }
    return 'simple';
  });

  // Party (customer or vendor)
  const partyLabel = isSales ? (config.customerLabel || 'Customer') : (config.vendorLabel || 'Vendor');
  const partyApiBase = isSales ? '/api/customers' : '/api/vendors';
  const partyIdField = isSales ? 'customer_id' : 'vendor_id';

  const [partyQuery, setPartyQuery] = useState('');
  const [partyResults, setPartyResults] = useState([]);
  const [searchingParty, setSearchingParty] = useState(false);
  const [selectedParty, setSelectedParty] = useState(() => {
    if (existing) {
      const party = isSales ? existing.customer : existing.vendor;
      if (party) return party;
      // Fallback: construct from fields
      const name = isSales ? existing.customer_name : existing.vendor_name;
      if (name) {
        return {
          id: existing[partyIdField],
          name,
          gstin: isSales ? existing.customer_gstin : existing.vendor_gstin,
          state: isSales ? existing.customer_state : existing.vendor_state,
        };
      }
    }
    return null;
  });
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickParty, setQuickParty] = useState(emptyPartyForm());
  const [savingParty, setSavingParty] = useState(false);
  const searchTimerRef = useRef(null);
  const partyDropdownRef = useRef(null);

  // Line items
  const [lineItems, setLineItems] = useState(() => {
    if (existing?.line_items?.length) {
      return existing.line_items.map((li, i) => ({
        id: li.id || Date.now() + i,
        description: li.description || '',
        quantity: li.quantity ?? 1,
        rate: li.rate ?? '',
        discount_percent: li.discount_percent ?? '',
        tax_rate: li.gst_rate ?? li.tax_rate ?? config.defaultTaxRate,
        custom_tax_rate: '',
      }));
    }
    return [emptyLineItem(config.defaultTaxRate)];
  });

  // Metadata
  const [docDate, setDocDate] = useState(() => {
    const d = isSales ? existing?.invoice_date : existing?.bill_date;
    return d || new Date().toISOString().split('T')[0];
  });
  const [dueDate, setDueDate] = useState(existing?.due_date || '');
  const [billReference, setBillReference] = useState(existing?.bill_reference || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [termsConditions, setTermsConditions] = useState(existing?.terms_conditions || '');

  // Payment
  const [paymentStatus, setPaymentStatus] = useState(existing?.payment_status || 'unpaid');
  const [amountPaid, setAmountPaid] = useState(existing?.amount_paid ?? '');
  const [paymentAccountId, setPaymentAccountId] = useState(existing?.payment_account_id || '');
  const [paymentDate, setPaymentDate] = useState(existing?.payment_date || new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState(existing?.payment_method || '');

  // UI state
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Close party dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (partyDropdownRef.current && !partyDropdownRef.current.contains(e.target)) {
        setPartyResults([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Party search with debounce
  const handlePartySearch = useCallback((value) => {
    setPartyQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      setPartyResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchingParty(true);
      try {
        const results = await api.get(`${partyApiBase}?q=${encodeURIComponent(value.trim())}`, { bypassCache: true });
        setPartyResults(Array.isArray(results) ? results : []);
      } catch {
        setPartyResults([]);
      } finally {
        setSearchingParty(false);
      }
    }, 300);
  }, [partyApiBase]);

  const selectParty = (party) => {
    setSelectedParty(party);
    setPartyQuery('');
    setPartyResults([]);
    setShowQuickCreate(false);
  };

  const clearParty = () => {
    setSelectedParty(null);
    setPartyQuery('');
  };

  const handleQuickCreateParty = async () => {
    if (!quickParty.name.trim()) return;
    setSavingParty(true);
    try {
      const created = await api.post(partyApiBase, {
        name: quickParty.name.trim(),
        address: quickParty.address || null,
        city: quickParty.city || null,
        state: quickParty.region || null,
        gstin: quickParty.tax_id || null,
      });
      selectParty(created);
      setQuickParty(emptyPartyForm());
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingParty(false);
    }
  };

  // Line item helpers
  const updateLineItem = (id, field, value) => {
    setLineItems(items => items.map(li => li.id === id ? { ...li, [field]: value } : li));
  };

  const addLineItem = () => {
    setLineItems(items => [...items, emptyLineItem(config.defaultTaxRate)]);
  };

  const removeLineItem = (id) => {
    setLineItems(items => items.length > 1 ? items.filter(li => li.id !== id) : items);
  };

  // Resolve effective tax rate for a line item (handles custom rates)
  const getEffectiveTaxRate = useCallback((li) => {
    if (invoiceType !== 'tax') return 0;
    const selectedRate = config.taxRates?.find(r => String(r.rate) === String(li.tax_rate));
    if (selectedRate?.customRate && config.supportsCustomTaxRate) {
      return parseFloat(li.custom_tax_rate) || 0;
    }
    return parseFloat(li.tax_rate) || 0;
  }, [invoiceType, config]);

  // Calculations
  const computedLines = useMemo(() => {
    return lineItems.map(li => {
      const qty = parseFloat(li.quantity) || 0;
      const rate = parseFloat(li.rate) || 0;
      const discountPct = parseFloat(li.discount_percent) || 0;
      const lineSubtotal = qty * rate;
      const discountAmt = lineSubtotal * (discountPct / 100);
      const taxableAmount = lineSubtotal - discountAmt;
      const taxRate = getEffectiveTaxRate(li);
      const taxAmount = taxableAmount * (taxRate / 100);
      const lineTotal = taxableAmount + taxAmount;
      return { ...li, lineSubtotal, discountAmt, taxableAmount, taxRate, taxAmount, lineTotal };
    });
  }, [lineItems, getEffectiveTaxRate]);

  const totals = useMemo(() => {
    // Build items for calculateCountryTax
    const items = computedLines.map(li => ({
      quantity: parseFloat(li.quantity) || 0,
      rate: parseFloat(li.rate) || 0,
      discount_percent: parseFloat(li.discount_percent) || 0,
      tax_rate: li.taxRate,
    }));
    const result = calculateCountryTax(items, countryCode, invoiceType);
    return result;
  }, [computedLines, countryCode, invoiceType]);

  // When payment status changes to paid, default amount to grand total
  useEffect(() => {
    if (paymentStatus === 'paid') {
      setAmountPaid(totals.grandTotal || '');
    }
  }, [paymentStatus, totals.grandTotal]);

  const fmtCurrency = useCallback((val) => {
    return formatCountryCurrency(parseFloat(val) || 0, countryCode);
  }, [countryCode]);

  // Validation and submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedParty) {
      setError(`Please select or create a ${partyLabel.toLowerCase()}`);
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
      const partyId = selectedParty[partyIdField] || selectedParty.customer_id || selectedParty.vendor_id || selectedParty.id;
      const partyName = selectedParty.name;
      const partyTaxId = selectedParty.gstin || selectedParty.tax_id || quickParty.tax_id || '';
      const partyRegion = selectedParty.state || selectedParty.region || '';

      const linePayload = validLines.map(li => ({
        description: li.description.trim(),
        hsn_sac: '',
        quantity: parseFloat(li.quantity) || 1,
        rate: parseFloat(li.rate) || 0,
        discount_percent: parseFloat(li.discount_percent) || 0,
        gst_rate: getEffectiveTaxRate(li),
      }));

      const payload = {
        payment_status: paymentStatus,
        amount_paid: paymentStatus !== 'unpaid' ? parseFloat(amountPaid) || 0 : 0,
        payment_account_id: paymentStatus !== 'unpaid' ? paymentAccountId : null,
        payment_date: paymentStatus !== 'unpaid' ? paymentDate : null,
        payment_method: paymentStatus !== 'unpaid' ? paymentMethod : null,
        line_items: linePayload,
        place_of_supply: null,
        notes: notes || null,
        terms_conditions: termsConditions || null,
      };

      if (isSales) {
        payload.invoice_type = invoiceType;
        payload.customer_id = partyId;
        payload.customer_name = partyName;
        payload.customer_gstin = partyTaxId;
        payload.customer_state = partyRegion;
        payload.invoice_date = docDate;
        payload.due_date = dueDate || null;
      } else {
        payload.bill_type = invoiceType;
        payload.vendor_id = partyId;
        payload.vendor_name = partyName;
        payload.vendor_gstin = partyTaxId;
        payload.vendor_state = partyRegion;
        payload.bill_date = docDate;
        payload.due_date = dueDate || null;
        payload.bill_reference = billReference || null;
      }

      const apiBase = isSales ? '/api/invoices' : '/api/bills';
      const docId = existing?.invoice_id || existing?.bill_id || existing?.id;

      if (isEdit) {
        await api.put(`${apiBase}/${docId}`, payload);
      } else {
        await api.post(apiBase, payload);
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Determine which invoice type tabs to show
  const tabs = [];
  tabs.push({ key: 'simple', label: config.simpleInvoiceLabel || 'Invoice' });
  if (hasTax) {
    tabs.push({ key: 'tax', label: config.taxInvoiceLabel || 'Tax Invoice' });
  }

  const isTaxInvoice = invoiceType === 'tax';

  // Grid columns for line items
  const lineGridCols = isTaxInvoice
    ? config.supportsCustomTaxRate
      ? '1fr 60px 90px 70px 80px 80px 90px 32px'
      : '1fr 60px 90px 70px 80px 90px 32px'
    : '1fr 60px 90px 70px 90px 32px';

  const modalTitle = (() => {
    const docWord = isSales ? 'Invoice' : 'Bill';
    const action = isEdit ? 'Edit' : 'New';
    return `${action} ${config.name} ${docWord}`;
  })();

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
          <h2 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} weight="duotone" style={{ color: 'var(--brand-primary)' }} />
            {modalTitle}
          </h2>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {/* Invoice Type Toggle */}
          {tabs.length > 1 && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
              {tabs.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setInvoiceType(key)}
                  style={{
                    padding: '10px 20px', border: 'none',
                    borderBottom: invoiceType === key ? '2px solid var(--brand-primary)' : '2px solid transparent',
                    background: 'transparent', cursor: 'pointer', fontSize: 14,
                    fontWeight: invoiceType === key ? 600 : 400,
                    color: invoiceType === key ? 'var(--brand-primary)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s',
                  }}>
                  <Receipt size={16} weight={invoiceType === key ? 'bold' : 'regular'} /> {label}
                </button>
              ))}
            </div>
          )}

          {/* If only simple tab (e.g. Hong Kong), show a subtle note */}
          {!hasTax && (
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, padding: '8px 12px',
              background: 'var(--bg-secondary)', borderRadius: 2,
            }}>
              {config.name} does not have a tax system. All invoices are created without tax.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* ── Customer/Vendor Section ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...sectionHeaderStyle }}>
                <Users size={14} weight="duotone" style={{ color: 'var(--brand-primary)' }} />
                {partyLabel} Details
              </div>
              <label style={labelStyle}>{partyLabel} *</label>
              {!selectedParty ? (
                <div ref={partyDropdownRef} style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <MagnifyingGlass size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        value={partyQuery}
                        onChange={e => handlePartySearch(e.target.value)}
                        placeholder={`Search ${partyLabel.toLowerCase()}s by name...`}
                        style={{ ...inputStyle, paddingLeft: 32 }}
                      />
                      {searchingParty && (
                        <SpinnerGap size={14} className="spin" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      )}
                    </div>
                    <button type="button" onClick={() => setShowQuickCreate(!showQuickCreate)}
                      style={quickAddBtnStyle} title={`Quick create ${partyLabel.toLowerCase()}`}>
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Search results dropdown */}
                  {partyResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                      background: '#fff', border: '1px solid var(--border-strong)', borderRadius: 2,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflow: 'auto', marginTop: 2,
                    }}>
                      {partyResults.map(p => {
                        const pid = p.customer_id || p.vendor_id || p.id;
                        return (
                          <button key={pid} type="button"
                            onClick={() => selectParty(p)}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                              border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
                              fontFamily: 'var(--font-body)', borderBottom: '1px solid var(--border-subtle)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                          >
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</div>
                            {(p.city || p.gstin || p.state) && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                {[p.city, p.state, p.gstin].filter(Boolean).join(' | ')}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Quick create form */}
                  {showQuickCreate && (
                    <div style={{ marginTop: 12, padding: 16, border: '1px solid var(--border-strong)', borderRadius: 2, background: 'var(--bg-primary)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
                        Quick Create {partyLabel}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={labelStyle}>Name *</label>
                          <input value={quickParty.name} onChange={e => setQuickParty(f => ({ ...f, name: e.target.value }))}
                            placeholder={`${partyLabel} name`} style={smallInputStyle} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={labelStyle}>Address</label>
                          <input value={quickParty.address} onChange={e => setQuickParty(f => ({ ...f, address: e.target.value }))}
                            placeholder="Street address" style={smallInputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>City</label>
                          <input value={quickParty.city} onChange={e => setQuickParty(f => ({ ...f, city: e.target.value }))}
                            placeholder="City" style={smallInputStyle} />
                        </div>
                        {config.regions && config.regions.length > 0 ? (
                          <div>
                            <label style={labelStyle}>{config.regionLabel || 'Region'}</label>
                            <select value={quickParty.region} onChange={e => setQuickParty(f => ({ ...f, region: e.target.value }))}
                              style={smallInputStyle}>
                              <option value="">Select {(config.regionLabel || 'region').toLowerCase()}</option>
                              {config.regions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label style={labelStyle}>Region</label>
                            <input value={quickParty.region} onChange={e => setQuickParty(f => ({ ...f, region: e.target.value }))}
                              placeholder="Region / State" style={smallInputStyle} />
                          </div>
                        )}
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={labelStyle}>{config.taxIdLabel || 'Tax ID'}</label>
                          <input value={quickParty.tax_id}
                            onChange={e => setQuickParty(f => ({ ...f, tax_id: e.target.value }))}
                            placeholder={config.taxIdPlaceholder || 'Tax identification number'}
                            maxLength={config.taxIdMaxLength || 30}
                            style={smallInputStyle} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button type="button" onClick={handleQuickCreateParty} disabled={savingParty}
                          style={{
                            padding: '8px 16px', background: 'var(--success)', color: '#fff', border: 'none',
                            borderRadius: 2, fontSize: 12, fontWeight: 600, cursor: savingParty ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 4,
                            opacity: savingParty ? 0.6 : 1,
                          }}>
                          <Check size={12} /> {savingParty ? 'Saving...' : `Save ${partyLabel}`}
                        </button>
                        <button type="button" onClick={() => { setShowQuickCreate(false); setQuickParty(emptyPartyForm()); }}
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
                /* Selected party display */
                <div style={{
                  padding: 14, border: '1px solid var(--border-strong)', borderRadius: 2,
                  background: 'var(--bg-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                }}>
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{selectedParty.name}</div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 12 }}>
                      {selectedParty.address && <div>{selectedParty.address}</div>}
                      {(selectedParty.city || selectedParty.state) && (
                        <div>{[selectedParty.city, selectedParty.state].filter(Boolean).join(', ')}</div>
                      )}
                      {selectedParty.gstin && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          {config.taxIdLabel || 'Tax ID'}: {selectedParty.gstin}
                        </div>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={clearParty}
                    style={{
                      padding: '6px 12px', background: 'none', border: '1px solid var(--border-strong)',
                      borderRadius: 2, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)',
                      color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                    }}>Change</button>
                </div>
              )}
            </div>

            {/* ── Invoice Metadata ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...sectionHeaderStyle }}>
                <Receipt size={14} weight="duotone" style={{ color: 'var(--brand-primary)' }} />
                {isSales ? 'Invoice' : 'Bill'} Details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: !isSales ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>{isSales ? 'Invoice Date' : 'Bill Date'} *</label>
                  <input type="date" value={docDate}
                    onChange={e => setDocDate(e.target.value)}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Due Date</label>
                  <input type="date" value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    style={inputStyle} />
                </div>
                {!isSales && (
                  <div>
                    <label style={labelStyle}>Reference Number</label>
                    <input value={billReference}
                      onChange={e => setBillReference(e.target.value)}
                      placeholder="Vendor invoice/ref #"
                      style={inputStyle} />
                  </div>
                )}
              </div>
            </div>

            {/* ── Line Items ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...sectionHeaderStyle }}>
                <Notebook size={14} weight="duotone" style={{ color: 'var(--brand-primary)' }} />
                Line Items
              </div>
              <div style={{
                border: '1px solid var(--border-strong)', borderRadius: 2, overflow: 'hidden',
              }}>
                {/* Header row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: lineGridCols,
                  gap: 0, padding: '8px 10px', background: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}>
                  <div>Description</div>
                  <div>Qty</div>
                  <div>Rate</div>
                  <div>Disc %</div>
                  {isTaxInvoice && <div>Tax %</div>}
                  {isTaxInvoice && config.supportsCustomTaxRate && <div>Custom %</div>}
                  <div style={{ textAlign: 'right' }}>Amount</div>
                  <div />
                </div>

                {/* Line item rows */}
                {computedLines.map((li, idx) => {
                  const selectedTaxOption = config.taxRates?.find(r => String(r.rate) === String(li.tax_rate));
                  const showCustomInput = isTaxInvoice && config.supportsCustomTaxRate && selectedTaxOption?.customRate;

                  return (
                    <div key={li.id} style={{
                      display: 'grid', gridTemplateColumns: lineGridCols,
                      gap: 0, padding: '6px 10px', alignItems: 'center',
                      borderBottom: idx < computedLines.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}>
                      <div style={{ paddingRight: 6 }}>
                        <input value={li.description}
                          onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                          placeholder="Item description"
                          style={lineInputStyle} />
                      </div>
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
                      {isTaxInvoice && (
                        <div style={{ paddingRight: 6 }}>
                          <select value={li.tax_rate}
                            onChange={e => updateLineItem(li.id, 'tax_rate', e.target.value)}
                            style={lineInputStyle}>
                            {config.taxRates.map((tr, i) => (
                              <option key={i} value={tr.rate ?? ''}>
                                {tr.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {isTaxInvoice && config.supportsCustomTaxRate && (
                        <div style={{ paddingRight: 6 }}>
                          {showCustomInput ? (
                            <input type="number" min="0" max="100" step="0.01"
                              value={li.custom_tax_rate}
                              onChange={e => updateLineItem(li.id, 'custom_tax_rate', e.target.value)}
                              placeholder={config.customTaxRateLabel || '%'}
                              title={config.customTaxRateHint || ''}
                              style={{ ...lineInputStyle, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px', display: 'block' }}>--</span>
                          )}
                        </div>
                      )}
                      <div style={{ textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--text-primary)', paddingRight: 6 }}>
                        {fmtCurrency(li.lineTotal)}
                        {isTaxInvoice && li.taxAmount > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                            tax: {fmtCurrency(li.taxAmount)}
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
                  );
                })}
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

            {/* ── Totals ── */}
            <div style={{
              marginBottom: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 2,
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360, marginLeft: 'auto' }}>
                <TotalRow label={config.printLabels?.subtotal || 'Subtotal'} value={fmtCurrency(totals.subtotal)} />
                {totals.subtotal > 0 && computedLines.some(l => l.discountAmt > 0) && (
                  <TotalRow
                    label={config.printLabels?.discount || 'Discount'}
                    value={`-${fmtCurrency(computedLines.reduce((s, l) => s + l.discountAmt, 0))}`}
                    color="var(--error)" />
                )}
                {isTaxInvoice && totals.totalTax > 0 && (
                  <>
                    {config.taxBreakdown === 'per_rate' && totals.taxBreakdown.length > 0 ? (
                      totals.taxBreakdown.map((b, i) => (
                        <TotalRow
                          key={i}
                          label={`${config.printLabels?.taxLine || config.taxSystem || 'Tax'} @ ${b.rate}%`}
                          value={fmtCurrency(b.tax)}
                        />
                      ))
                    ) : (
                      <TotalRow
                        label={config.printLabels?.taxLine || config.taxSystem || 'Tax'}
                        value={fmtCurrency(totals.totalTax)}
                      />
                    )}
                  </>
                )}
                <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: 8, marginTop: 4 }}>
                  <TotalRow
                    label={config.printLabels?.total || 'Grand Total'}
                    value={fmtCurrency(totals.grandTotal)}
                    bold
                  />
                </div>
              </div>
            </div>

            {/* ── Payment Section ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...sectionHeaderStyle }}>
                <CurrencyDollar size={14} weight="duotone" style={{ color: 'var(--brand-primary)' }} />
                Payment
              </div>
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
                      {(accounts || []).map(a => (
                        <option key={a.account_id || a.id} value={a.account_id || a.id}>{a.name}</option>
                      ))}
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

            {/* ── Notes & Terms ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>{config.printLabels?.notes || 'Notes'}</label>
                  <textarea value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3} placeholder="Optional notes..."
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={labelStyle}>{config.printLabels?.paymentTerms || 'Terms & Conditions'}</label>
                  <textarea value={termsConditions}
                    onChange={e => setTermsConditions(e.target.value)}
                    rows={3} placeholder="Payment terms, conditions..."
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            </div>

            {/* ── Error ── */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 16,
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 2,
                color: 'var(--error)', fontSize: 13,
              }}>
                <Warning size={16} weight="duotone" />
                {error}
              </div>
            )}

            {/* ── Actions ── */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" disabled={saving}
                style={{
                  background: 'var(--brand-primary)', color: '#fff', border: 'none',
                  padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                  opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                {saving && <SpinnerGap size={14} className="spin" />}
                {saving ? 'Saving...' : isEdit ? `Update ${isSales ? 'Invoice' : 'Bill'}` : `Save ${isSales ? 'Invoice' : 'Bill'}`}
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

const sectionHeaderStyle = {
  fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase',
  letterSpacing: '0.03em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
};

const quickAddBtnStyle = {
  padding: '0 10px', border: '1px solid var(--border-strong)', borderRadius: 2,
  background: 'var(--bg-primary)', cursor: 'pointer', color: 'var(--accent-1)',
  display: 'flex', alignItems: 'center',
};
