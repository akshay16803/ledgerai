import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Users, CurrencyInr, Clock, ChartBar, SpinnerGap, Plus, PencilSimple, Trash, X, MagnifyingGlass, Envelope, Phone, Buildings, MapPin, ArrowLeft } from '@phosphor-icons/react';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount || 0);
}

const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)', boxSizing: 'border-box' };
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };

const statusColor = { paid: 'var(--success)', partial: 'var(--warning)', unpaid: 'var(--text-muted)', overdue: 'var(--error)', sent: 'var(--info)' };
const statusBg = { paid: 'rgba(58,92,74,0.1)', partial: 'rgba(194,140,60,0.1)', unpaid: 'rgba(0,0,0,0.06)', overdue: 'rgba(180,35,24,0.1)', sent: 'rgba(30,100,160,0.1)' };

// ─── Customer Form Modal ─────────────────────────────────────────────
function CustomerFormModal({ customer, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    gstin: customer?.gstin || '',
    billing_address: customer?.billing_address || '',
    shipping_address: customer?.shipping_address || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Customer name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        gstin: form.gstin.trim() || null,
        billing_address: form.billing_address.trim() || null,
        shipping_address: form.shipping_address.trim() || null,
      };
      if (customer?.customer_id) {
        await api.put(`/api/customers/${customer.customer_id}`, payload);
      } else {
        await api.post('/api/customers', payload);
      }
      onSaved();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 2, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
            {customer ? 'Edit Customer' : 'New Customer'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{s('customer_name')} *</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={inputStyle} placeholder="Customer / Company name" autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>{s('email')}</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} style={inputStyle} placeholder="email@example.com" />
            </div>
            <div>
              <label style={labelStyle}>{s('phone')}</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} style={inputStyle} placeholder="+91 98765 43210" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{s('gstin')}</label>
            <input value={form.gstin} onChange={e => setForm(f => ({...f, gstin: e.target.value.toUpperCase()}))} style={inputStyle} placeholder="22AAAAA0000A1Z5" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{s('billing_address')}</label>
            <textarea value={form.billing_address} onChange={e => setForm(f => ({...f, billing_address: e.target.value}))} style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} placeholder="Billing address" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{s('shipping_address')}</label>
            <textarea value={form.shipping_address} onChange={e => setForm(f => ({...f, shipping_address: e.target.value}))} style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} placeholder="Shipping address (leave blank if same as billing)" />
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 14 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={saving} style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              {saving ? 'Saving...' : (customer ? 'Update' : 'Save')}
            </button>
            <button type="button" onClick={onClose} style={{ background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', padding: '10px 24px', borderRadius: 2, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Customer Detail Panel ───────────────────────────────────────────
function CustomerDetail({ customer, onBack, onEdit }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/invoices?customer_id=${customer.customer_id}&limit=100`)
      .then(res => setInvoices(Array.isArray(res) ? res : (res?.invoices || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customer.customer_id]);

  const totalInvoiced = invoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (Number(i.paid_amount) || 0), 0);
  const totalDue = totalInvoiced - totalPaid;

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-primary)', fontSize: 13, fontWeight: 600, marginBottom: 20, padding: 0 }}>
        <ArrowLeft size={14} weight="bold" /> Back to Customers
      </button>

      {/* Customer Card */}
      <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{customer.name}</h2>
            {customer.gstin && <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 2 }}>GSTIN: {customer.gstin}</span>}
          </div>
          <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--border-strong)', padding: '8px 16px', borderRadius: 2, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
            <PencilSimple size={14} /> Edit
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {customer.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}><Envelope size={14} />{customer.email}</div>}
          {customer.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}><Phone size={14} />{customer.phone}</div>}
          {customer.billing_address && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}><MapPin size={14} />{customer.billing_address}</div>}
        </div>
      </div>

      {/* Financial Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Invoiced', value: totalInvoiced, color: 'var(--text-primary)' },
          { label: 'Total Paid', value: totalPaid, color: 'var(--success)' },
          { label: 'Outstanding', value: totalDue, color: totalDue > 0 ? 'var(--error)' : 'var(--success)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '16px 20px' }}>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color }}>{formatCurrency(value)}</div>
          </div>
        ))}
      </div>

      {/* Invoices */}
      <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Invoices ({invoices.length})</h3>
        {loading ? (
          <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>No invoices for this customer</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Invoice #', 'Date', 'Amount', 'Paid', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Invoice #' || h === 'Date' || h === 'Status' ? 'left' : 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border-strong)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.invoice_id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{inv.invoice_number || '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(inv.total_amount)}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{formatCurrency(inv.paid_amount)}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, background: statusBg[inv.status] || statusBg.unpaid, color: statusColor[inv.status] || statusColor.unpaid, textTransform: 'capitalize' }}>{inv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Analytics Section ───────────────────────────────────────────────
const styles = {
  card: { background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 28, marginBottom: 28 },
  cardTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', margin: 0, marginBottom: 20 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, fontFamily: 'var(--font-body)' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border-strong)' },
  thRight: { textAlign: 'right', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border-strong)' },
  td: { padding: '10px 12px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' },
  tdRight: { padding: '10px 12px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right', fontFamily: 'var(--font-mono)' },
  totalRow: { fontWeight: 700, background: 'var(--bg-secondary)' },
  empty: { textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 },
};

// ─── Main Component ──────────────────────────────────────────────────
export default function Customers() {
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);

  // Customer CRUD state
  const [customers, setCustomers] = useState([]);
  const [custLoading, setCustLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [detailCustomer, setDetailCustomer] = useState(null);

  // Analytics state
  const [debtors, setDebtors] = useState([]);
  const [salesByCustomer, setSalesByCustomer] = useState([]);
  const [aging, setAging] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCustomers = useCallback(async () => {
    setCustLoading(true);
    try {
      const res = await api.get('/api/customers');
      setCustomers(Array.isArray(res) ? res : (res?.customers || []));
    } catch { setCustomers([]); }
    setCustLoading(false);
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true); setError('');
    try {
      const [debtorsRes, salesRes, agingRes] = await Promise.all([
        api.get('/api/invoices/debtors'),
        api.get('/api/invoices/sales-by-customer'),
        api.get('/api/invoices/aging'),
      ]);
      setDebtors(Array.isArray(debtorsRes) ? debtorsRes : []);
      setSalesByCustomer(Array.isArray(salesRes) ? salesRes : []);
      setAging(Array.isArray(agingRes) ? agingRes : []);
    } catch (err) { setError(err.message || 'Failed to load analytics'); }
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => { loadCustomers(); loadAnalytics(); }, [loadCustomers, loadAnalytics]);

  const handleDelete = async (customer) => {
    if (!confirm(`Delete "${customer.name}"? This cannot be undone.`)) return;
    try {
      await api.del(`/api/customers/${customer.customer_id}`);
      loadCustomers(); loadAnalytics();
    } catch (err) { alert(err.message); }
  };

  const filteredCustomers = customers.filter(c =>
    !searchQuery || c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.gstin?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (detailCustomer) {
    return (
      <div data-testid="customers-page">
        <CustomerDetail
          customer={detailCustomer}
          onBack={() => setDetailCustomer(null)}
          onEdit={() => { setEditingCustomer(detailCustomer); setShowForm(true); }}
        />
        {showForm && (
          <CustomerFormModal
            customer={editingCustomer}
            onClose={() => { setShowForm(false); setEditingCustomer(null); }}
            onSaved={() => {
              setShowForm(false); setEditingCustomer(null);
              loadCustomers(); loadAnalytics();
              // Refresh detail customer
              api.get(`/api/customers/${detailCustomer.customer_id}`).then(c => setDetailCustomer(c)).catch(() => {});
            }}
          />
        )}
      </div>
    );
  }

  // Aggregate analytics
  const debtorsTotal = debtors.reduce((sum, d) => sum + (d.total_outstanding || 0), 0);
  const debtorsInvoiceTotal = debtors.reduce((sum, d) => sum + (d.invoice_count || 0), 0);
  const salesTotalAmount = salesByCustomer.reduce((sum, s) => sum + (s.total_sales || 0), 0);
  const salesTotalInvoices = salesByCustomer.reduce((sum, s) => sum + (s.invoice_count || 0), 0);
  const agingTotals = aging.reduce((acc, row) => ({
    current: acc.current + (row.current || 0),
    days_1_30: acc.days_1_30 + (row.days_1_30 || 0),
    days_31_60: acc.days_31_60 + (row.days_31_60 || 0),
    days_61_90: acc.days_61_90 + (row.days_61_90 || 0),
    days_90_plus: acc.days_90_plus + (row.days_90_plus || 0),
    total: acc.total + (row.total || 0),
  }), { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0, total: 0 });

  return (
    <div data-testid="customers-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={26} weight="duotone" color="var(--brand-primary)" />
            {s('customers')}
          </h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Manage customers and view analytics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <MagnifyingGlass size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              data-testid="customer-search"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search customers..."
              style={{ padding: '8px 12px 8px 32px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', background: 'var(--bg-primary)', width: 200, outline: 'none' }}
            />
          </div>
          <button
            data-testid="add-customer-btn"
            onClick={() => { setEditingCustomer(null); setShowForm(true); }}
            style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} weight="bold" /> New Customer
          </button>
        </div>
      </div>

      {error && <div style={{ padding: '12px 16px', background: 'var(--error)', color: '#fff', borderRadius: 2, fontSize: 14, marginBottom: 20 }}>{error}</div>}

      {/* Customer List */}
      <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, marginBottom: 28 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
            All Customers {!custLoading && `(${filteredCustomers.length})`}
          </h2>
        </div>
        {custLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
            <SpinnerGap size={18} weight="bold" className="spin" /> Loading customers...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
            {searchQuery ? 'No customers match your search.' : 'No customers yet. Add your first customer.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {[s('customer_name'), s('email'), s('phone'), s('gstin'), 'Actions'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 4 ? 'center' : 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border-strong)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(c => (
                <tr key={c.customer_id} style={{ cursor: 'pointer' }} onClick={() => setDetailCustomer(c)}>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 13 }}>{c.email || '—'}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 13 }}>{c.phone || '—'}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{c.gstin || '—'}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                      <button title="Edit" onClick={() => { setEditingCustomer(c); setShowForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><PencilSimple size={15} /></button>
                      <button title="Delete" data-guard onClick={() => handleDelete(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Trash size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Analytics Section */}
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>Analytics</h2>

      {/* Section 1: Due from Customers */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}><CurrencyInr size={18} weight="bold" color="var(--brand-primary)" />Due from Customers</h2>
        {analyticsLoading ? <div style={styles.empty}><SpinnerGap size={18} className="spin" /></div> : debtors.length === 0 ? (
          <div style={styles.empty}>No outstanding amounts from customers.</div>
        ) : (
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{s('customer_name')}</th><th style={styles.thRight}>Outstanding Amount</th><th style={styles.thRight}>Invoice Count</th></tr></thead>
            <tbody>
              {debtors.map(d => (
                <tr key={d.customer_id}>
                  <td style={styles.td}>{d.customer_name}</td>
                  <td style={styles.tdRight}>{formatCurrency(d.total_outstanding)}</td>
                  <td style={styles.tdRight}>{d.invoice_count}</td>
                </tr>
              ))}
              <tr style={styles.totalRow}><td style={styles.td}>{s('total')}</td><td style={styles.tdRight}>{formatCurrency(debtorsTotal)}</td><td style={styles.tdRight}>{debtorsInvoiceTotal}</td></tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Section 2: Sales per Customer */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}><ChartBar size={18} weight="bold" color="var(--brand-primary)" />Sales per Customer</h2>
        {analyticsLoading ? <div style={styles.empty}><SpinnerGap size={18} className="spin" /></div> : salesByCustomer.length === 0 ? (
          <div style={styles.empty}>No sales data available.</div>
        ) : (
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{s('customer_name')}</th><th style={styles.thRight}>Total Sales</th><th style={styles.thRight}>Invoices</th></tr></thead>
            <tbody>
              {salesByCustomer.map(sc => (
                <tr key={sc.customer_id}><td style={styles.td}>{sc.customer_name}</td><td style={styles.tdRight}>{formatCurrency(sc.total_sales)}</td><td style={styles.tdRight}>{sc.invoice_count}</td></tr>
              ))}
              <tr style={styles.totalRow}><td style={styles.td}>{s('total')}</td><td style={styles.tdRight}>{formatCurrency(salesTotalAmount)}</td><td style={styles.tdRight}>{salesTotalInvoices}</td></tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3: Debtor Aging */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}><Clock size={18} weight="bold" color="var(--brand-primary)" />Debtor Aging</h2>
        {analyticsLoading ? <div style={styles.empty}><SpinnerGap size={18} className="spin" /></div> : aging.length === 0 ? (
          <div style={styles.empty}>No aging data available.</div>
        ) : (
          <table style={styles.table}>
            <thead><tr>
              {[s('customer'), 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', s('total')].map((h, i) => (
                <th key={h} style={i === 0 ? styles.th : styles.thRight}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {aging.map(row => (
                <tr key={row.customer_id}>
                  <td style={styles.td}>{row.customer_name}</td>
                  <td style={{ ...styles.tdRight, color: 'var(--success)' }}>{formatCurrency(row.current)}</td>
                  <td style={styles.tdRight}>{formatCurrency(row.days_1_30)}</td>
                  <td style={{ ...styles.tdRight, color: '#e67e22' }}>{formatCurrency(row.days_31_60)}</td>
                  <td style={{ ...styles.tdRight, color: 'var(--error)' }}>{formatCurrency(row.days_61_90)}</td>
                  <td style={{ ...styles.tdRight, color: 'var(--error)', fontWeight: 700 }}>{formatCurrency(row.days_90_plus)}</td>
                  <td style={{ ...styles.tdRight, fontWeight: 600 }}>{formatCurrency(row.total)}</td>
                </tr>
              ))}
              <tr style={styles.totalRow}>
                <td style={styles.td}>{s('total')}</td>
                <td style={{ ...styles.tdRight, color: 'var(--success)' }}>{formatCurrency(agingTotals.current)}</td>
                <td style={styles.tdRight}>{formatCurrency(agingTotals.days_1_30)}</td>
                <td style={{ ...styles.tdRight, color: '#e67e22' }}>{formatCurrency(agingTotals.days_31_60)}</td>
                <td style={{ ...styles.tdRight, color: 'var(--error)' }}>{formatCurrency(agingTotals.days_61_90)}</td>
                <td style={{ ...styles.tdRight, color: 'var(--error)', fontWeight: 700 }}>{formatCurrency(agingTotals.days_90_plus)}</td>
                <td style={{ ...styles.tdRight, fontWeight: 600 }}>{formatCurrency(agingTotals.total)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <CustomerFormModal
          customer={editingCustomer}
          onClose={() => { setShowForm(false); setEditingCustomer(null); }}
          onSaved={() => { setShowForm(false); setEditingCustomer(null); loadCustomers(); loadAnalytics(); }}
        />
      )}
    </div>
  );
}
