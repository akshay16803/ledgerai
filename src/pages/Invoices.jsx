import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { SalesInvoiceModal } from '../components/SalesInvoiceModal';
import { InternationalInvoiceModal } from '../components/InternationalInvoiceModal';
import { usesExistingForms, getCountryConfig, formatCountryCurrency } from '../lib/countryConfig';
import { Plus, Eye, PencilSimple, Trash, Printer, CurrencyInr, Receipt, X, Gear, Copy, Check } from '@phosphor-icons/react';

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

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)',
  borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none',
  background: 'var(--bg-primary)', color: 'var(--text-primary)',
};

const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };

// ─── Status Badge ──────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    paid:    { bg: 'var(--success)', color: '#fff', label: 'Paid' },
    partial: { bg: '#f59e0b',        color: '#fff', label: 'Partial' },
    unpaid:  { bg: 'var(--error)',   color: '#fff', label: 'Unpaid' },
  };
  const c = config[status] || config.unpaid;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 2,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
      background: c.bg, color: c.color,
    }}>
      {c.label}
    </span>
  );
}

// ─── Print / View Invoice Modal ────────────────────────────────────────
function InvoicePrintModal({ invoiceId, onClose }) {
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const printRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [inv, sett] = await Promise.all([
          api.get(`/api/invoices/${invoiceId}`),
          api.get('/api/settings'),
        ]);
        if (!cancelled) { setInvoice(inv); setSettings(sett); }
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [invoiceId]);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice?.invoice_number || ''}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a1a; padding: 0; }
          @media print {
            body { padding: 0; }
            @page { margin: 12mm 10mm; size: A4; }
          }
        </style>
      </head>
      <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const isGST = invoice?.invoice_type === 'gst';
  const items = invoice?.line_items || [];
  const firm = settings || {};
  const countryCode = settings?.business_country || 'IN';
  const config = getCountryConfig(countryCode);
  const isIndian = usesExistingForms(countryCode);
  const fmtCurrency = (amt) => formatCountryCurrency(amt, countryCode);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 8px' }}>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 2, width: '100%', maxWidth: 800,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', zIndex: 1,
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px', borderBottom: '1px solid #e5e7eb',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{s('invoice_summary')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {invoice && (
              <button onClick={handlePrint} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 2,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                <Printer size={16} /> Print
              </button>
            )}
            <button onClick={onClose} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, background: 'none', border: '1px solid #d1d5db',
              borderRadius: 2, cursor: 'pointer', color: '#6b7280',
            }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '32px', overflowY: 'auto', maxHeight: 'calc(100vh - 140px)' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading invoice...</div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--error)' }}>{error}</div>
          )}
          {invoice && settings !== null && (
            <div ref={printRef}>
              <div style={{ fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif", color: '#1a1a1a', lineHeight: 1.5 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingBottom: 20, borderBottom: '2px solid #1a1a1a' }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px', color: '#1a1a1a' }}>
                      {firm.firm_name || firm.business_name || 'Your Business'}
                    </div>
                    {(firm.firm_address || firm.address) && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, maxWidth: 280 }}>
                        {firm.firm_address || firm.address}
                      </div>
                    )}
                    {(firm.firm_phone || firm.phone) && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        Phone: {firm.firm_phone || firm.phone}
                      </div>
                    )}
                    {(firm.firm_email || firm.email) && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        Email: {firm.firm_email || firm.email}
                      </div>
                    )}
                    {firm.firm_gstin && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {isIndian ? 'GSTIN' : config.taxIdLabel?.split('(')[0]?.trim() || 'Tax ID'}: {firm.firm_gstin}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a', letterSpacing: '1px' }}>
                      {isIndian ? (isGST ? 'TAX INVOICE' : 'INVOICE') : (invoice?.invoice_type === 'tax' ? (config.printTitle?.tax || config.taxInvoiceLabel || 'TAX INVOICE') : (config.printTitle?.simple || config.simpleInvoiceLabel || 'INVOICE'))}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
                      <strong style={{ color: '#374151' }}>Invoice #:</strong> {invoice.invoice_number}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                      <strong style={{ color: '#374151' }}>Date:</strong> {formatDate(invoice.invoice_date || invoice.date)}
                    </div>
                    {invoice.due_date && (
                      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                        <strong style={{ color: '#374151' }}>Due Date:</strong> {formatDate(invoice.due_date)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bill To */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#9ca3af', marginBottom: 8 }}>
                    Bill To
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                    {invoice.customer?.name || invoice.customer_name || '---'}
                  </div>
                  {(invoice.customer?.address) && (
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{invoice.customer.address}</div>
                  )}
                  {(invoice.customer?.city || invoice.customer?.state || invoice.customer?.pincode) && (
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                      {[invoice.customer?.city, invoice.customer?.state, invoice.customer?.pincode].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {invoice.customer?.gstin && (
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{isIndian ? 'GSTIN' : config.taxIdLabel?.split('(')[0]?.trim() || 'Tax ID'}: {invoice.customer.gstin}</div>
                  )}
                  {invoice.customer?.phone && (
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Phone: {invoice.customer.phone}</div>
                  )}
                  {invoice.customer?.email && (
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Email: {invoice.customer.email}</div>
                  )}
                </div>

                {/* Place of Supply */}
                {isGST && invoice.place_of_supply && (
                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>
                    <strong>Place of Supply:</strong> {invoice.place_of_supply}
                  </div>
                )}

                {/* Line Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                  <thead>
                    <tr style={{ background: '#1a1a1a' }}>
                      <th style={thStyle}>#</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
                      {isGST && <th style={thStyle}>HSN/SAC</th>}
                      <th style={thStyle}>Qty</th>
                      <th style={thStyle}>Rate</th>
                      <th style={thStyle}>Disc%</th>
                      {isGST && <th style={thStyle}>Tax%</th>}
                      <th style={{ ...thStyle, textAlign: 'right' }}>{s('amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={tdStyle}>{idx + 1}</td>
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500 }}>{item.description || '---'}</td>
                        {isGST && <td style={tdStyle}>{item.hsn_sac || '---'}</td>}
                        <td style={tdStyle}>{item.quantity}</td>
                        <td style={tdStyle}>{fmtCurrency(item.rate)}</td>
                        <td style={tdStyle}>{item.discount_percent || 0}%</td>
                        {isGST && <td style={tdStyle}>{item.tax_rate || 0}%</td>}
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(item.amount)}</td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={isGST ? 8 : 6} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af' }}>No items</td></tr>
                    )}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
                  <div style={{ width: 300 }}>
                    <TotalRow label="Subtotal" value={fmtCurrency(invoice.subtotal)} />
                    {(invoice.total_discount > 0) && (
                      <TotalRow label="Discount" value={`- ${fmtCurrency(invoice.total_discount)}`} />
                    )}
                    {isGST && invoice.cgst != null && invoice.cgst > 0 && (
                      <>
                        <TotalRow label="CGST" value={fmtCurrency(invoice.cgst)} />
                        <TotalRow label="SGST" value={fmtCurrency(invoice.sgst)} />
                      </>
                    )}
                    {isGST && invoice.igst != null && invoice.igst > 0 && (
                      <TotalRow label="IGST" value={fmtCurrency(invoice.igst)} />
                    )}
                    {invoice.round_off != null && invoice.round_off !== 0 && (
                      <TotalRow label="Round-off" value={fmtCurrency(invoice.round_off)} />
                    )}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginTop: 4,
                      borderTop: '2px solid #1a1a1a', fontSize: 16, fontWeight: 800, color: '#1a1a1a',
                    }}>
                      <span>Grand Total</span>
                      <span>{fmtCurrency(invoice.grand_total ?? invoice.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Amount in Words */}
                {invoice.amount_in_words && (
                  <div style={{
                    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 2,
                    padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#374151',
                  }}>
                    <strong>Amount in Words:</strong> {invoice.amount_in_words}
                  </div>
                )}

                {/* Bank Details */}
                {(firm.invoice_bank_name || firm.invoice_bank_account_no || firm.invoice_bank_ifsc) && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#9ca3af', marginBottom: 8 }}>
                      Bank Details
                    </div>
                    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 2, padding: '12px 16px' }}>
                      {firm.invoice_bank_name && <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}><strong>Bank:</strong> {firm.invoice_bank_name}</div>}
                      {firm.invoice_bank_account_no && <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}><strong>A/C No:</strong> {firm.invoice_bank_account_no}</div>}
                      {firm.invoice_bank_ifsc && <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}><strong>IFSC:</strong> {firm.invoice_bank_ifsc}</div>}
                      {firm.invoice_bank_branch && <div style={{ fontSize: 13, color: '#374151' }}><strong>Branch:</strong> {firm.invoice_bank_branch}</div>}
                    </div>
                  </div>
                )}

                {/* Terms & Conditions */}
                {firm.invoice_terms && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#9ca3af', marginBottom: 8 }}>
                      Terms & Conditions
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {firm.invoice_terms}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.5px', color: '#fff', textAlign: 'center', whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '10px 12px', fontSize: 13, color: '#374151', textAlign: 'center', verticalAlign: 'top',
};

function TotalRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#6b7280' }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600, color: '#374151' }}>{value}</span>
    </div>
  );
}

