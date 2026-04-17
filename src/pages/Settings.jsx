import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Check, Globe, CalendarBlank, Buildings, Bank, Warning, ArrowLeft, Receipt } from '@phosphor-icons/react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QR' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '15/04/2026' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '04/15/2026' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-04-15' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY', example: '15-04-2026' },
  { value: 'DD MMM YYYY', label: 'DD MMM YYYY', example: '15 Apr 2026' },
];

export default function Settings() {
  const { user, checkAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceSectionRef = useRef(null);

  // setup=invoice means user was redirected to fill simple invoice fields
  // setup=gst means user tried GST invoice and needs GSTIN + state
  const setupMode = searchParams.get('setup'); // 'invoice' | 'gst' | null

  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  // Business / Firm fields
  const [firmName, setFirmName] = useState('');
  const [firmAddress, setFirmAddress] = useState('');
  const [firmCity, setFirmCity] = useState('');
  const [firmState, setFirmState] = useState('');
  const [firmPincode, setFirmPincode] = useState('');
  const [firmGstin, setFirmGstin] = useState('');
  const [firmPan, setFirmPan] = useState('');
  const [firmPhone, setFirmPhone] = useState('');
  const [firmEmail, setFirmEmail] = useState('');
  // Invoice bank details
  const [invoiceBankName, setInvoiceBankName] = useState('');
  const [invoiceBankAccountNo, setInvoiceBankAccountNo] = useState('');
  const [invoiceBankIfsc, setInvoiceBankIfsc] = useState('');
  const [invoiceBankBranch, setInvoiceBankBranch] = useState('');
  // Invoice settings
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [invoiceTerms, setInvoiceTerms] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/settings').then(s => {
      setBaseCurrency(s.base_currency || 'INR');
      setDateFormat(s.date_format || 'DD/MM/YYYY');
      setFirmName(s.firm_name || '');
      setFirmAddress(s.firm_address || '');
      setFirmCity(s.firm_city || '');
      setFirmState(s.firm_state || '');
      setFirmPincode(s.firm_pincode || '');
      setFirmGstin(s.firm_gstin || '');
      setFirmPan(s.firm_pan || '');
      setFirmPhone(s.firm_phone || '');
      setFirmEmail(s.firm_email || '');
      setInvoiceBankName(s.invoice_bank_name || '');
      setInvoiceBankAccountNo(s.invoice_bank_account_no || '');
      setInvoiceBankIfsc(s.invoice_bank_ifsc || '');
      setInvoiceBankBranch(s.invoice_bank_branch || '');
      setInvoicePrefix(s.invoice_prefix || 'INV-');
      setInvoiceTerms(s.invoice_terms || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Auto-scroll to invoice settings section when in setup mode
  useEffect(() => {
    if (setupMode && !loading && invoiceSectionRef.current) {
      setTimeout(() => {
        invoiceSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [setupMode, loading]);

  // Validate required fields for setup modes
  const simpleFieldsMissing = !firmName.trim();
  const gstFieldsMissing = !firmGstin.trim() || !firmState;

  const handleSave = async () => {
    // In setup mode, validate required fields before saving
    if (setupMode === 'invoice' && simpleFieldsMissing) {
      alert('Please fill in your Firm / Business Name to create invoices.');
      return;
    }
    if (setupMode === 'gst' && (simpleFieldsMissing || gstFieldsMissing)) {
      const missing = [];
      if (!firmName.trim()) missing.push('Firm / Business Name');
      if (!firmGstin.trim()) missing.push('GSTIN');
      if (!firmState) missing.push('State');
      alert(`Please fill in: ${missing.join(', ')}`);
      return;
    }

    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/settings', {
        base_currency: baseCurrency, date_format: dateFormat,
        firm_name: firmName, firm_address: firmAddress, firm_city: firmCity,
        firm_state: firmState, firm_pincode: firmPincode, firm_gstin: firmGstin,
        firm_pan: firmPan, firm_phone: firmPhone, firm_email: firmEmail,
        invoice_bank_name: invoiceBankName, invoice_bank_account_no: invoiceBankAccountNo,
        invoice_bank_ifsc: invoiceBankIfsc, invoice_bank_branch: invoiceBankBranch,
        invoice_prefix: invoicePrefix, invoice_terms: invoiceTerms,
      });
      setSaved(true);
      checkAuth();
      // If in setup mode, redirect back to invoices after a brief confirmation
      if (setupMode) {
        setTimeout(() => navigate('/invoices'), 800);
        return;
      }
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { alert(err.message); } finally { setSaving(false); }
  };

  const selectedCurrency = CURRENCIES.find(c => c.code === baseCurrency);

  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 };
  const fieldStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2,
    fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff', boxSizing: 'border-box',
  };
  // Highlighted border for empty required fields in setup mode
  const requiredFieldStyle = (value, mode = 'invoice') => {
    const isRequired = setupMode === mode || setupMode === 'gst';
    const isEmpty = typeof value === 'string' ? !value.trim() : !value;
    if (isRequired && isEmpty) {
      return { ...fieldStyle, borderColor: 'var(--brand-primary)', boxShadow: '0 0 0 1px rgba(194,109,92,0.2)' };
    }
    return fieldStyle;
  };
  const requiredStar = <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}> *</span>;

  if (loading) return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>Loading settings...</div>;

  return (
    <div data-testid="settings-page">
      <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>Settings</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
        Configure your preferences for SpentyAI.
      </p>

      {/* Profile Section */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: 28, marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Profile</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user?.picture ? (
            <img src={user.picture} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'var(--text-muted)' }}>
              {user?.name?.[0] || '?'}
            </div>
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Currency Section */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: 28, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Globe size={18} weight="duotone" style={{ color: 'var(--info)' }} />
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Default Currency</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          All transactions will be recorded in this currency. Foreign currency transactions will be automatically converted.
        </p>
        <select
          data-testid="currency-select"
          value={baseCurrency}
          onChange={e => setBaseCurrency(e.target.value)}
          style={{
            width: '100%', maxWidth: 400, padding: '12px 16px',
            border: '1px solid var(--border-strong)', borderRadius: 2,
            fontSize: 14, fontFamily: 'var(--font-body)', background: '#fff',
          }}
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
          ))}
        </select>
        {selectedCurrency && (
          <div className="mono" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Example: {selectedCurrency.symbol}1,00,000
          </div>
        )}
      </div>

      {/* Date Format Section */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: 28, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <CalendarBlank size={18} weight="duotone" style={{ color: 'var(--info)' }} />
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Date Format</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Choose how dates are displayed across the app.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {DATE_FORMATS.map(df => (
            <button
              key={df.value}
              data-testid={`date-format-${df.value}`}
              onClick={() => setDateFormat(df.value)}
              style={{
                padding: '12px 20px', borderRadius: 2, cursor: 'pointer',
                border: dateFormat === df.value ? '2px solid var(--brand-primary)' : '1px solid var(--border-strong)',
                background: dateFormat === df.value ? 'rgba(194,109,92,0.06)' : '#fff',
                fontFamily: 'var(--font-body)', fontSize: 13,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ fontWeight: 600, color: dateFormat === df.value ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                {df.label}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{df.example}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Settings — consolidated section */}
      <div ref={invoiceSectionRef} style={{
        background: '#fff', border: setupMode ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)', borderRadius: 2,
        padding: 28, marginBottom: 24,
        transition: 'border-color 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Buildings size={18} weight="duotone" style={{ color: 'var(--info)' }} />
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Invoice Settings</h2>
        </div>

        {/* Setup mode banners */}
        {setupMode === 'invoice' && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px', marginBottom: 20,
            background: 'rgba(194,109,92,0.06)', border: '1px solid rgba(194,109,92,0.2)', borderRadius: 4,
          }}>
            <Receipt size={20} weight="duotone" style={{ color: 'var(--brand-primary)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Set up your business details to create invoices
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Fill in the fields marked with <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>*</span> below. These details will appear on every invoice you create. You only need to do this once — you can always come back and edit them later.
              </div>
            </div>
          </div>
        )}
        {setupMode === 'gst' && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px', marginBottom: 20,
            background: 'rgba(74,110,125,0.06)', border: '1px solid rgba(74,110,125,0.2)', borderRadius: 4,
          }}>
            <Warning size={20} weight="duotone" style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                GST invoices need a few more details
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                To create GST-compliant invoices, fill in your <strong>GSTIN</strong> and <strong>State</strong> below. These are needed to calculate CGST/SGST vs IGST correctly. Fields marked with <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>*</span> are required.
              </div>
            </div>
          </div>
        )}

        {!setupMode && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            Fill in your business details, bank account, and invoice preferences. These will appear on every invoice you create — fill once and forget.
          </p>
        )}

        {/* Firm / Trade Name & Contact */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Firm / Trade Name & Contact
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 700 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Firm / Business Name{setupMode && requiredStar} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— shown as invoice header</span></label>
              <input data-testid="firm-name" value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="e.g. Niprasha Technologies Pvt. Ltd." style={requiredFieldStyle(firmName, 'invoice')} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Address</label>
              <input data-testid="firm-address" value={firmAddress} onChange={e => setFirmAddress(e.target.value)} placeholder="Street address, building, floor" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input data-testid="firm-city" value={firmCity} onChange={e => setFirmCity(e.target.value)} placeholder="e.g. Mumbai" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>State / UT{setupMode === 'gst' && requiredStar} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{setupMode === 'gst' ? '— needed for GST calculation' : ''}</span></label>
              <select data-testid="firm-state" value={firmState} onChange={e => setFirmState(e.target.value)} style={setupMode === 'gst' ? requiredFieldStyle(firmState, 'gst') : fieldStyle}>
                <option value="">Select state</option>
                {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Pincode</label>
              <input data-testid="firm-pincode" value={firmPincode} onChange={e => setFirmPincode(e.target.value)} placeholder="e.g. 400001" maxLength={6} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input data-testid="firm-phone" value={firmPhone} onChange={e => setFirmPhone(e.target.value)} placeholder="+91 98765 43210" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input data-testid="firm-email" value={firmEmail} onChange={e => setFirmEmail(e.target.value)} placeholder="billing@yourfirm.com" type="email" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>GSTIN{setupMode === 'gst' && requiredStar} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{setupMode === 'gst' ? '— required for GST invoices' : '— for GST invoices'}</span></label>
              <input data-testid="firm-gstin" value={firmGstin} onChange={e => setFirmGstin(e.target.value.toUpperCase())} placeholder="e.g. 27AABCU9603R1ZM" maxLength={15} style={setupMode === 'gst' ? { ...requiredFieldStyle(firmGstin, 'gst'), textTransform: 'uppercase' } : { ...fieldStyle, textTransform: 'uppercase' }} />
            </div>
            <div>
              <label style={labelStyle}>PAN <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— optional</span></label>
              <input data-testid="firm-pan" value={firmPan} onChange={e => setFirmPan(e.target.value.toUpperCase())} placeholder="e.g. AABCU9603R" maxLength={10} style={{ ...fieldStyle, textTransform: 'uppercase' }} />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', marginBottom: 24 }} />

        {/* Bank Account for Invoice Payments */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Bank size={16} weight="duotone" style={{ color: 'var(--info)' }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Bank Account for Invoice Payments
            </h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            These details will be printed on your invoices so customers know where to send payment.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 700 }}>
            <div>
              <label style={labelStyle}>Bank Name</label>
              <input data-testid="bank-name" value={invoiceBankName} onChange={e => setInvoiceBankName(e.target.value)} placeholder="e.g. State Bank of India" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Account Number</label>
              <input data-testid="bank-account" value={invoiceBankAccountNo} onChange={e => setInvoiceBankAccountNo(e.target.value)} placeholder="e.g. 39201234567" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>IFSC Code</label>
              <input data-testid="bank-ifsc" value={invoiceBankIfsc} onChange={e => setInvoiceBankIfsc(e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" maxLength={11} style={{ ...fieldStyle, textTransform: 'uppercase' }} />
            </div>
            <div>
              <label style={labelStyle}>Branch</label>
              <input data-testid="bank-branch" value={invoiceBankBranch} onChange={e => setInvoiceBankBranch(e.target.value)} placeholder="e.g. Andheri West, Mumbai" style={fieldStyle} />
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', marginBottom: 24 }} />

        {/* Invoice Numbering & Terms */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Invoice Numbering & Terms
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 700 }}>
            <div>
              <label style={labelStyle}>Invoice Number Prefix <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— e.g. INV-, SI-, or your firm initials</span></label>
              <input data-testid="invoice-prefix" value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value)} placeholder="INV-" style={fieldStyle} />
              <div className="mono" style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                Preview: {invoicePrefix || 'INV-'}0001
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Default Terms & Conditions <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— printed at the bottom of every invoice</span></label>
              <textarea data-testid="invoice-terms" value={invoiceTerms} onChange={e => setInvoiceTerms(e.target.value)}
                placeholder="e.g. Payment is due within 30 days of invoice date. Late payments may attract interest at 18% p.a."
                rows={3} style={{ ...fieldStyle, resize: 'vertical', minHeight: 60 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          data-testid="save-settings-btn"
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--brand-primary)', color: '#fff', border: 'none',
            padding: '12px 28px', borderRadius: 2, fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
            opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {saving ? 'Saving...' : setupMode ? 'Save & Continue to Invoices' : 'Save Settings'}
        </button>
        {setupMode && !saving && (
          <button
            onClick={() => navigate('/invoices')}
            style={{
              background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)',
              padding: '12px 20px', borderRadius: 2, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <ArrowLeft size={14} /> Skip for now
          </button>
        )}
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
            <Check size={16} weight="bold" /> {setupMode ? 'Saved! Redirecting...' : 'Saved!'}
          </span>
        )}
      </div>
    </div>
  );
}
