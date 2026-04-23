import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Storefront, CurrencyInr, Clock, ChartBar, SpinnerGap } from '@phosphor-icons/react';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount || 0);
}

const styles = {
  page: {
    padding: 32,
    maxWidth: 1100,
    margin: '0 auto',
    fontFamily: 'var(--font-body)',
  },
  header: {
    marginBottom: 32,
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-heading)',
    margin: 0,
  },
  headerSub: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginTop: 6,
    marginLeft: 36,
  },
  card: {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 2,
    padding: 28,
    marginBottom: 28,
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-heading)',
    margin: 0,
    marginBottom: 20,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
    fontFamily: 'var(--font-body)',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '2px solid var(--border-strong)',
  },
  thRight: {
    textAlign: 'right',
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '2px solid var(--border-strong)',
  },
  td: {
    padding: '10px 12px',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  tdRight: {
    padding: '10px 12px',
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-subtle)',
    textAlign: 'right',
    fontFamily: 'var(--font-mono)',
  },
  totalRow: {
    fontWeight: 700,
    background: 'var(--bg-secondary)',
  },
  empty: {
    textAlign: 'center',
    padding: '40px 20px',
    color: 'var(--text-muted)',
    fontSize: 14,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '60px 20px',
    color: 'var(--text-muted)',
    fontSize: 14,
  },
  error: {
    padding: '12px 16px',
    background: 'var(--error)',
    color: '#fff',
    borderRadius: 2,
    fontSize: 14,
    marginBottom: 20,
  },
};

export default function Vendors() {
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);
  const [creditors, setCreditors] = useState([]);
  const [purchasesByVendor, setPurchasesByVendor] = useState([]);
  const [aging, setAging] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [creditorsRes, purchasesRes, agingRes] = await Promise.all([
        api.get('/api/bills/creditors'),
        api.get('/api/bills/purchases-by-vendor'),
        api.get('/api/bills/aging'),
      ]);
      setCreditors(Array.isArray(creditorsRes) ? creditorsRes : []);
      setPurchasesByVendor(Array.isArray(purchasesRes) ? purchasesRes : []);
      setAging(Array.isArray(agingRes) ? agingRes : []);
    } catch (err) {
      setError(err.message || 'Failed to load vendor data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>
          <SpinnerGap size={20} weight="bold" className="spin" />
          Loading vendor data...
        </div>
      </div>
    );
  }

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
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>
          <Storefront size={26} weight="duotone" color="var(--brand-primary)" />
          Vendors
        </h1>
        <p style={styles.headerSub}>{s('vendors')}</p>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Section 1: Due to Vendors (Creditors) */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>
          <CurrencyInr size={18} weight="bold" color="var(--brand-primary)" />
          Due to Vendors
        </h2>
        {creditors.length === 0 ? (
          <div style={styles.empty}>No outstanding amounts to vendors.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{s('vendor_name')}</th>
                <th style={styles.thRight}>Outstanding Amount</th>
                <th style={styles.thRight}>Bill Count</th>
              </tr>
            </thead>
            <tbody>
              {creditors.map((d) => (
                <tr key={d.vendor_id}>
                  <td style={styles.td}>{d.vendor_name}</td>
                  <td style={styles.tdRight}>{formatCurrency(d.total_outstanding)}</td>
                  <td style={styles.tdRight}>{d.bill_count}</td>
                </tr>
              ))}
              <tr style={styles.totalRow}>
                <td style={styles.td}>{s('total')}</td>
                <td style={styles.tdRight}>{formatCurrency(creditorsTotal)}</td>
                <td style={styles.tdRight}>{creditorsBillTotal}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Section 2: Purchases per Vendor */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>
          <ChartBar size={18} weight="bold" color="var(--brand-primary)" />
          Purchases per Vendor
        </h2>
        {purchasesByVendor.length === 0 ? (
          <div style={styles.empty}>No purchase data available.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{s('vendor_name')}</th>
                <th style={styles.thRight}>Total Purchases</th>
                <th style={styles.thRight}>Bills</th>
              </tr>
            </thead>
            <tbody>
              {purchasesByVendor.map((s) => (
                <tr key={s.vendor_id}>
                  <td style={styles.td}>{s.vendor_name}</td>
                  <td style={styles.tdRight}>{formatCurrency(s.total_purchases)}</td>
                  <td style={styles.tdRight}>{s.bill_count}</td>
                </tr>
              ))}
              <tr style={styles.totalRow}>
                <td style={styles.td}>{s('total')}</td>
                <td style={styles.tdRight}>{formatCurrency(purchasesTotalAmount)}</td>
                <td style={styles.tdRight}>{purchasesTotalBills}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3: Creditor Aging */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>
          <Clock size={18} weight="bold" color="var(--brand-primary)" />
          Creditor Aging
        </h2>
        {aging.length === 0 ? (
          <div style={styles.empty}>No aging data available.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{s('vendor')}</th>
                <th style={styles.thRight}>Current</th>
                <th style={styles.thRight}>1-30 Days</th>
                <th style={styles.thRight}>31-60 Days</th>
                <th style={styles.thRight}>61-90 Days</th>
                <th style={styles.thRight}>90+ Days</th>
                <th style={styles.thRight}>Total</th>
              </tr>
            </thead>
            <tbody>
              {aging.map((row) => (
                <tr key={row.vendor_id}>
                  <td style={styles.td}>{row.vendor_name}</td>
                  <td style={{ ...styles.tdRight, color: 'var(--success)' }}>
                    {formatCurrency(row.current)}
                  </td>
                  <td style={styles.tdRight}>
                    {formatCurrency(row.days_1_30)}
                  </td>
                  <td style={{ ...styles.tdRight, color: '#e67e22' }}>
                    {formatCurrency(row.days_31_60)}
                  </td>
                  <td style={{ ...styles.tdRight, color: 'var(--error)' }}>
                    {formatCurrency(row.days_61_90)}
                  </td>
                  <td style={{ ...styles.tdRight, color: 'var(--error)', fontWeight: 700 }}>
                    {formatCurrency(row.days_90_plus)}
                  </td>
                  <td style={{ ...styles.tdRight, fontWeight: 600 }}>
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              ))}
              <tr style={styles.totalRow}>
                <td style={styles.td}>{s('total')}</td>
                <td style={{ ...styles.tdRight, color: 'var(--success)' }}>
                  {formatCurrency(agingTotals.current)}
                </td>
                <td style={styles.tdRight}>
                  {formatCurrency(agingTotals.days_1_30)}
                </td>
                <td style={{ ...styles.tdRight, color: '#e67e22' }}>
                  {formatCurrency(agingTotals.days_31_60)}
                </td>
                <td style={{ ...styles.tdRight, color: 'var(--error)' }}>
                  {formatCurrency(agingTotals.days_61_90)}
                </td>
                <td style={{ ...styles.tdRight, color: 'var(--error)', fontWeight: 700 }}>
                  {formatCurrency(agingTotals.days_90_plus)}
                </td>
                <td style={{ ...styles.tdRight, fontWeight: 600 }}>
                  {formatCurrency(agingTotals.total)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
