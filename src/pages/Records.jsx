import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
  MagnifyingGlass, DownloadSimple, FileText, Paperclip,
  FunnelSimple, CaretDown, CaretUp, EnvelopeSimple, Archive
} from '@phosphor-icons/react';

const API = import.meta.env.REACT_APP_BACKEND_URL || '';

function formatCurrency(amount) {
  if (!amount) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

export default function Records() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [downloading, setDownloading] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 25;

  const loadRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (amountMin) params.set('amount_min', amountMin);
      if (amountMax) params.set('amount_max', amountMax);
      params.set('limit', limit);
      params.set('skip', page * limit);

      const data = await api.get(`/api/records?${params.toString()}`);
      setRecords(data.records);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load records:', err);
    }
    setLoading(false);
  }, [search, dateFrom, dateTo, amountMin, amountMax, page]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(loadRecords, 300);
    return () => clearTimeout(timer);
  }, [loadRecords]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === records.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(records.map(r => r.archive_id)));
    }
  };

  const downloadEml = (archiveId) => {
    window.open(`${API}/api/records/${archiveId}/download-eml`, '_blank');
  };

  const downloadAttachment = (archiveId, attIndex, filename) => {
    window.open(`${API}/api/records/${archiveId}/attachments/${attIndex}/download`, '_blank');
  };

  const downloadZip = async () => {
    const ids = selected.size > 0 ? [...selected] : records.map(r => r.archive_id);
    if (ids.length === 0) return;

    setDownloading(true);
    try {
      const res = await fetch(`${API}/api/records/download-zip`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive_ids: ids }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spentyai_records.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download: ' + err.message);
    }
    setDownloading(false);
  };

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
    setPage(0);
  };

  const hasActiveFilters = search || dateFrom || dateTo || amountMin || amountMax;
  const totalPages = Math.ceil(total / limit);

  if (loading && records.length === 0) {
    return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>Loading records...</div>;
  }

  return (
    <div data-testid="records-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Records</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Archived emails for approved transactions — {total} records
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            data-testid="download-zip-btn"
            onClick={downloadZip}
            disabled={downloading || total === 0}
            style={{
              background: 'var(--brand-primary)', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
              cursor: (downloading || total === 0) ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6,
              opacity: (downloading || total === 0) ? 0.6 : 1,
            }}
          >
            <DownloadSimple size={16} weight="bold" />
            {downloading ? 'Downloading...' : selected.size > 0 ? `Download ${selected.size} Selected` : 'Download All'}
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        marginBottom: 20, overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            <MagnifyingGlass size={16} style={{ color: 'var(--text-muted)', position: 'absolute', left: 12 }} />
            <input
              data-testid="records-search"
              type="text"
              placeholder="Search by subject, sender, description..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              style={{
                width: '100%', padding: '10px 12px 10px 36px',
                border: '1px solid var(--border-strong)', borderRadius: 2,
                fontSize: 13, fontFamily: 'var(--font-body)', background: 'var(--bg-primary)',
              }}
            />
          </div>
          <button
            data-testid="toggle-filters-btn"
            onClick={() => setShowFilters(!showFilters)}
            style={{
              background: hasActiveFilters ? 'var(--brand-primary)' : 'var(--bg-primary)',
              color: hasActiveFilters ? '#fff' : 'var(--text-secondary)',
              border: hasActiveFilters ? 'none' : '1px solid var(--border-strong)',
              padding: '10px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <FunnelSimple size={14} />
            Filters
            {showFilters ? <CaretUp size={12} /> : <CaretDown size={12} />}
          </button>
          {hasActiveFilters && (
            <button
              data-testid="clear-filters-btn"
              onClick={clearFilters}
              style={{
                background: 'none', border: 'none', color: 'var(--error)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end',
          }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date From</label>
              <input data-testid="filter-date-from" type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(0); }}
                style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date To</label>
              <input data-testid="filter-date-to" type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(0); }}
                style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Min Amount</label>
              <input data-testid="filter-amount-min" type="number" placeholder="0" value={amountMin}
                onChange={e => { setAmountMin(e.target.value); setPage(0); }}
                style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', width: 120 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Max Amount</label>
              <input data-testid="filter-amount-max" type="number" placeholder="Any" value={amountMax}
                onChange={e => { setAmountMax(e.target.value); setPage(0); }}
                style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', width: 120 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Records Table */}
      {records.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, background: '#fff',
          border: '1px solid var(--border-subtle)', borderRadius: 2,
        }}>
          <Archive size={40} weight="duotone" style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            {hasActiveFilters ? 'No records match your filters' : 'No archived records yet'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 420, margin: '0 auto' }}>
            {hasActiveFilters
              ? 'Try adjusting your filters or search terms.'
              : 'Emails are archived when you approve transactions detected from your inbox.'}
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', width: 40 }}>
                  <input
                    data-testid="select-all-records"
                    type="checkbox"
                    checked={selected.size === records.length && records.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>From</th>
                <th style={{ ...thStyle, maxWidth: 280 }}>Subject</th>
                <th style={thStyle}>Type</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Files</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.archive_id} data-testid={`record-${record.archive_id}`}
                  style={{ borderBottom: '1px solid var(--border-subtle)', background: selected.has(record.archive_id) ? 'rgba(194,109,92,0.04)' : 'transparent' }}
                >
                  <td style={{ padding: '10px 16px' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(record.archive_id)}
                      onChange={() => toggleSelect(record.archive_id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td className="mono" style={{ padding: '10px 16px', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {record.date}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {record.from_email}
                  </td>
                  <td style={{ padding: '10px 16px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <EnvelopeSimple size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span title={record.subject}>{record.subject || '(no subject)'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                      color: record.transaction_type === 'income' ? 'var(--success)' : record.transaction_type === 'expense' ? 'var(--error)' : 'var(--info)',
                      background: record.transaction_type === 'income' ? 'rgba(58,92,74,0.1)' : record.transaction_type === 'expense' ? 'rgba(150,69,58,0.1)' : 'rgba(74,110,125,0.1)',
                    }}>
                      {record.transaction_type}
                    </span>
                  </td>
                  <td className="mono" style={{
                    padding: '10px 16px', textAlign: 'right', fontWeight: 600,
                    color: record.transaction_type === 'income' ? 'var(--success)' : 'var(--error)',
                  }}>
                    {formatCurrency(record.transaction_amount)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    {record.attachment_count > 0 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--info)', fontSize: 12, fontWeight: 600 }}>
                        <Paperclip size={13} /> {record.attachment_count}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <RecordActions record={record} onDownloadEml={downloadEml} onDownloadAttachment={downloadAttachment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--bg-secondary)',
            }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  data-testid="records-prev-page"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={pageBtnStyle(page === 0)}
                >
                  Previous
                </button>
                <button
                  data-testid="records-next-page"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  style={pageBtnStyle(page >= totalPages - 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecordActions({ record, onDownloadEml, onDownloadAttachment }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
        <button
          data-testid={`download-eml-${record.archive_id}`}
          onClick={() => onDownloadEml(record.archive_id)}
          title="Download .eml"
          style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-strong)',
            borderRadius: 2, padding: '5px 10px', cursor: 'pointer', fontSize: 11,
            fontWeight: 600, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 3,
            color: 'var(--text-secondary)',
          }}
        >
          <FileText size={12} /> .eml
        </button>
        {record.attachment_count > 0 && (
          <button
            data-testid={`toggle-attachments-${record.archive_id}`}
            onClick={() => setExpanded(!expanded)}
            title="View attachments"
            style={{
              background: 'var(--bg-primary)', border: '1px solid var(--border-strong)',
              borderRadius: 2, padding: '5px 10px', cursor: 'pointer', fontSize: 11,
              fontWeight: 600, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 3,
              color: 'var(--info)',
            }}
          >
            <Paperclip size={12} /> {record.attachment_count}
            {expanded ? <CaretUp size={10} /> : <CaretDown size={10} />}
          </button>
        )}
      </div>
      {expanded && record.attachments && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 10,
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 220, padding: 8,
        }}>
          {record.attachments.map((att, i) => (
            <button
              key={i}
              data-testid={`download-att-${record.archive_id}-${i}`}
              onClick={() => { onDownloadAttachment(record.archive_id, i, att.filename); setExpanded(false); }}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '6px 8px', cursor: 'pointer', fontSize: 12, borderRadius: 2,
                display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <DownloadSimple size={12} style={{ color: 'var(--info)' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {att.size ? `${Math.round(att.size / 1024)}KB` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)',
};

const pageBtnStyle = (disabled) => ({
  background: disabled ? 'var(--bg-secondary)' : 'var(--bg-primary)',
  border: '1px solid var(--border-strong)',
  padding: '6px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
  color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
  opacity: disabled ? 0.5 : 1,
});
