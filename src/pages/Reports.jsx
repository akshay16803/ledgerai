import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import {
  TrendUp, TrendDown, ArrowsLeftRight, FunnelSimple,
  CurrencyInr, ChartBar, ChartPie, CaretDown, CaretRight, X, ArrowRight, DownloadSimple
} from '@phosphor-icons/react';

const API = import.meta.env.REACT_APP_BACKEND_URL || '';

function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const COLORS = [
  '#34C759', '#2EB34D', '#4A6E7D', '#C28C3C', '#7C3AED',
  '#E53E3E', '#38A169', '#3182CE', '#D69E2E', '#9F7AEA',
  '#ED8936', '#48BB78', '#4299E1', '#ECC94B', '#B794F4',
];

const PERIOD_PRESETS = [
  { label: s('this_month'), getRange: () => { const n = new Date(); return { start: `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`, end: n.toISOString().split('T')[0] }; } },
  { label: s('last_3_months'), getRange: () => { const n = new Date(); const s = new Date(n); s.setMonth(s.getMonth()-3); return { start: s.toISOString().split('T')[0], end: n.toISOString().split('T')[0] }; } },
  { label: s('last_6_months'), getRange: () => { const n = new Date(); const s = new Date(n); s.setMonth(s.getMonth()-6); return { start: s.toISOString().split('T')[0], end: n.toISOString().split('T')[0] }; } },
  { label: s('this_year'), getRange: () => { const n = new Date(); return { start: `${n.getFullYear()}-01-01`, end: n.toISOString().split('T')[0] }; } },
  { label: 'All Time', getRange: () => ({ start: '', end: '' }) },
];

function SummaryCard({ label, value, color, icon: Icon }) {
  return (
    <div style={{
      flex: 1, minWidth: 170, padding: '20px 24px', background: '#fff',
      border: '1px solid var(--border-subtle)', borderRadius: 2
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            {label}
          </div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, color, letterSpacing: '-0.02em' }}>
            {formatCurrency(value)}
          </div>
        </div>
        {Icon && <Icon size={24} weight="duotone" style={{ color, opacity: 0.5 }} />}
      </div>
    </div>
  );
}