// ─── Record Payment Modal ──────────────────────────────────────────────
function RecordPaymentModal({ invoice, accounts, onClose, onSuccess }) {
  const remaining = (invoice.grand_total ?? invoice.total ?? 0) - (invoice.amount_paid ?? 0);
  const [amount, setAmount] = useState(remaining > 0 ? remaining.toFixed(2) : '');
  const [accountId, setAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a valid amount'); return; }
    if (!accountId) { setError('Select an account'); return; }
    if (!paymentDate) { setError('Select a payment date'); return; }
    if (!paymentMethod) { setError('Select a payment method'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/api/invoices/${invoice.id || invoice.invoice_id}/record-payment`, {
        amount: parseFloat(amount),
        account_id: accountId,
        payment_date: paymentDate,
        payment_method: paymentMethod,
      });
      onSuccess();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 2, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: '0 8px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Record Payment
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {invoice.invoice_number} — Balance: {formatCurrency(remaining)}
            </div>
          </div>
          <button onClick={onClose} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Amount</label>
            <input type="number" step="0.01" min="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
          </div>
          <div>
            <label style={labelStyle}>Account</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">Select account...</option>
              {accounts.map(a => (
                <option key={a.id || a.account_id} value={a.id || a.account_id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Payment Date</label>
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
              style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">Select method...</option>
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <div style={{ fontSize: 13, color: 'var(--error)', padding: '8px 12px', background: '#fef2f2', borderRadius: 2 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: '10px 20px', border: '1px solid var(--border-strong)',
              borderRadius: 2, background: 'var(--bg-primary)', color: 'var(--text-secondary)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{
              padding: '10px 20px', border: 'none', borderRadius: 2,
              background: 'var(--brand-primary)', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)', opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Invoices Page ────────────────────────────────────────────────
export default function Invoices() {
  const navigate = useNavigate();
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);
  const [invoices, setInvoices] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [firmName, setFirmName] = useState('');

  const [businessCountry, setBusinessCountry] = useState('IN');
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [recordingPayment, setRecordingPayment] = useState(null);

  const loadInvoices = useCallback(async () => {
    try {
      const data = await api.get('/api/invoices');
      setInvoices(Array.isArray(data) ? data : data.invoices || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await api.get('/api/accounts');
      setAccounts(Array.isArray(data) ? data : data.accounts || []);
    } catch (_) { /* non-critical */ }
  }, []);

  // Load settings to check if firm name is set
  const loadSettings = useCallback(async () => {
    try {
      const s = await api.get('/api/settings');
      setFirmName(s.firm_name || '');
      setBusinessCountry(s.business_country || 'IN');
    } catch (_) { /* non-critical */ }
    finally { setSettingsLoaded(true); }
  }, []);

  useEffect(() => {
    loadInvoices();
    loadAccounts();
    loadSettings();
  }, [loadInvoices, loadAccounts, loadSettings]);

  // Gate: redirect to settings if firm name is not set
  const handleNewInvoice = () => {
    if (settingsLoaded && !firmName.trim()) {
      navigate('/settings?setup=invoice');
      return;
    }
    setShowNewInvoice(true);
  };

  const handleDelete = async (inv) => {
    const id = inv.id || inv.invoice_id;
    const num = inv.invoice_number || `#${id}`;
    if (!confirm(`Delete invoice ${num}? This action cannot be undone.`)) return;
    try {
      await api.del(`/api/invoices/${id}`);
      loadInvoices();
    } catch (e) { alert(`Failed to delete: ${e.message}`); }
  };

  const handleDuplicate = async (inv) => {
    const id = inv.id || inv.invoice_id;
    try {
      await api.post(`/api/invoices/${id}/duplicate`);
      loadInvoices();
    } catch (e) { alert(`Failed to duplicate: ${e.message}`); }
  };

  const handleMarkPaid = async (inv) => {
    const id = inv.id || inv.invoice_id;
    const total = inv.grand_total ?? inv.total;
    if (!confirm(`Mark invoice ${inv.invoice_number || `#${id}`} as fully paid (${formatCurrency(total)})?`)) return;
    try {
      await api.post(`/api/invoices/${id}/mark-paid`);
      loadInvoices();
    } catch (e) { alert(`Failed to mark paid: ${e.message}`); }
  };

  const handleInvoiceSaved = () => {
    setShowNewInvoice(false);
    setEditingInvoice(null);
    loadInvoices();
  };

  const handlePaymentRecorded = () => {
    setRecordingPayment(null);
    loadInvoices();
  };

  return (
    <div style={{ padding: '0 0 48px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <h1 style={{
          fontSize: 24, fontWeight: 800, color: 'var(--text-primary)',
          fontFamily: 'var(--font-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Receipt size={26} weight="duotone" style={{ color: 'var(--brand-primary)' }} />
          {s('invoices')}
        </h1>
        <button onClick={handleNewInvoice} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
          background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 2,
          fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>
          <Plus size={18} weight="bold" /> {s('new_invoice')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 2,
          background: '#fef2f2', color: 'var(--error)', fontSize: 13,
          border: '1px solid #fecaca',
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>
          Loading invoices...
        </div>
      )}

      {/* Empty */}
      {!loading && invoices.length === 0 && !error && (
        <div style={{
          textAlign: 'center', padding: '60px 24px', borderRadius: 2,
          border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)',
        }}>
          <Receipt size={48} weight="duotone" style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
            No invoices yet
          </div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>
            Create your first invoice to get started.
          </div>
          <button onClick={handleNewInvoice} style={{
            padding: '10px 20px', background: 'var(--brand-primary)', color: '#fff',
            border: 'none', borderRadius: 2, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}>
            <Plus size={16} weight="bold" style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Create Invoice
          </button>
        </div>
      )}

      {/* Invoice Table */}
      {!loading && invoices.length > 0 && (
        <div style={{ borderRadius: 2, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th style={tableThStyle}>{s('invoice_number')}</th>
                  <th style={{ ...tableThStyle, textAlign: 'left' }}>{s('customer')}</th>
                  <th style={tableThStyle}>{s('date')}</th>
                  <th style={tableThStyle}>{s('amount')}</th>
                  <th style={tableThStyle}>{s('status')}</th>
                  <th style={{ ...tableThStyle, textAlign: 'center' }}>{s('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const id = inv.id || inv.invoice_id;
                  const status = inv.status || 'unpaid';
                  return (
                    <tr key={id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={tableTdStyle}>
                        <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                          {inv.invoice_number || `INV-${id}`}
                        </span>
                      </td>
                      <td style={{ ...tableTdStyle, textAlign: 'left' }}>
                        {inv.customer?.name || inv.customer_name || '---'}
                      </td>
                      <td style={tableTdStyle}>{formatDate(inv.invoice_date || inv.date)}</td>
                      <td style={{ ...tableTdStyle, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(inv.grand_total ?? inv.total)}
                      </td>
                      <td style={tableTdStyle}><StatusBadge status={status} /></td>
                      <td style={{ ...tableTdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'nowrap' }}>
                          <ActionBtn title="View" onClick={() => setViewingInvoice(inv)}>
                            <Eye size={16} />
                          </ActionBtn>
                          <ActionBtn title="Edit" onClick={() => setEditingInvoice(inv)}>
                            <PencilSimple size={16} />
                          </ActionBtn>
                          <ActionBtn title="Duplicate" onClick={() => handleDuplicate(inv)}>
                            <Copy size={16} />
                          </ActionBtn>
                          <ActionBtn title="Delete" onClick={() => handleDelete(inv)} danger>
                            <Trash size={16} />
                          </ActionBtn>
                          {(status === 'unpaid' || status === 'partial') && (
                            <ActionBtn title="Record Payment" onClick={() => setRecordingPayment(inv)}>
                              <CurrencyInr size={16} />
                            </ActionBtn>
                          )}
                          {(status === 'unpaid' || status === 'partial') && (
                            <ActionBtn title="Mark as Paid" onClick={() => handleMarkPaid(inv)}>
                              <Check size={16} weight="bold" />
                            </ActionBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {showNewInvoice && (
        usesExistingForms(businessCountry) ? (
          <SalesInvoiceModal
            invoice={null}
            accounts={accounts}
            onSave={handleInvoiceSaved}
            onClose={() => setShowNewInvoice(false)}
          />
        ) : (
          <InternationalInvoiceModal
            mode="sales"
            invoice={null}
            accounts={accounts}
            countryCode={businessCountry}
            onSave={handleInvoiceSaved}
            onClose={() => setShowNewInvoice(false)}
          />
        )
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        usesExistingForms(businessCountry) ? (
          <SalesInvoiceModal
            invoice={editingInvoice}
            accounts={accounts}
            onSave={handleInvoiceSaved}
            onClose={() => setEditingInvoice(null)}
          />
        ) : (
          <InternationalInvoiceModal
            mode="sales"
            invoice={editingInvoice}
            accounts={accounts}
            countryCode={businessCountry}
            onSave={handleInvoiceSaved}
            onClose={() => setEditingInvoice(null)}
          />
        )
      )}

      {/* View / Print Invoice Modal */}
      {viewingInvoice && (
        <InvoicePrintModal
          invoiceId={viewingInvoice.id || viewingInvoice.invoice_id}
          onClose={() => setViewingInvoice(null)}
        />
      )}

      {/* Record Payment Modal */}
      {recordingPayment && (
        <RecordPaymentModal
          invoice={recordingPayment}
          accounts={accounts}
          onClose={() => setRecordingPayment(null)}
          onSuccess={handlePaymentRecorded}
        />
      )}
    </div>
  );
}

const tableThStyle = {
  padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.5px', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap',
  fontFamily: 'var(--font-body)',
};

const tableTdStyle = {
  padding: '14px 16px', fontSize: 14, color: 'var(--text-primary)', textAlign: 'center',
  verticalAlign: 'middle', whiteSpace: 'nowrap',
};

function ActionBtn({ children, onClick, title, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, border: '1px solid var(--border-subtle)', borderRadius: 2,
        background: 'var(--bg-primary)', cursor: 'pointer',
        color: danger ? 'var(--error)' : 'var(--text-secondary)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? '#fef2f2' : 'var(--bg-secondary)';
        e.currentTarget.style.borderColor = danger ? 'var(--error)' : 'var(--border-strong)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-primary)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      {children}
    </button>
  );
}
