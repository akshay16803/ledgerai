import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Users, CurrencyInr, Clock, ChartBar, SpinnerGap } from '@phosphor-icons/react';

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

export default function Customers() {
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);
  const [debtors, setDebtors] = useState([]);
  const [salesByCustomer, setSalesByCustomer] = useState([]);
  const [aging, setAging] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [debtorsRes, salesRes, agingRes] = await Promise.all([
        api.get('/api/invoices/debtors'),
        api.get('/api/invoices/sales-by-customer'),
        api.get('/api/invoices/aging'),
      ]);
      setDebtors(Array.isArray(debtorsRes) ? debtorsRes : []);
      setSalesByCustomer(Array.isArray(salesRes) ? salesRes : []);
      setAging(Array.isArray(agingRes) ? agingRes : []);
    } catch (err) {
      setError(err.message || 'Failed to load customer data');
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
          Loading customer data...
        </div>
      </div>
    );
  }

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
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>
          <Users size={26} weight="duotone" color="var(--brand-primary)" />
          Customers
        </h1>
        <p style={styles.headerSub}>{s('customers')}</p>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Section 1: Due from Customers (Debtors) */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>
          <CurrencyInr size={18} weight="bold" color="var(--brand-primary)" />
          Due from Customers
        </h2>
        {debtors.length === 0 ? (
          <div style={styles.empty}>No outstanding amounts from customers.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{s('customer_name')}</th>
                <th style={styles.thRight}>Outstanding Amount</th>
                <th style={styles.thRight}>Invoice Count</th>
              </tr>
            </thead>
            <tbody>
              {debtors.map((d) => (
                <tr key={d.customer_id}>
                  <td style={styles.td}>{d.customer_name}</td>
                  <td style={styles.tdRight}>{formatCurrency(d.total_outstanding)}</td>
                  <td style={styles.tdRight}>{d.invoice_count}</td>
                </tr>
              ))}
              <tr style={styles.totalRow}>
                <td style={styles.td}>{s('total')}</td>
                <td style={styles.tdRight}>{formatCurrency(debtorsTotal)}</td>
                <td style={styles.tdRight}>{debtorsInvoiceTotal}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Section 2: Sales per Customer */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>
          <ChartBar size={18} weight="bold" color="var(--brand-primary)" />
          Sales per Customer
        </h2>
        {salesByCustomer.length === 0 ? (
          <div style={styles.empty}>No sales data available.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{s('customer_name')}</th>
                <th style={styles.thRight}>Total Sales</th>
                <th style={styles.thRight}>Invoices</th>
              </tr>
            </thead>
            <tbody>
              {salesByCustomer.map((s) => (
                <tr key={s.customer_id}>
                  <td style={styles.td}>{s.customer_name}</td>
                  <td style={styles.tdRight}>{formatCurrency(s.total_sales)}</td>
                  <td style={styles.tdRight}>{s.invoice_count}</td>
                </tr>
              ))}
              <tr style={styles.totalRow}>
                <td style={styles.td}>{s('total')}</td>
                <td style={styles.tdRight}>{formatCurrency(salesTotalAmount)}</td>
                <td style={styles.tdRight}>{salesTotalInvoices}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3: Debtor Aging */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>
          <Clock size={18} weight="bold" color="var(--brand-primary)" />
          Debtor Aging
        </h2>
        {aging.length === 0 ? (
          <div style={styles.empty}>No aging data available.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{s('customer')}</th>
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
                <tr key={row.customer_id}>
                  <td style={styles.td}>{row.customer_name}</td>
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