function PeriodChart({ data }) {
  if (!data || data.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
      No transaction data for this period.
    </div>
  );

  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);
  const chartH = 240;
  const barGroupW = Math.max(60, Math.min(120, Math.floor(800 / data.length)));
  const barW = (barGroupW - 16) / 2;
  const totalW = Math.max(800, data.length * barGroupW + 60);

  return (
    <div data-testid="period-chart" style={{ overflowX: 'auto' }}>
      <svg width={totalW} height={chartH + 50} style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <g key={pct}>
            <line x1="50" y1={chartH - pct * (chartH - 30)} x2={totalW} y2={chartH - pct * (chartH - 30)}
              stroke="var(--border-subtle)" strokeDasharray="4,4" />
            <text x="46" y={chartH - pct * (chartH - 30) + 4} textAnchor="end"
              style={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(maxVal * pct).replace(/₹|,/g, m => m === '₹' ? '' : m)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = 60 + i * barGroupW;
          const incH = (d.income / maxVal) * (chartH - 30);
          const expH = (d.expense / maxVal) * (chartH - 30);
          return (
            <g key={d.month}>
              <rect x={x} y={chartH - incH} width={barW} height={incH}
                fill="var(--success)" opacity="0.8" rx="2" />
              <rect x={x + barW + 4} y={chartH - expH} width={barW} height={expH}
                fill="var(--error)" opacity="0.8" rx="2" />
              <text x={x + barGroupW / 2 - 8} y={chartH + 16} textAnchor="middle"
                style={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {d.month}
              </text>
              {d.net !== 0 && (
                <text x={x + barGroupW / 2 - 8} y={chartH + 30}
                  textAnchor="middle"
                  style={{ fontSize: 9, fill: d.net >= 0 ? 'var(--success)' : 'var(--error)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {d.net >= 0 ? '+' : ''}{formatCurrency(d.net).replace('₹', '')}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 4, fontSize: 11 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: 'var(--success)', borderRadius: 1, opacity: 0.8 }} /> Income
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: 'var(--error)', borderRadius: 1, opacity: 0.8 }} /> Expense
        </span>
      </div>
    </div>
  );
}

function DonutChart({ data, total, typeLabel, onSliceClick }) {
  const [hoveredSlice, setHoveredSlice] = useState(null);
  if (!data || data.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
      No data for this view.
    </div>
  );

  const cx = 120, cy = 120, r = 90, innerR = 55;
  let startAngle = -Math.PI / 2;
  const slices = [];

  for (let i = 0; i < data.length; i++) {
    const cat = data[i];
    const val = typeLabel === 'expense' ? cat.expense : typeLabel === 'income' ? cat.income : cat.total;
    if (val <= 0) continue;
    const angle = (val / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);

    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;

    slices.push({ path, color: COLORS[i % COLORS.length], name: cat.category_name, val, cat: data[i] });
    startAngle = endAngle;
  }

  return (
    <div data-testid="donut-chart" style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={240} height={240} viewBox="0 0 240 240">
        {slices.map((s, i) => (
          <path
            key={`slice-${s.name}`}
            d={s.path}
            fill={s.color}
            opacity={hoveredSlice === i ? 1 : 0.85}
            style={{ cursor: onSliceClick ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
            onClick={() => onSliceClick?.(s.cat)}
            onMouseEnter={() => setHoveredSlice(i)}
            onMouseLeave={() => setHoveredSlice(null)}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle"
          style={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Total
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle"
          style={{ fontSize: 16, fontWeight: 700, fill: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
          {formatCurrency(total)}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200 }}>
        {slices.map((s, i) => (
          <div
            key={`legend-${s.name}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: onSliceClick ? 'pointer' : 'default', borderRadius: 2, padding: '3px 6px', background: hoveredSlice === i ? 'rgba(0,0,0,0.04)' : 'transparent', transition: 'background 0.1s' }}
            onClick={() => onSliceClick?.(s.cat)}
            onMouseEnter={() => setHoveredSlice(i)}
            onMouseLeave={() => setHoveredSlice(null)}
          >
            <span style={{ width: 12, height: 12, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{s.name}</span>
            <span className="mono" style={{ fontWeight: 600 }}>{formatCurrency(s.val)}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>
              {total > 0 ? ((s.val / total) * 100).toFixed(1) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Transaction Drill-Down Panel ────────────────────────────────── */

function TransactionDrillDown({ drillDown, onClose, startDate, endDate, catType }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterFrom, setFilterFrom] = useState(startDate || '');
  const [filterTo, setFilterTo] = useState(endDate || '');

  const loadTxns = useCallback(async (fd, td) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', 'approved');
      params.set('limit', '500');
      if (catType) params.set('transaction_type', catType);
      if (drillDown.categoryId) params.set('category_id', drillDown.categoryId);
      if (drillDown.subcategoryId) params.set('subcategory_id', drillDown.subcategoryId);
      if (fd) params.set('from_date', fd);
      if (td) params.set('to_date', td);
      const res = await api.get(`/api/transactions?${params}`);
      setTransactions(res.transactions || []);
    } catch (e) {
      setError(e.message || 'Failed to load transactions');
    }
    setLoading(false);
  }, [catType, drillDown]);

  useEffect(() => {
    loadTxns(filterFrom, filterTo);
  }, [loadTxns, filterFrom, filterTo]);

  const totalAmount = transactions.reduce((s, t) => s + Math.abs(t.amount || 0), 0);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 560,
      background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 1000,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--bg-secondary)',
      }}>
        <button onClick={onClose} style={{
          padding: 4, background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
        }}>
          <X size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {drillDown.subcategoryName || drillDown.categoryName}
          </div>
          {drillDown.subcategoryName && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              {drillDown.categoryName}
              <ArrowRight size={10} />
              {drillDown.subcategoryName}
            </div>
          )}
        </div>
      </div>

      {/* Date filter */}
      <div style={{
        padding: '10px 20px', display: 'flex', gap: 10, alignItems: 'center',
        borderBottom: '1px solid var(--border-subtle)', background: '#fafafa',
      }}>
        <FunnelSimple size={14} style={{ color: 'var(--text-muted)' }} />
        <input type="date" value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          style={{ padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-body)' }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>to</span>
        <input type="date" value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          style={{ padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-body)' }}
        />
      </div>

      {/* Summary */}
      {!loading && !error && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
            Total: {formatCurrency(totalAmount)}
          </span>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div className="mono" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading transactions...
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--error)', fontSize: 13 }}>{error}</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No transactions found for this filter.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={{ ...thStyle, fontSize: 10 }}>Date</th>
                <th style={{ ...thStyle, fontSize: 10 }}>Description</th>
                <th style={{ ...thStyle, fontSize: 10, textAlign: 'right' }}>{s('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => (
                <tr key={txn.transaction_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="mono" style={{ ...tdStyle, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {txn.date ? txn.date.slice(0, 10) : '—'}
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {txn.description || 'No description'}
                  </td>
                  <td className="mono" style={{
                    ...tdStyle, textAlign: 'right', fontWeight: 600,
                    color: txn.transaction_type === 'income' ? 'var(--success)' : 'var(--error)',
                  }}>
                    {formatCurrency(Math.abs(txn.amount || 0))}
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

/* ── Overlay Backdrop ──────────────────────────────────────────── */

function Overlay({ onClick }) {
  return (
    <div onClick={onClick} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.3)', zIndex: 999,
    }} />
  );
}

/* ── Main Reports Page ──────────────────────────────────────────── */

export default function Reports() {
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);
  const cached = getCached('reports');
  const [summary, setSummary] = useState(cached?.summary || null);
  const [periods, setPeriods] = useState(cached?.periods || []);
  const [categories, setCategories] = useState(cached?.categories || []);
  const [loading, setLoading] = useState(!cached);
  const [activePreset, setActivePreset] = useState(4);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [catType, setCatType] = useState('expense');
  const [expandedCat, setExpandedCat] = useState(null);
  const [drillDown, setDrillDown] = useState(null);

  const loadData = useCallback(async (sd, ed) => {
    try {
      const params = new URLSearchParams();
      if (sd) params.set('start_date', sd);
      if (ed) params.set('end_date', ed);
      const qs = params.toString() ? `?${params}` : '';

      const [sum, per, catExp, catInc] = await Promise.all([
        api.get(`/api/reports/summary${qs}`),
        api.get(`/api/reports/by-period${qs}`),
        api.get(`/api/reports/by-category${qs}&transaction_type=expense`),
        api.get(`/api/reports/by-category${qs}&transaction_type=income`),
      ]);
      setSummary(sum);
      setPeriods(per.periods || []);
      setCategories({ expense: catExp.categories || [], income: catInc.categories || [] });
      if (!sd && !ed) {
        setCache('reports', { summary: sum, periods: per.periods || [], categories: { expense: catExp.categories || [], income: catInc.categories || [] } });
      }
    } catch {
      // Reports will show empty state on error
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    loadData(startDate, endDate).then(() => { if (!active) return; }); // eslint-disable-line react-hooks/set-state-in-effect
    return () => { active = false; };
  }, [loadData, startDate, endDate]);

  const handlePreset = (idx) => {
    setActivePreset(idx);
    const range = PERIOD_PRESETS[idx].getRange();
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const handleCategoryClick = (cat) => {
    const hasSubs = cat.subcategories?.length > 0;
    if (hasSubs) {
      // Toggle expand to show subcategories
      setExpandedCat(expandedCat === cat.category_id ? null : cat.category_id);
    } else {
      // No subcategories — drill down into transactions directly
      setDrillDown({
        categoryId: cat.category_id,
        categoryName: cat.category_name,
        subcategoryId: null,
        subcategoryName: null,
      });
    }
  };

  const handleSubcategoryClick = (cat, sub) => {
    setDrillDown({
      categoryId: cat.category_id,
      categoryName: cat.category_name,
      subcategoryId: sub.subcategory_id,
      subcategoryName: sub.subcategory_name,
    });
  };

  const handleViewAllInCategory = (cat) => {
    setDrillDown({
      categoryId: cat.category_id,
      categoryName: cat.category_name,
      subcategoryId: null,
      subcategoryName: null,
    });
  };

  const handleExport = async (format) => {
    try {
      const res = await fetch(`${API}/api/reports/export/${format}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spentyai-report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || `Failed to export ${format.toUpperCase()}`);
    }
  };

  const catData = categories?.[catType] || [];
  const catTotal = catData.reduce((s, c) => s + (catType === 'expense' ? c.expense : c.income), 0);

  if (loading) {
    return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>Loading reports...</div>;
  }

  return (
    <div data-testid="reports-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>{s('reports')}</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Income, expense, and category breakdowns
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button data-testid="export-csv-btn" onClick={() => handleExport('csv')} style={{
            background: '#fff', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary)',
            padding: '8px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <DownloadSimple size={14} weight="bold" /> {s('export_csv')}
          </button>
          <button data-testid="export-pdf-btn" onClick={() => handleExport('pdf')} style={{
            background: 'var(--brand-primary)', color: '#fff', border: '1px solid var(--brand-primary)',
            padding: '8px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <DownloadSimple size={14} weight="bold" /> {s('export_pdf')}
          </button>
        </div>
      </div>

      {/* Period Filters */}
      <div data-testid="period-filters" style={{
        display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center'
      }}>
        {PERIOD_PRESETS.map((p, i) => (
          <button key={p.label} data-testid={`period-btn-${i}`}
            onClick={() => handlePreset(i)}
            style={{
              padding: '7px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
              fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 0.15s',
              background: activePreset === i ? 'var(--brand-primary)' : '#fff',
              color: activePreset === i ? '#fff' : 'var(--text-secondary)',
              border: activePreset === i ? '1px solid var(--brand-primary)' : '1px solid var(--border-strong)',
            }}>
            {p.label}
          </button>
        ))}
        <span style={{ width: 1, height: 24, background: 'var(--border-subtle)', margin: '0 4px' }} />
        <input data-testid="custom-start" type="date" value={startDate}
          onChange={e => { setStartDate(e.target.value); setActivePreset(-1); }}
          style={{ padding: '6px 10px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-body)' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
        <input data-testid="custom-end" type="date" value={endDate}
          onChange={e => { setEndDate(e.target.value); setActivePreset(-1); }}
          style={{ padding: '6px 10px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-body)' }} />
      </div>

      {/* Summary Cards */}
      <div data-testid="reports-summary" style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <SummaryCard label={s('total_income')} value={summary?.total_income} color="var(--success)" icon={TrendUp} />
        <SummaryCard label={s('total_expense')} value={summary?.total_expense} color="var(--error)" icon={TrendDown} />
        <SummaryCard label={s('net')} value={summary?.net} color={summary?.net >= 0 ? 'var(--success)' : 'var(--error)'} icon={ArrowsLeftRight} />
        <SummaryCard label={s('transactions')} value={summary?.transaction_count} color="var(--text-primary)" icon={ChartBar} />
      </div>

      {/* Period Chart */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: '24px', marginBottom: 32
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChartBar size={20} weight="duotone" style={{ color: 'var(--accent-1)' }} />
          Income vs Expense by Month
        </h2>
        <PeriodChart data={periods} />
      </div>

      {/* Category Breakdown */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        overflow: 'hidden', marginBottom: 32
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-secondary)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ChartPie size={20} weight="duotone" style={{ color: 'var(--accent-1)' }} />
            By Category
          </h2>
          <div style={{ display: 'flex', gap: 4 }}>
            <button data-testid="cat-type-expense"
              onClick={() => setCatType('expense')}
              style={{
                padding: '6px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--font-body)', cursor: 'pointer',
                background: catType === 'expense' ? 'var(--error)' : '#fff',
                color: catType === 'expense' ? '#fff' : 'var(--text-secondary)',
                border: catType === 'expense' ? '1px solid var(--error)' : '1px solid var(--border-strong)',
              }}>
              Expenses
            </button>
            <button data-testid="cat-type-income"
              onClick={() => setCatType('income')}
              style={{
                padding: '6px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--font-body)', cursor: 'pointer',
                background: catType === 'income' ? 'var(--success)' : '#fff',
                color: catType === 'income' ? '#fff' : 'var(--text-secondary)',
                border: catType === 'income' ? '1px solid var(--success)' : '1px solid var(--border-strong)',
              }}>
              Income
            </button>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <DonutChart data={catData} total={catTotal} typeLabel={catType} onSliceClick={handleCategoryClick} />
        </div>

        {/* Category Table with Subcategory Drilldown */}
        {catData.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                  <th style={thStyle}></th>
                  <th style={thStyle}>{s('category')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{s('amount')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>% of Total</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Txns</th>
                </tr>
              </thead>
              <tbody>
                {catData.map((cat, ci) => {
                  const val = catType === 'expense' ? cat.expense : cat.income;
                  const pct = catTotal > 0 ? ((val / catTotal) * 100).toFixed(1) : 0;
                  const hasSubs = cat.subcategories?.length > 0;
                  const isExpanded = expandedCat === cat.category_id;

                  return (
                    <Fragment key={cat.category_id}>
                      <tr data-testid={`cat-row-${cat.category_id}`}
                        onClick={() => handleCategoryClick(cat)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          background: isExpanded ? 'rgba(194,109,92,0.04)' : '#fff'
                        }}>
                        <td style={{ ...tdStyle, width: 30 }}>
                          {hasSubs ? (isExpanded ?
                            <CaretDown size={14} style={{ color: 'var(--text-muted)' }} /> :
                            <CaretRight size={14} style={{ color: 'var(--text-muted)' }} />
                          ) : (
                            <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                          )}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[ci % COLORS.length], flexShrink: 0 }} />
                            <span style={{ fontWeight: 600 }}>{cat.category_name}</span>
                          </div>
                        </td>
                        <td className="mono" style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(val)}
                        </td>
                        <td className="mono" style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-muted)' }}>
                          {pct}%
                        </td>
                        <td className="mono" style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
                          {cat.count}
                        </td>
                      </tr>
                      {isExpanded && (
                        <>
                          {(cat.subcategories || []).map(sub => {
                            const subVal = catType === 'expense' ? sub.expense : sub.income;
                            const subPct = catTotal > 0 ? ((subVal / catTotal) * 100).toFixed(1) : 0;
                            return (
                              <tr key={sub.subcategory_id} data-testid={`sub-row-${sub.subcategory_id}`}
                                onClick={() => handleSubcategoryClick(cat, sub)}
                                style={{
                                  borderBottom: '1px solid var(--border-subtle)',
                                  background: 'rgba(194,109,92,0.02)',
                                  cursor: 'pointer',
                                }}>
                                <td style={tdStyle}>
                                  <ArrowRight size={10} style={{ color: 'var(--text-muted)', marginLeft: 8 }} />
                                </td>
                                <td style={{ ...tdStyle, paddingLeft: 48, fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {sub.subcategory_name}
                                </td>
                                <td className="mono" style={{ ...tdStyle, textAlign: 'right', fontSize: 12 }}>
                                  {formatCurrency(subVal)}
                                </td>
                                <td className="mono" style={{ ...tdStyle, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)' }}>
                                  {subPct}%
                                </td>
                                <td className="mono" style={{ ...tdStyle, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                                  {sub.count}
                                </td>
                              </tr>
                            );
                          })}
                          {/* View all in category link */}
                          <tr onClick={() => handleViewAllInCategory(cat)}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              background: 'rgba(194,109,92,0.02)',
                              cursor: 'pointer',
                            }}>
                            <td colSpan={5} style={{ padding: '8px 16px 8px 48px', fontSize: 12, color: 'var(--brand-primary)', fontWeight: 600 }}>
                              View all transactions in {cat.category_name} →
                            </td>
                          </tr>
                        </>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Period Table */}
      {periods.length > 0 && (
        <div data-testid="period-table" style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 500 }}>{s('monthly_breakdown')}</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={thStyle}>{s('month_header')}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{s('income')}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{s('expense')}</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{s('net')}</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Txns</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p, i) => (
                <tr key={p.month} style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: i % 2 === 0 ? '#fff' : 'var(--bg-secondary)'
                }}>
                  <td style={tdStyle}>{p.month}</td>
                  <td className="mono" style={{ ...tdStyle, textAlign: 'right', color: 'var(--success)', fontWeight: 500 }}>
                    {formatCurrency(p.income)}
                  </td>
                  <td className="mono" style={{ ...tdStyle, textAlign: 'right', color: 'var(--error)', fontWeight: 500 }}>
                    {formatCurrency(p.expense)}
                  </td>
                  <td className="mono" style={{
                    ...tdStyle, textAlign: 'right', fontWeight: 600,
                    color: p.net >= 0 ? 'var(--success)' : 'var(--error)'
                  }}>
                    {p.net >= 0 ? '+' : ''}{formatCurrency(p.net)}
                  </td>
                  <td className="mono" style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
                    {p.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drill-Down Slide Panel */}
      {drillDown && (
        <>
          <Overlay onClick={() => setDrillDown(null)} />
          <TransactionDrillDown
            drillDown={drillDown}
            onClose={() => setDrillDown(null)}
            startDate={startDate}
            endDate={endDate}
            catType={catType}
          />
        </>
      )}
    </div>
  );
}

const thStyle = {
  padding: '10px 16px', textAlign: 'left', fontWeight: 600,
  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--text-muted)'
};
const tdStyle = { padding: '10px 16px' };
