import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { PurchaseBillModal } from '../components/PurchaseBillModal';
import { Plus, Eye, PencilSimple, Trash, Printer, CurrencyInr, Package, X, Gear } from '@phosphor-icons/react';

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

// ─── Print / View Bill Modal ──────────────────────────────────────────
function BillPrintModal({ billId, onClose }) {
  const [bill, setBill] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const printRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [b, sett] = await Promise.all([
          api.get(`/api/bills/${billId}`),
          api.get('/api/settings'),
        ]);
        if (!cancelled) { setBill(b); setSettings(sett); }
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [billId]);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill ${bill?.bill_number || ''}</title>
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

  const isGST = bill?.bill_type === 'gst';
  const items = bill?.line_items || [];
  const firm = settings || {};

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
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Bill Preview</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {bill && (
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
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading bill...</div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--error)' }}>{error}</div>
          )}
          {bill && settings !== null && (
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
                        GSTIN: {firm.firm_gstin}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a', letterSpacing: '1px' }}>
                      {isGST ? 'TAX PURCHASE BILL' : 'PURCHASE BILL'}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
                      <strong style={{ color: '#374151' }}>Bill #:</strong> {bill.bill_number}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                      <strong style={{ color: '#374151' }}>Date:</strong> {formatDate(bill.bill_date || bill.date)}
                    </div>
                    {bill.due_date && (
                      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                        <strong style={{ color: '#374151' }}>Due Date:</strong> {formatDate(bill.due_date)}
                      </div>
                    )}
                    {bill.bill_reference && (
                      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                        <strong style={{ color: '#374151' }}>Vendor Ref:</strong> {bill.bill_reference}
                      </div>
                    )}
                  </div>
                </div>

                {/* Vendor Details */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#9ca3af', marginBottom: 8 }}>
                    Vendor Details
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                    {bill.vendor?.name || bill.vendor_name || '---'}
                  </div>
                  {(bill.vendor?.address) && (
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{bill.vendor.address}</div>
                  )}
                  {(bill.vendor?.city || bill.vendor?.state || bill.vendor?.pincode) && (
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                      {[bill.vendor?.city, bill.vendor?.state, bill.vendor?.pincode].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {bill.vendor?.gstin && (
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>GSTIN: {bill.vendor.gstin}</div>
                  )}
                  {bill.vendor?.phone && (
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Phone: {bill.vendor.phone}</div>
                  )}
                  {bill.vendor?.email && (
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Email: {bill.vendor.email}</div>
                  )}
                </div>

                {/* Place of Supply */}
                {isGST && bill.place_of_supply && (
                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>
                    <strong>Place of Supply:</strong> {bill.place_of_supply}
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
                      <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={tdStyle}>{idx + 1}</td>
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500 }}>{item.description || '---'}</td>
                        {isGST && <td style={tdStyle}>{item.hsn_sac || '---'}</td>}
                        <td style={tdStyle}>{item.quantity}</td>
                        <td style={tdStyle}>{formatCurrency(item.rate)}</td>
                        <td style={tdStyle}>{item.discount_percent || 0}%</td>
                        {isGST && <td style={tdStyle}>{item.tax_rate || 0}%</td>}
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.amount)}</td>
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
                    <TotalRow label="Subtotal" value={formatCurrency(bill.subtotal)} />
                    {(bill.total_discount > 0) && (
                      <TotalRow label="Discount" value={`- ${formatCurrency(bill.total_discount)}`} />
                    )}
                    {isGST && bill.cgst != null && bill.cgst > 0 && (
                      <>
                        <TotalRow label="CGST" value={formatCurrency(bill.cgst)} />
                        <TotalRow label="SGST" value={formatCurrency(bill.sgst)} />
                      </>
                    )}
                    {isGST && bill.igst != null && bill.igst > 0 && (
                      <TotalRow label="IGST" value={formatCurrency(bill.igst)} />
                    )}
                    {bill.round_off != null && bill.round_off !== 0 && (
                      <TotalRow label="Round-off" value={formatCurrency(bill.round_off)} />
                    )}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginTop: 4,
                      borderTop: '2px solid #1a1a1a', fontSize: 16, fontWeight: 800, color: '#1a1a1a',
                    }}>
                      <span>Grand Total</span>
                      <span>{formatCurrency(bill.grand_total ?? bill.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Amount in Words */}
                {bill.amount_in_words && (
                  <div style={{
                    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 2,
                    padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#374151',
                  }}>
                    <strong>Amount in Words:</strong> {bill.amount_in_words}
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
function RecordPaymentModal({ bill, accounts, onClose, onSuccess }) {
  const remaining = (bill.grand_total ?? bill.total ?? 0) - (bill.amount_paid ?? 0);
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
      await api.post(`/api/bills/${bill.id || bill.bill_id}/record-payment`, {
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
              {bill.bill_number} — Balance: {formatCurrency(remaining)}
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

// ─── Main Purchases Page ──────────────────────────────────────────────
export default function Purchases() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [firmName, setFirmName] = useState('');

  const [showNewBill, setShowNewBill] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [viewingBill, setViewingBill] = useState(null);
  const [recordingPayment, setRecordingPayment] = useState(null);

  const loadBills = useCallback(async () => {
    try {
      const data = await api.get('/api/bills');
      setBills(Array.isArray(data) ? data : data.bills || []);
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
    } catch (_) { /* non-critical */ }
    finally { setSettingsLoaded(true); }
  }, []);

  useEffect(() => {
    loadBills();
    loadAccounts();
    loadSettings();
  }, [loadBills, loadAccounts, loadSettings]);

  // Gate: redirect to settings if firm name is not set
  const handleNewBill = () => {
    if (settingsLoaded && !firmName.trim()) {
      navigate('/settings?setup=invoice');
      return;
    }
    setShowNewBill(true);
  };

  const handleDelete = async (b) => {
    const id = b.id || b.bill_id;
    const num = b.bill_number || `#${id}`;
    if (!confirm(`Delete bill ${num}? This action cannot be undone.`)) return;
    try {
      await api.del(`/api/bills/${id}`);
      loadBills();
    } catch (e) { alert(`Failed to delete: ${e.message}`); }
  };

  const handleBillSaved = () => {
    setShowNewBill(false);
    setEditingBill(null);
    loadBills();
  };

  const handlePaymentRecorded = () => {
    setRecordingPayment(null);
    loadBills();
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
          <Package size={26} weight="duotone" style={{ color: 'var(--brand-primary)' }} />
          Purchase Invoice
        </h1>
        <button onClick={handleNewBill} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
          background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 2,
          fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>
          <Plus size={18} weight="bold" /> New Bill
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
          Loading purchases...
        </div>
      )}

      {/* Empty */}
      {!loading && bills.length === 0 && !error && (
        <div style={{
          textAlign: 'center', padding: '60px 24px', borderRadius: 2,
          border: '1px dashed var(--border-subtle)', color: 'var(--text-muted)',
        }}>
          <Package size={48} weight="duotone" style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
            No purchases yet
          </div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>
            Record your first purchase to get started.
          </div>
          <button onClick={handleNewBill} style={{
            padding: '10px 20px', background: 'var(--brand-primary)', color: '#fff',
            border: 'none', borderRadius: 2, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}>
            <Plus size={16} weight="bold" style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Record Purchase
          </button>
        </div>
      )}

      {/* Bills Table */}
      {!loading && bills.length > 0 && (
        <div style={{ borderRadius: 2, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th style={tableThStyle}>Bill #</th>
                  <th style={{ ...tableThStyle, textAlign: 'left' }}>Vendor</th>
                  <th style={tableThStyle}>Date</th>
                  <th style={tableThStyle}>Amount</th>
                  <th style={tableThStyle}>Status</th>
                  <th style={{ ...tableThStyle, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const id = b.id || b.bill_id;
                  const status = b.status || 'unpaid';
                  return (
                    <tr key={id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={tableTdStyle}>
                        <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                          {b.bill_number || `BILL-${id}`}
                        </span>
                      </td>
                      <td style={{ ...tableTdStyle, textAlign: 'left' }}>
                        {b.vendor?.name || b.vendor_name || '---'}
                      </td>
                      <td style={tableTdStyle}>{formatDate(b.bill_date || b.date)}</td>
                      <td style={{ ...tableTdStyle, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(b.grand_total ?? b.total)}
                      </td>
                      <td style={tableTdStyle}><StatusBadge status={status} /></td>
                      <td style={{ ...tableTdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'nowrap' }}>
                          <ActionBtn title="View" onClick={() => setViewingBill(b)}>
                            <Eye size={16} />
                          </ActionBtn>
                          <ActionBtn title="Edit" onClick={() => setEditingBill(b)}>
                            <PencilSimple size={16} />
                          </ActionBtn>
                          <ActionBtn title="Delete" onClick={() => handleDelete(b)} danger>
                            <Trash size={16} />
                          </ActionBtn>
                          {(status === 'unpaid' || status === 'partial') && (
                            <ActionBtn title="Record Payment" onClick={() => setRecordingPayment(b)}>
                              <CurrencyInr size={16} />
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

      {/* New Bill Modal */}
      {showNewBill && (
        <PurchaseBillModal
          bill={null}
          accounts={accounts}
          onSave={handleBillSaved}
          onClose={() => setShowNewBill(false)}
        />
      )}

      {/* Edit Bill Modal */}
      {editingBill && (
        <PurchaseBillModal
          bill={editingBill}
          accounts={accounts}
          onSave={handleBillSaved}
          onClose={() => setEditingBill(null)}
        />
      )}

      {/* View / Print Bill Modal */}
      {viewingBill && (
        <BillPrintModal
          billId={viewingBill.id || viewingBill.bill_id}
          onClose={() => setViewingBill(null)}
        />
      )}

      {/* Record Payment Modal */}
      {recordingPayment && (
        <RecordPaymentModal
          bill={recordingPayment}
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
