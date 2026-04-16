import { useState, useEffect, useCallback, Fragment } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import {
  FileText, Upload, ArrowClockwise, Check, X, Warning,
  CheckCircle, XCircle, Question, Scales, Trash, Eye, LockKey
} from '@phosphor-icons/react';

const API = import.meta.env.REACT_APP_BACKEND_URL;

function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

const thStyle = {
  padding: '10px 16px', textAlign: 'left', fontWeight: 600,
  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--text-muted)'
};
const tdStyle = { padding: '10px 16px' };
// Tighter variants used on the Uploaded Statements table so the whole
// page (header + upload + history) fits in a single viewport.
const thStyleCompact = { ...thStyle, padding: '8px 12px', fontSize: 10.5 };
const tdStyleCompact = { padding: '8px 12px' };

function ProcessingBar({ stmt }) {
  // Simple, honest progress read-out: just a bar, a stage label, and a
  // percentage. No elapsed / ETA / chunk-count noise — those distracted
  // from what the user actually wants to know (how close is this to done).
  const progress = Math.max(0, Math.min(100, stmt.processing_progress || 5));
  const label = stmt.processing_stage_label || 'Queued';
  return (
    <div style={{ marginTop: 6, minWidth: 140 }}>
      <div style={{
        height: 4, borderRadius: 2, background: 'var(--bg-secondary)',
        overflow: 'hidden', position: 'relative'
      }}>
        <div style={{
          width: `${progress}%`, height: '100%',
          background: 'var(--accent-1)',
          transition: 'width 600ms ease',
        }} />
      </div>
      <div className="mono" style={{
        marginTop: 4, fontSize: 10.5, color: 'var(--text-muted)',
        letterSpacing: '0.02em', whiteSpace: 'nowrap',
      }}>
        {label} · {progress}%
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    parsing: { bg: 'rgba(74,110,125,0.12)', color: 'var(--info)', label: 'Parsing...' },
    parsed: { bg: 'rgba(194,140,60,0.12)', color: 'var(--warning)', label: 'Ready to Reconcile' },
    reconciled: { bg: 'rgba(58,92,74,0.12)', color: 'var(--success)', label: 'Reconciled' },
    parse_failed: { bg: 'rgba(150,69,58,0.12)', color: 'var(--error)', label: 'Parse Failed' },
    password_required: { bg: 'rgba(194,140,60,0.12)', color: 'var(--warning)', label: 'Password Needed' },
  };
  const s = map[status] || map.parsing;
  return (
    <span data-testid={`status-badge-${status}`} style={{
      padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.05em'
    }}>{s.label}</span>
  );
}

