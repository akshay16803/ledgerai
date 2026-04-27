import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Storefront, CurrencyInr, Clock, ChartBar, SpinnerGap, Plus, PencilSimple, Trash, X, MagnifyingGlass, Envelope, Phone, Buildings, MapPin, ArrowLeft } from '@phosphor-icons/react';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount || 0);
}

const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)', boxSizing: 'border-box' };
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };

const statusColor = { paid: 'var(--success)', partial: 'var(--warning)', unpaid: 'var(--text-muted)', overdue: 'var(--error)' };
const statusBg = { paid: 'rgba(58,92,74,0.1)', partial: 'rgba(194,140,60,0.1)', unpaid: 'rgba(0,0,0,0.06)', overdue: 'rgba(180,35,24,0.1)' };

// ─── Vendor Form Modal ───────────────────────────────────────────────
function VendorFormModal({ vendor, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: vendor?.name || '',
    email: vendor?.email || '',
    phone: vendor?.phone || '',
    gstin: vendor?.gstin || '',
    billing_address: vendor?.billing_address || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Vendor name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        gstin: form.gstin.trim() || null,
        billing_address: form.billing_address.trim() || null,
      };
      if (vendor?.vendor_id) {
        await api.put(`/api/vendors/${vendor.vendor_id}`, payload);
      } else {
        await api.post('/api/vendors', payload);
      }
      onSaved();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 2, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
            {vendor ? 'Edit Vendor' : 'New Vendor'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{s('vendor_name')} *</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={inputStyle} placeholder="Vendor / Supplier name" autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>{s('email')}</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} style={inputStyle} placeholder="vendor@example.com" />
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
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{s('address')}</label>
            <textarea value={form.billing_address} onChange={e => setForm(f => ({...f, billing_address: e.target.value}))} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Vendor address" />
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 14 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={saving} style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              {saving ? 'Saving...' : (vendor ? 'Update' : 'Save')}
            </button>
            <button type="button" onClick={onClose} style={{ background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', padding: '10px 24px', borderRadius: 2, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Vendor Detail Panel ─────────────────────────────────────────────
function VendorDetail({ vendor, onBack, onEdit }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/bills?vendor_id=${vendor.vendor_id}&limit=100`)
      .then(res => setBills(Array.isArray(res) ? res : (res?.bills || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vendor.vendor_id]);

  const totalBilled = bills.reduce((s, b) => s + (Number(b.total_amount) || 0), 0);
  const totalPaid = bills.reduce((s, b) => s + (Number(b.paid_amount) || 0), 0);
  const totalDue = totalBilled - totalPaid;

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-primary)', fontSize: 13, fontWeight: 600, marginBottom: 20, padding: 0 }}>
        <ArrowLeft size={14} weight="bold" /> Back to Vendors
      </button>

      {/* Vendor Card */}
      <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{vendor.name}</h2>
            {vendor.gstin && <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 2 }}>GSTIN: {vendor.gstin}</span>}
          </div>
          <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--border-strong)', padding: '8px 16px', borderRadius: 2, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
            <PencilSimple size={14} /> Edit
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {vendor.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}><Envelope size={14} />{vendor.email}</div>}
          {vendor.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}><Phone size={14} />{vendor.phone}</div>}
          {vendor.billing_address && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}><MapPin size={14} />{vendor.billing_address}</div>}
        </div>
      </div>

      {/* Financial Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Billed', value: totalBilled, color: 'var(--text-primary)' },
          { label: 'Total Paid', value: totalPaid, color: 'var(--success)' },
          { label: 'Outstanding', value: totalDue, color: totalDue > 0 ? 'var(--error)' : 'var(--success)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '16px 20px' }}>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color }}>{formatCurrency(value)}</div>
          </div>
        ))}
      </div>

      {/* Bills */}
      <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Bills ({bills.length})</h3>
        {loading ? (
          <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading bills...</div>
        ) : bills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>No bills for this vendor</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Bill #', 'Date', 'Amount', 'Paid', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Bill #' || h === 'Date' || h === 'Status' ? 'left' : 'right', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border-strong)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bills.map(bill => (
                <tr key={bill.bill_id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{bill.bill_number || '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>{bill.bill_date ? new Date(bill.bill_date).toLocaleDateString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(bill.total_amount)}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{formatCurrency(bill.paid_amount)}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, background: statusBg[bill.status] || statusBg.unpaid, color: statusColor[bill.status] || statusColor.unpaid, textTransform: 'capitalize' }}>{bill.status}</span>
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

// ─── Analytics Styles ────────────────────────────────────────────────
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
export default function Vendors() {
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);

  // Vendor CRUD state
  const [vendors, setVendors] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [detailVendor, setDetailVendor] = useState(null);

  // Analytics state
  const [creditors, setCreditors] = useState([]);
  const [purchasesByVendor, setPurchasesByVendor] = useState([]);
  const [aging, setAging] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadVendors = useCallback(async () => {
    setVendorLoading(true);
    try {
      const res = await api.get('/api/vendors');
      setVendors(Array.isArray(res) ? res : (res?.vendors || []));
    } catch { setVendors([]); }
    setVendorLoading(false);
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true); setError('');
    try {
      const [creditorsRes, purchasesRes, agingRes] = await Promise.all([
        api.get('/api/bills/creditors'),
        api.get('/api/bills/purchases-by-vendor'),
        api.get('/api/bills/aging'),
      ]);
      setCreditors(Array.isArray(creditorsRes) ? creditorsRes : []);
      setPurchasesByVendor(Array.isArray(purchasesRes) ? purchasesRes : []);
      setAging(Array.isArray(agingRes) ? agingRes : []);
    } catch (err) { setError(err.message || 'Failed to load analytics'); }
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => { loadVendors(); loadAnalytics(); }, [loadVendors, loadAnalytics]);

  const handleDelete = async (vendor) => {
    if (!confirm(`Delete "${vendor.name}"? This cannot be undone.`)) return;
    try {
      await api.del(`/api/vendors/${vendor.vendor_id}`);
      loadVendors(); loadAnalytics();
    } catch (err) { alert(err.message); }
  };

  const filteredVendors = vendors.filter(v =>
    !searchQuery || v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.gstin?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (detailVendor) {
    return (
      <div data-testid="vendors-page">
        <VendorDetail
          vendor={detailVendor}
          onBack={() => setDetailVendor(null)}
          onEdit={() => { setEditingVendor(detailVendor); setShowForm(true); }}
        />
        {showForm && (
          <VendorFormModal
            vendor={editingVendor}
            onClose={() => { setShowForm(false); setEditingVendor(null); }}
            onSaved={() => {
              setShowForm(false); setEditingVendor(null);
              loadVendors(); loadAnalytics();
              api.get(`/api/vendors/${detailVendor.vendor_id}`).then(v => setDetailVendor(v)).catch(() => {});
            }}
          />
        )}
      </div>
    );
  }

  // Analytics aggregates
  const creditorsTotal = creditors.reduce((sum, d) => sum + (d.total_outstanding || 0), 0);
  const creditorsBillTotal = creditors.reduce((sum, d) => sum + (d.bill_count || 0), 0);
  const purchasesTotalAmount = purchasesByVendor.reduce((sum, s) => sum + (s.total_purchases || 0), 0);
  const purchasesTotalBills = purchasesByVendor.reduce((sum, s) => sum + (s.bill_count || 0), 0);
  const agingTotals = aging.reduce((acc, row) => ({
    current: acc.current + (row.current || 0),
    days_1_30: acc.days_1_30 + (row.days_1_30 || 0),
    days_31_60: acc.days_31_60 + (row.days_31_60 || 0),
    days_61_90: acc.days_61_90 + (row.days_61_90 || 0),
    days_90_plus: acc.days_90_plus + (row.days_90_plus || 0),
    total: acc.total + (row.total || 0),
  }), { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0, total: 0 });

  return (
    <div data-testid="vendors-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Storefront size={26} weight="duotone" color="var(--brand-primary)" />
            {s('vendors')}
          </h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Manage vendors and view analytics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <MagnifyingGlass size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              data-testid="vendor-search"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search vendors..."
              style={{ padding: '8px 12px 8px 32px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', background: 'var(--bg-primary)', width: 200, outline: 'none' }}
            />
          </div>
          <button
            data-testid="add-vendor-btn"
            onClick={() => { setEditingVendor(null); setShowForm(true); }}
            style={{ background: 'var(--brand-primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} weight="bold" /> New Vendor
          </button>
        </div>
      </div>

      {error && <div style={{ padding: '12px 16px', background: 'var(--error)', color: '#fff', borderRadius: 2, fontSize: 14, marginBottom: 20 }}>{error}</div>}

      {/* Vendor List */}
      <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, marginBottom: 28 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
            All Vendors {!vendorLoading && `(${filteredVendors.length})`}
          </h2>
        </div>
        {vendorLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
            <SpinnerGap size={18} weight="bold" className="spin" /> Loading vendors...
          </div>
        ) : filteredVendors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
            {searchQuery ? 'No vendors match your search.' : 'No vendors yet. Add your first vendor.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {[s('vendor_name'), s('email'), s('phone'), s('gstin'), 'Actions'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 4 ? 'center' : 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border-strong)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map(v => (
                <tr key={v.vendor_id} style={{ cursor: 'pointer' }} onClick={() => setDetailVendor(v)}>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>{v.name}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 13 }}>{v.email || '—'}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 13 }}>{v.phone || '—'}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{v.gstin || '—'}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                      <button title="Edit" onClick={() => { setEditingVendor(v); setShowForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><PencilSimple size={15} /></button>
                      <button title="Delete" data-guard onClick={() => handleDelete(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Trash size={15} /></button>
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

      {/* Section 1: Due to Vendors */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}><CurrencyInr size={18} weight="bold" color="var(--brand-primary)" />Due to Vendors</h2>
        {analyticsLoading ? <div style={styles.empty}><SpinnerGap size={18} className="spin" /></div> : creditors.length === 0 ? (
          <div style={styles.empty}>No outstanding amounts to vendors.</div>
        ) : (
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{s('vendor_name')}</th><th style={styles.thRight}>Outstanding Amount</th><th style={styles.thRight}>Bill Count</th></tr></thead>
            <tbody>
              {creditors.map(d => (
                <tr key={d.vendor_id}><td style={styles.td}>{d.vendor_name}</td><td style={styles.tdRight}>{formatCurrency(d.total_outstanding)}</td><td style={styles.tdRight}>{d.bill_count}</td></tr>
              ))}
              <tr style={styles.totalRow}><td style={styles.td}>{s('total')}</td><td style={styles.tdRight}>{formatCurrency(creditorsTotal)}</td><td style={styles.tdRight}>{creditorsBillTotal}</td></tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Section 2: Purchases per Vendor */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}><ChartBar size={18} weight="bold" color="var(--brand-primary)" />Purchases per Vendor</h2>
        {analyticsLoading ? <div style={styles.empty}><SpinnerGap size={18} className="spin" /></div> : purchasesByVendor.length === 0 ? (
          <div style={styles.empty}>No purchase data available.</div>
        ) : (
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{s('vendor_name')}</th><th style={styles.thRight}>Total Purchases</th><th style={styles.thRight}>Bills</th></tr></thead>
            <tbody>
              {purchasesByVendor.map(pv => (
                <tr key={pv.vendor_id}><td style={styles.td}>{pv.vendor_name}</td><td style={styles.tdRight}>{formatCurrency(pv.total_purchases)}</td><td style={styles.tdRight}>{pv.bill_count}</td></tr>
              ))}
              <tr style={styles.totalRow}><td style={styles.td}>{s('total')}</td><td style={styles.tdRight}>{formatCurrency(purchasesTotalAmount)}</td><td style={styles.tdRight}>{purchasesTotalBills}</td></tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3: Creditor Aging */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}><Clock size={18} weight="bold" color="var(--brand-primary)" />Creditor Aging</h2>
        {analyticsLoading ? <div style={styles.empty}><SpinnerGap size={18} className="spin" /></div> : aging.length === 0 ? (
          <div style={styles.empty}>No aging data available.</div>
        ) : (
          <table style={styles.table}>
            <thead><tr>
              {[s('vendor'), 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', s('total')].map((h, i) => (
                <th key={h} style={i === 0 ? styles.th : styles.thRight}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {aging.map(row => (
                <tr key={row.vendor_id}>
                  <td style={styles.td}>{row.vendor_name}</td>
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
        <VendorFormModal
          vendor={editingVendor}
          onClose={() => { setShowForm(false); setEditingVendor(null); }}
          onSaved={() => { setShowForm(false); setEditingVendor(null); loadVendors(); loadAnalytics(); }}
        />
      )}
    </div>
  );
}