export default function Reconciliation() {
  const cached = getCached('reconciliation');
  const [statements, setStatements] = useState(cached?.statements || []);
  const [accounts, setAccounts] = useState(cached?.accounts || []);
  const [loading, setLoading] = useState(!cached);
  const [uploading, setUploading] = useState(false);
  const [selectedSubType, setSelectedSubType] = useState('savings');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [statementType, setStatementType] = useState('bank');
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [activeStmt, setActiveStmt] = useState(null);
  const [reconciling, setReconciling] = useState(false);
  const [addingMissing, setAddingMissing] = useState(false);
  const [selectedMissing, setSelectedMissing] = useState([]);
  const [unlockingId, setUnlockingId] = useState('');
  const [pwInputs, setPwInputs] = useState({});
  const [unlockErrors, setUnlockErrors] = useState({});
  const [reauditing, setReauditing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [savingEntryIdx, setSavingEntryIdx] = useState(-1);

  const SUB_TYPE_OPTIONS = [
    { value: 'savings', label: 'Savings', statementType: 'bank' },
    { value: 'current', label: 'Current', statementType: 'bank' },
    { value: 'bank', label: 'Bank', statementType: 'bank' },
    { value: 'credit_card', label: 'Credit Card', statementType: 'credit_card' },
    { value: 'wallet', label: 'Wallet', statementType: 'bank' },
    { value: 'cash', label: 'Cash', statementType: 'bank' },
    { value: 'loan', label: 'Loan', statementType: 'loan' },
    { value: 'mortgage', label: 'Mortgage', statementType: 'loan' },
  ];

  const filteredAccounts = accounts.filter(a => (a.sub_type || '').toLowerCase() === selectedSubType);

  const loadData = useCallback(async () => {
    try {
      const [stmtRes, accs, cats] = await Promise.all([
        api.get('/api/statements/list', { bypassCache: true }),
        api.get('/api/accounts'),
        api.get('/api/categories').catch(() => []),
      ]);
      setStatements(stmtRes.statements || []);
      setAccounts(accs);
      setCategories(Array.isArray(cats) ? cats : (cats?.categories || []));
      setCache('reconciliation', { statements: stmtRes.statements || [], accounts: accs });
      // Keep selected account only if it still matches the chosen sub-type.
      setSelectedAccountId(prev => {
        const match = accs.find(a => a.account_id === prev);
        return match ? prev : '';
      });
    } catch {
      // Reconciliation will show empty state on error
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    loadData().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [loadData]);

  // Poll while any statement is still parsing so the progress bar advances
  // without the user having to refresh. Stops automatically once no rows are
  // in a processing state.
  useEffect(() => {
    const anyProcessing = statements.some(s => s.status === 'parsing');
    if (!anyProcessing) return;
    const id = setInterval(() => { loadData(); }, 1500);
    return () => clearInterval(id);
  }, [statements, loadData]);

  // Tick every second so the "elapsed seconds" readout on each progress bar
  // updates smoothly even between polls.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const anyProcessing = statements.some(s => s.status === 'parsing');
    if (!anyProcessing) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [statements]);

  // When sub-type changes, clear selected account if it no longer matches and
  // auto-pick the first account of that sub-type. Also sync statement_type.
  useEffect(() => {
    const opt = SUB_TYPE_OPTIONS.find(o => o.value === selectedSubType);
    if (opt) setStatementType(opt.statementType);
    const matches = accounts.filter(a => (a.sub_type || '').toLowerCase() === selectedSubType);
    setSelectedAccountId(prev => {
      if (prev && matches.some(a => a.account_id === prev)) return prev;
      return matches.length > 0 ? matches[0].account_id : '';
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubType, accounts]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedAccountId) { setError('Please select an account'); return; }
    if (!periodFrom || !periodTo) { setError('Please select the statement period'); return; }
    if (periodFrom > periodTo) { setError('Period From cannot be after Period To'); return; }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'pdf'].includes(ext)) {
      setError('Only CSV and PDF files are supported');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('account_id', selectedAccountId);
      formData.append('statement_type', statementType);
      formData.append('period_from', periodFrom);
      formData.append('period_to', periodTo);

      const resp = await fetch(`${API}/api/statements/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Upload failed');
      }
      e.target.value = '';
      setTimeout(loadData, 2000);
      setTimeout(loadData, 5000);
    } catch (err) { setError(err.message); }
    setUploading(false);
  };

  const handleViewStatement = async (stmtId) => {
    try {
      const stmt = await api.get(`/api/statements/${stmtId}`, { bypassCache: true });
      setActiveStmt(stmt);
      setSelectedMissing([]);
    } catch (err) { setError(err.message); }
  };

  const handleReconcile = async () => {
    if (!activeStmt) return;
    setReconciling(true);
    setError('');
    try {
      const result = await api.post(`/api/statements/${activeStmt.statement_id}/reconcile`);
      setActiveStmt(prev => ({ ...prev, reconciliation: result, status: 'reconciled' }));
      loadData();
    } catch (err) { setError(err.message); }
    setReconciling(false);
  };

  const handleReaudit = async () => {
    if (!activeStmt) return;
    setReauditing(true);
    setError('');
    try {
      await api.post(`/api/statements/${activeStmt.statement_id}/reaudit`);
      // Close modal — the row's inline progress bar picks it up from here
      // exactly like unlock/upload does.
      setActiveStmt(null);
      loadData();
    } catch (err) { setError(err.message); }
    setReauditing(false);
  };

  const handleUpdateEntryCategory = async (entryIndex, categoryId, subcategoryId) => {
    if (!activeStmt) return;
    setSavingEntryIdx(entryIndex);
    try {
      const res = await api.patch(
        `/api/statements/${activeStmt.statement_id}/entries/${entryIndex}`,
        { category_id: categoryId || null, subcategory_id: subcategoryId || null },
      );
      setActiveStmt(prev => {
        if (!prev) return prev;
        const entries = [...(prev.parsed_entries || [])];
        entries[entryIndex] = res.entry;
        return { ...prev, parsed_entries: entries };
      });
    } catch (err) { setError(err.message); }
    setSavingEntryIdx(-1);
  };

  const handleAddMissing = async () => {
    if (!activeStmt || selectedMissing.length === 0) return;
    setAddingMissing(true);
    setError('');
    try {
      await api.post(`/api/statements/${activeStmt.statement_id}/add-missing`, {
        entry_indices: selectedMissing,
      });
      setSelectedMissing([]);
      const stmt = await api.get(`/api/statements/${activeStmt.statement_id}`, { bypassCache: true });
      setActiveStmt(stmt);
      loadData();
    } catch (err) { setError(err.message); }
    setAddingMissing(false);
  };

  const handleDelete = async (stmtId) => {
    if (!confirm('Delete this statement?')) return;
    try {
      await api.del(`/api/statements/${stmtId}`);
      if (activeStmt?.statement_id === stmtId) setActiveStmt(null);
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleRetryParse = async (stmtId) => {
    try {
      await api.post(`/api/statements/${stmtId}/reaudit`);
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleUnlock = async (stmtId) => {
    const pw = (pwInputs[stmtId] || '').trim();
    if (!pw) {
      setUnlockErrors(prev => ({ ...prev, [stmtId]: 'Enter a password' }));
      return;
    }
    setUnlockingId(stmtId);
    setUnlockErrors(prev => ({ ...prev, [stmtId]: '' }));
    try {
      // Backend validates the password quickly (~1s) and returns 202 while
      // parsing continues in the background. The row's progress bar takes
      // over from here, so we don't need to keep the button in "unlocking"
      // state for the full parse.
      await api.post(`/api/statements/${stmtId}/unlock`, { password: pw });
      setPwInputs(prev => ({ ...prev, [stmtId]: '' }));
      setUnlockingId('');
      loadData();
    } catch (err) {
      setUnlockErrors(prev => ({ ...prev, [stmtId]: err.message || 'Unlock failed' }));
      setUnlockingId('');
    }
  };

  const toggleMissing = (idx) => {
    setSelectedMissing(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const getAccountName = (id) => accounts.find(a => a.account_id === id)?.name || 'Unknown';

  if (loading) {
    return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>Loading...</div>;
  }

  const recon = activeStmt?.reconciliation;

  return (
    <div data-testid="reconciliation-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>Statement Reconciliation</h1>
        <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>
          Upload bank or credit card statements to detect missing entries, duplicates, and conflicts
        </p>
      </div>

      {error && (
        <div data-testid="reconciliation-error" style={{
          background: 'rgba(150,69,58,0.1)', border: '1px solid var(--error)',
          borderRadius: 2, padding: '12px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--error)'
        }}>
          <Warning size={16} weight="bold" /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Upload Section — compact single-strip layout so the entire page
          fits in one viewport without scrolling. */}
      <div data-testid="upload-section" style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: '14px 16px', marginBottom: 16
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <h3 style={{
            fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            marginRight: 4, paddingBottom: 6,
          }}>
            <Upload size={15} weight="duotone" style={{ color: 'var(--accent-1)' }} /> Upload
          </h3>
          <div>
            <label className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Sub-type</label>
            <select data-testid="subtype-select" value={selectedSubType}
              onChange={e => setSelectedSubType(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 12.5, fontFamily: 'var(--font-body)', minWidth: 130 }}>
              {SUB_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Account</label>
            <select data-testid="account-select" value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              disabled={filteredAccounts.length === 0}
              style={{ padding: '6px 10px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 12.5, fontFamily: 'var(--font-body)', minWidth: 180 }}>
              {filteredAccounts.length === 0 && (
                <option value="">No {SUB_TYPE_OPTIONS.find(o => o.value === selectedSubType)?.label.toLowerCase()} accounts</option>
              )}
              {filteredAccounts.map(a => (
                <option key={a.account_id} value={a.account_id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Period From</label>
            <input data-testid="period-from" type="date" value={periodFrom}
              onChange={e => setPeriodFrom(e.target.value)} max={periodTo}
              style={{ padding: '6px 10px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 12.5, fontFamily: 'var(--font-body)', background: '#fff' }} />
          </div>
          <div>
            <label className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Period To</label>
            <input data-testid="period-to" type="date" value={periodTo}
              onChange={e => setPeriodTo(e.target.value)} min={periodFrom}
              style={{ padding: '6px 10px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 12.5, fontFamily: 'var(--font-body)', background: '#fff' }} />
          </div>
          <div>
            <label className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>File (CSV or PDF)</label>
            <input data-testid="file-input" type="file" accept=".csv,.pdf"
              onChange={handleUpload}
              disabled={uploading || filteredAccounts.length === 0 || !selectedAccountId || !periodFrom || !periodTo}
              style={{ padding: '4px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 12.5, fontFamily: 'var(--font-body)' }} />
          </div>
          {uploading && (
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 6 }}>
              <ArrowClockwise size={13} className="spin" /> Uploading & parsing...
            </span>
          )}
        </div>
      </div>

      {/* Statement History — compact header + tighter rows to keep
          the whole page in one viewport. */}
      {statements.length > 0 && (
        <div data-testid="statement-history" style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
          overflowX: 'auto', marginBottom: 16
        }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={15} weight="duotone" style={{ color: 'var(--text-secondary)' }} />
              Uploaded Statements
              <span className="mono" style={{ fontSize: 11, padding: '1px 6px', background: 'var(--bg-primary)', borderRadius: 2, color: 'var(--text-muted)' }}>
                {statements.length}
              </span>
            </h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 650 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={thStyleCompact}>File</th>
                <th style={thStyleCompact}>Account</th>
                <th style={thStyleCompact}>Type</th>
                <th style={thStyleCompact}>Entries</th>
                <th style={thStyleCompact}>Period</th>
                <th style={thStyleCompact}>Status</th>
                <th style={thStyleCompact}>Uploaded</th>
                <th style={{ ...thStyleCompact, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {statements.map(stmt => (
                <Fragment key={stmt.statement_id}>
                <tr data-testid={`stmt-row-${stmt.statement_id}`}
                  style={{
                    borderBottom: (stmt.status === 'password_required' || stmt.status === 'parse_failed')
                      ? 'none' : '1px solid var(--border-subtle)',
                    background: activeStmt?.statement_id === stmt.statement_id ? 'rgba(194,109,92,0.05)' : '#fff'
                  }}>
                  <td style={tdStyleCompact}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={14} weight="duotone" style={{ color: stmt.file_ext === 'pdf' ? '#E53E3E' : '#38A169' }} />
                      {stmt.filename}
                    </span>
                  </td>
                  <td style={tdStyleCompact}>{stmt.account_name || getAccountName(stmt.account_id)}</td>
                  <td style={tdStyleCompact}>{stmt.statement_type === 'credit_card' ? 'Credit Card' : 'Bank'}</td>
                  <td className="mono" style={tdStyleCompact}>{stmt.entry_count ?? '—'}</td>
                  <td className="mono" style={{ ...tdStyleCompact, fontSize: 11.5, whiteSpace: 'nowrap' }}>
                    {stmt.period_from && stmt.period_to
                      ? `${stmt.period_from} → ${stmt.period_to}`
                      : '—'}
                  </td>
                  <td style={tdStyleCompact}>
                    <StatusBadge status={stmt.status} />
                    {stmt.status === 'parsing' && (() => {
                      const updatedAt = stmt.processing_updated_at ? new Date(stmt.processing_updated_at).getTime() : 0;
                      const idleSec = updatedAt ? Math.max(0, (nowTick - updatedAt) / 1000) : 0;
                      // Only flag as stuck once we're past the backend watchdog
                      // threshold (8 min). A single OpenAI chunk call can
                      // legitimately take up to 4 min on large PDFs, so anything
                      // shorter produces false positives during normal parsing.
                      const looksStuck = updatedAt && idleSec > 8 * 60;
                      return (
                        <>
                          <ProcessingBar stmt={stmt} />
                          {looksStuck && (
                            <div data-testid={`stmt-stuck-${stmt.statement_id}`} style={{
                              marginTop: 6, padding: '6px 8px',
                              background: 'rgba(194,140,60,0.08)', border: '1px solid rgba(194,140,60,0.3)',
                              borderRadius: 2, fontSize: 10.5, color: 'var(--text-secondary)',
                              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                            }}>
                              <span style={{ fontWeight: 600, color: 'var(--warning)' }}>Looks stuck</span>
                              <span className="mono" style={{ color: 'var(--text-muted)' }}>
                                no progress for {Math.round(idleSec / 60)} min
                              </span>
                              <button data-testid={`stmt-retry-${stmt.statement_id}`}
                                onClick={() => handleRetryParse(stmt.statement_id)}
                                style={{
                                  background: 'var(--brand-primary)', color: '#fff', border: 'none',
                                  borderRadius: 2, padding: '3px 10px', fontSize: 10.5, fontWeight: 600,
                                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                                }}>Retry</button>
                              <button data-testid={`stmt-cancel-${stmt.statement_id}`}
                                onClick={() => handleDelete(stmt.statement_id)}
                                style={{
                                  background: 'none', color: 'var(--text-secondary)',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: 2, padding: '3px 10px', fontSize: 10.5, fontWeight: 600,
                                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                                }}>Cancel</button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="mono" style={{ ...tdStyleCompact, fontSize: 11.5 }}>
                    {stmt.uploaded_at ? new Date(stmt.uploaded_at).toLocaleDateString() : ''}
                  </td>
                  <td style={{ ...tdStyleCompact, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      {stmt.status !== 'password_required' && (
                        <button data-testid={`view-stmt-${stmt.statement_id}`}
                          onClick={() => handleViewStatement(stmt.statement_id)}
                          style={{
                            background: 'var(--brand-primary)', color: '#fff', border: 'none',
                            borderRadius: 2, padding: '4px 10px', cursor: 'pointer', fontSize: 10.5,
                            fontWeight: 600, fontFamily: 'var(--font-body)',
                            display: 'flex', alignItems: 'center', gap: 3
                          }}>
                          <Eye size={11} weight="bold" /> View
                        </button>
                      )}
                      <button data-testid={`delete-stmt-${stmt.statement_id}`}
                        onClick={() => handleDelete(stmt.statement_id)}
                        style={{
                          background: 'none', border: '1px solid var(--error)', color: 'var(--error)',
                          borderRadius: 2, padding: '4px 10px', cursor: 'pointer', fontSize: 10.5,
                          fontWeight: 600, fontFamily: 'var(--font-body)',
                          display: 'flex', alignItems: 'center', gap: 3
                        }}>
                        <Trash size={11} weight="bold" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {stmt.status === 'password_required' && (
                  <tr data-testid={`unlock-row-${stmt.statement_id}`}
                    style={{ borderBottom: '1px solid var(--border-subtle)', background: '#fff' }}>
                    <td colSpan={8} style={{ padding: '10px 16px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <LockKey size={16} weight="duotone" style={{ color: 'var(--warning)' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          This PDF is password protected. Enter the password to parse it — we'll remember it for this account.
                        </span>
                        <input
                          data-testid={`pw-input-${stmt.statement_id}`}
                          type="password"
                          placeholder="PDF password"
                          value={pwInputs[stmt.statement_id] || ''}
                          onChange={e => setPwInputs(prev => ({ ...prev, [stmt.statement_id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleUnlock(stmt.statement_id); }}
                          style={{
                            padding: '8px 14px', border: '1px solid var(--border-strong)', borderRadius: 2,
                            fontSize: 13, fontFamily: 'var(--font-body)', background: '#fff', minWidth: 200,
                          }}
                        />
                        <button
                          data-testid={`unlock-btn-${stmt.statement_id}`}
                          onClick={() => handleUnlock(stmt.statement_id)}
                          disabled={unlockingId === stmt.statement_id}
                          style={{
                            background: 'var(--brand-primary)', color: '#fff', border: 'none',
                            borderRadius: 2, padding: '7px 16px', cursor: unlockingId === stmt.statement_id ? 'not-allowed' : 'pointer',
                            fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)',
                            opacity: unlockingId === stmt.statement_id ? 0.6 : 1,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                          <LockKey size={12} weight="bold" />
                          {unlockingId === stmt.statement_id ? 'Unlocking…' : 'Unlock'}
                        </button>
                        {unlockErrors[stmt.statement_id] && (
                          <span style={{ fontSize: 12, color: 'var(--error)' }}>
                            {unlockErrors[stmt.statement_id]}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {stmt.status === 'parse_failed' && (
                  <tr data-testid={`failed-row-${stmt.statement_id}`}
                    style={{ borderBottom: '1px solid var(--border-subtle)', background: '#fff' }}>
                    <td colSpan={8} style={{ padding: '10px 16px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {stmt.parse_error || 'Parse failed.'}
                        </span>
                        <button data-testid={`failed-retry-${stmt.statement_id}`}
                          onClick={() => handleRetryParse(stmt.statement_id)}
                          style={{
                            background: 'var(--brand-primary)', color: '#fff', border: 'none',
                            borderRadius: 2, padding: '5px 12px', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'var(--font-body)',
                          }}>Retry</button>
                        <button data-testid={`failed-delete-${stmt.statement_id}`}
                          onClick={() => handleDelete(stmt.statement_id)}
                          style={{
                            background: 'none', color: 'var(--text-secondary)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 2, padding: '5px 12px', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'var(--font-body)',
                          }}>Delete & Re-upload</button>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Active Statement Detail */}
      {activeStmt && (
        <div data-testid="statement-detail">
          {/* Parsed Entries */}
          <div style={{
            background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
            overflow: 'hidden', marginBottom: 24
          }}>
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--bg-secondary)'
            }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>
                  {activeStmt.filename} — {activeStmt.parsed_entries?.length || 0} entries
                </h3>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Account: {activeStmt.account_name || getAccountName(activeStmt.account_id)}
                  {typeof activeStmt.raw_text_chars === 'number' && activeStmt.raw_text_chars > 0 && (
                    <> · {activeStmt.raw_text_chars.toLocaleString()} chars read</>
                  )}
                </span>
                {activeStmt.audit_status && activeStmt.audit_status !== 'skipped' && (
                  <div style={{ marginTop: 4 }}>
                    <span
                      title={
                        (activeStmt.audit_issues && activeStmt.audit_issues.length)
                          ? activeStmt.audit_issues.join('\n')
                          : `Parsed ${activeStmt.audit_parsed_count ?? '—'} of ~${activeStmt.audit_expected_count ?? '—'} detected rows`
                      }
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px', borderRadius: 2, fontSize: 10.5, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: 0.3,
                        color: activeStmt.audit_status === 'verified' || activeStmt.audit_status === 'corrected'
                          ? 'var(--success)' : 'var(--warning, #8a6a1f)',
                        background: activeStmt.audit_status === 'verified' || activeStmt.audit_status === 'corrected'
                          ? 'rgba(58,92,74,0.1)' : 'rgba(200,150,40,0.12)',
                      }}
                    >
                      {activeStmt.audit_status === 'verified' && '✓ Audit verified'}
                      {activeStmt.audit_status === 'corrected' && '✓ Auto-corrected'}
                      {activeStmt.audit_status === 'corrected_with_warnings' && `⚠ Corrected · ${activeStmt.audit_issues?.length || 0} issue(s)`}
                      {activeStmt.audit_status === 'issues_found' && `⚠ ${activeStmt.audit_issues?.length || 0} audit issue(s)`}
                    </span>
                  </div>
                )}
              </div>
              {activeStmt.status === 'parsed' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    data-testid="reaudit-btn"
                    onClick={handleReaudit}
                    disabled={reauditing || reconciling}
                    title="Re-parse the source file and re-run the completeness/balance audit"
                    style={{
                      background: '#fff', color: 'var(--text-primary)',
                      border: '1px solid var(--border-strong)',
                      padding: '10px 18px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                      cursor: (reauditing || reconciling) ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-body)',
                      display: 'flex', alignItems: 'center', gap: 6,
                      opacity: (reauditing || reconciling) ? 0.6 : 1,
                    }}>
                    <ArrowClockwise size={16} weight="bold" /> {reauditing ? 'Starting...' : 'Re-run audit'}
                  </button>
                  <button data-testid="reconcile-btn" data-guard onClick={handleReconcile} disabled={reconciling}
                    style={{
                      background: 'var(--brand-primary)', color: '#fff', border: 'none',
                      padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                      cursor: reconciling ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                      display: 'flex', alignItems: 'center', gap: 6,
                      opacity: reconciling ? 0.6 : 1
                    }}>
                    <Scales size={16} weight="bold" /> {reconciling ? 'Reconciling...' : 'Reconcile with Ledger'}
                  </button>
                </div>
              )}
            </div>

            {activeStmt.parsed_entries?.length > 0 && !recon && (
              // table-layout:fixed + percentage column widths so long IMPS
              // descriptions wrap into the Description cell instead of pushing
              // Amount / Balance off the right edge of the viewport.
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: 12.5,
                tableLayout: 'fixed',
              }}>
                <colgroup>
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                    <th style={thStyleCompact}>Date</th>
                    <th style={thStyleCompact}>Type</th>
                    <th style={thStyleCompact}>Description</th>
                    <th style={thStyleCompact}>Category</th>
                    <th style={thStyleCompact}>Subcategory</th>
                    <th style={{ ...thStyleCompact, textAlign: 'right' }}>Amount</th>
                    <th style={{ ...thStyleCompact, textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStmt.parsed_entries.map((e, i) => (
                    <tr key={`${e.date}-${e.amount}-${i}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="mono" style={{ ...tdStyleCompact, fontSize: 11.5 }}>{e.date}</td>
                      <td style={tdStyleCompact}>
                        <span style={{
                          padding: '2px 6px', borderRadius: 2, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase',
                          color: e.transaction_type === 'income' ? 'var(--success)' : 'var(--error)',
                          background: e.transaction_type === 'income' ? 'rgba(58,92,74,0.1)' : 'rgba(150,69,58,0.1)'
                        }}>{e.transaction_type}</span>
                      </td>
                      <td style={{ ...tdStyleCompact, wordBreak: 'break-word' }}>{e.description || '—'}</td>
                      {(() => {
                        const kind = e.transaction_type === 'income' ? 'income' : 'expense';
                        const topCats = categories.filter(c => !c.parent_id && c.category_type === kind);
                        const subCats = categories.filter(c => c.parent_id && c.parent_id === e.category_id);
                        const selectStyle = {
                          padding: '4px 6px', border: '1px solid var(--border-subtle)',
                          borderRadius: 2, fontSize: 11.5, fontFamily: 'var(--font-body)',
                          background: '#fff', width: '100%', boxSizing: 'border-box',
                          opacity: savingEntryIdx === i ? 0.6 : 1,
                        };
                        return (
                          <>
                            <td style={tdStyleCompact}>
                              <select
                                value={e.category_id || ''}
                                disabled={savingEntryIdx === i}
                                onChange={(ev) => handleUpdateEntryCategory(i, ev.target.value, null)}
                                style={selectStyle}
                                data-testid={`entry-cat-${i}`}
                              >
                                <option value="">—</option>
                                {topCats.map(c => (
                                  <option key={c.category_id} value={c.category_id}>{c.name}</option>
                                ))}
                              </select>
                            </td>
                            <td style={tdStyleCompact}>
                              <select
                                value={e.subcategory_id || ''}
                                disabled={savingEntryIdx === i || !e.category_id || subCats.length === 0}
                                onChange={(ev) => handleUpdateEntryCategory(i, e.category_id, ev.target.value)}
                                style={selectStyle}
                                data-testid={`entry-sub-${i}`}
                              >
                                <option value="">—</option>
                                {subCats.map(c => (
                                  <option key={c.category_id} value={c.category_id}>{c.name}</option>
                                ))}
                              </select>
                            </td>
                          </>
                        );
                      })()}
                      <td className="mono" style={{
                        ...tdStyleCompact, textAlign: 'right', fontWeight: 600,
                        color: e.transaction_type === 'income' ? 'var(--success)' : 'var(--error)'
                      }}>{formatCurrency(e.amount)}</td>
                      <td className="mono" style={{ ...tdStyleCompact, textAlign: 'right', color: 'var(--text-muted)' }}>
                        {e.balance ? formatCurrency(e.balance) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Reconciliation Results */}
          {recon && (
            <div data-testid="reconciliation-results">
              {/* Summary Cards */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <SummaryPill icon={CheckCircle} label="Matched" value={recon.summary.matched} color="var(--success)" />
                <SummaryPill icon={Question} label="Missing from Ledger" value={recon.summary.missing_from_ledger} color="var(--warning)" />
                <SummaryPill icon={XCircle} label="Missing from Statement" value={recon.summary.missing_from_statement} color="var(--info)" />
                <SummaryPill icon={Warning} label="Conflicts" value={recon.summary.conflicts} color="var(--error)" />
              </div>

              {/* Matched */}
              {recon.matched?.length > 0 && (
                <ReconSection title="Matched Entries" icon={CheckCircle} color="var(--success)" count={recon.matched.length}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Description (Statement)</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                        <th style={thStyle}>Ledger Match</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recon.matched.map((m, i) => (
                        <tr key={`match-${m.statement_entry.date}-${m.statement_entry.amount}-${i}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="mono" style={{ ...tdStyle, fontSize: 12 }}>{m.statement_entry.date}</td>
                          <td style={tdStyle}>{m.statement_entry.description}</td>
                          <td className="mono" style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(m.statement_entry.amount)}</td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>{m.ledger_transaction.description}</td>
                          <td className="mono" style={{ ...tdStyle, textAlign: 'center', color: 'var(--success)' }}>{m.match_score}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ReconSection>
              )}

              {/* Missing from Ledger */}
              {recon.missing_from_ledger?.length > 0 && (
                <ReconSection title="Missing from Ledger" icon={Question} color="var(--warning)" count={recon.missing_from_ledger.length}
                  action={selectedMissing.length > 0 && (
                    <button data-testid="add-missing-btn" onClick={handleAddMissing} disabled={addingMissing}
                      style={{
                        background: 'var(--success)', color: '#fff', border: 'none',
                        padding: '6px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                        cursor: addingMissing ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                      <Check size={12} weight="bold" /> Add {selectedMissing.length} to Ledger
                    </button>
                  )}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                        <th style={{ ...thStyle, width: 40 }}></th>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Type</th>
                        <th style={thStyle}>Description</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recon.missing_from_ledger.map((entry, i) => (
                        <tr key={`missing-ledger-${entry.date}-${entry.amount}-${i}`} data-testid={`missing-entry-${i}`} style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: selectedMissing.includes(i) ? 'rgba(194,140,60,0.08)' : '#fff'
                        }}>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <input type="checkbox" checked={selectedMissing.includes(i)}
                              onChange={() => toggleMissing(i)}
                              data-testid={`missing-checkbox-${i}`}
                              style={{ cursor: 'pointer', width: 16, height: 16 }} />
                          </td>
                          <td className="mono" style={{ ...tdStyle, fontSize: 12 }}>{entry.date}</td>
                          <td style={tdStyle}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                              color: entry.transaction_type === 'income' ? 'var(--success)' : 'var(--error)',
                              background: entry.transaction_type === 'income' ? 'rgba(58,92,74,0.1)' : 'rgba(150,69,58,0.1)'
                            }}>{entry.transaction_type}</span>
                          </td>
                          <td style={tdStyle}>{entry.description}</td>
                          <td className="mono" style={{
                            ...tdStyle, textAlign: 'right', fontWeight: 600,
                            color: entry.transaction_type === 'income' ? 'var(--success)' : 'var(--error)'
                          }}>{formatCurrency(entry.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ReconSection>
              )}

              {/* Missing from Statement */}
              {recon.missing_from_statement?.length > 0 && (
                <ReconSection title="In Ledger but Missing from Statement" icon={XCircle} color="var(--info)" count={recon.missing_from_statement.length}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Type</th>
                        <th style={thStyle}>Description</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recon.missing_from_statement.map((entry, i) => (
                        <tr key={`missing-stmt-${entry.date}-${entry.amount}-${i}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="mono" style={{ ...tdStyle, fontSize: 12 }}>{entry.date}</td>
                          <td style={tdStyle}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                              color: entry.transaction_type === 'income' ? 'var(--success)' : 'var(--error)',
                              background: entry.transaction_type === 'income' ? 'rgba(58,92,74,0.1)' : 'rgba(150,69,58,0.1)'
                            }}>{entry.transaction_type}</span>
                          </td>
                          <td style={tdStyle}>{entry.description}</td>
                          <td className="mono" style={{
                            ...tdStyle, textAlign: 'right', fontWeight: 600,
                            color: entry.transaction_type === 'income' ? 'var(--success)' : 'var(--error)'
                          }}>{formatCurrency(entry.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ReconSection>
              )}

              {/* Conflicts */}
              {recon.conflicts?.length > 0 && (
                <ReconSection title="Conflicts (Amount Mismatch)" icon={Warning} color="var(--error)" count={recon.conflicts.length}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Description</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Statement Amt</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Ledger Amt</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recon.conflicts.map((c, i) => (
                        <tr key={`conflict-${c.statement_entry.date}-${c.statement_entry.amount}-${i}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="mono" style={{ ...tdStyle, fontSize: 12 }}>{c.statement_entry.date}</td>
                          <td style={tdStyle}>{c.statement_entry.description}</td>
                          <td className="mono" style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(c.statement_entry.amount)}</td>
                          <td className="mono" style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatCurrency(c.ledger_transaction.amount)}</td>
                          <td className="mono" style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--error)' }}>
                            {formatCurrency(c.amount_difference)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ReconSection>
              )}

              {/* All clear */}
              {recon.summary.missing_from_ledger === 0 && recon.summary.conflicts === 0 && recon.summary.missing_from_statement === 0 && (
                <div style={{
                  background: 'rgba(58,92,74,0.08)', border: '1px solid var(--success)',
                  borderRadius: 2, padding: '24px', textAlign: 'center', marginBottom: 24
                }}>
                  <CheckCircle size={32} weight="duotone" style={{ color: 'var(--success)', marginBottom: 8 }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)' }}>All entries matched</h3>
                  <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Your ledger is fully reconciled with this statement.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryPill({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
      background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
      minWidth: 160
    }}>
      <Icon size={24} weight="duotone" style={{ color }} />
      <div>
        <div className="mono" style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

function ReconSection({ title, icon: Icon, color, count, children, action }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
      overflow: 'hidden', marginBottom: 24
    }}>
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-secondary)'
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={18} weight="duotone" style={{ color }} />
          {title}
          <span className="mono" style={{
            fontSize: 12, padding: '2px 8px', background: `${color}18`,
            color, borderRadius: 2, fontWeight: 600
          }}>{count}</span>
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}
