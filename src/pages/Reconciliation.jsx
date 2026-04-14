import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import {
  FileText, Upload, ArrowClockwise, Check, X, Warning,
  CheckCircle, XCircle, Question, Scales, Trash, Eye
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

function StatusBadge({ status }) {
  const map = {
    parsing: { bg: 'rgba(74,110,125,0.12)', color: 'var(--info)', label: 'Parsing...' },
    parsed: { bg: 'rgba(194,140,60,0.12)', color: 'var(--warning)', label: 'Ready to Reconcile' },
    reconciled: { bg: 'rgba(58,92,74,0.12)', color: 'var(--success)', label: 'Reconciled' },
    parse_failed: { bg: 'rgba(150,69,58,0.12)', color: 'var(--error)', label: 'Parse Failed' },
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
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [statementType, setStatementType] = useState('bank');
  const [error, setError] = useState('');
  const [activeStmt, setActiveStmt] = useState(null);
  const [reconciling, setReconciling] = useState(false);
  const [addingMissing, setAddingMissing] = useState(false);
  const [selectedMissing, setSelectedMissing] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [stmtRes, accs] = await Promise.all([
        api.get('/api/statements/list'),
        api.get('/api/accounts'),
      ]);
      setStatements(stmtRes.statements || []);
      setAccounts(accs);
      setCache('reconciliation', { statements: stmtRes.statements || [], accounts: accs });
      setSelectedAccountId(prev => prev || (accs.length > 0 ? accs[0].account_id : ''));
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

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedAccountId) { setError('Please select an account'); return; }

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
      const stmt = await api.get(`/api/statements/${stmtId}`);
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

  const handleAddMissing = async () => {
    if (!activeStmt || selectedMissing.length === 0) return;
    setAddingMissing(true);
    setError('');
    try {
      await api.post(`/api/statements/${activeStmt.statement_id}/add-missing`, {
        entry_indices: selectedMissing,
      });
      setSelectedMissing([]);
      const stmt = await api.get(`/api/statements/${activeStmt.statement_id}`);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>Statement Reconciliation</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Upload bank or credit card statements to detect missing entries, duplicates, and conflicts
          </p>
        </div>
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

      {/* Upload Section */}
      <div data-testid="upload-section" style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: '24px', marginBottom: 24
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={18} weight="duotone" style={{ color: 'var(--accent-1)' }} /> Upload Statement
        </h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Account</label>
            <select data-testid="account-select" value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              style={{ padding: '8px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', minWidth: 200 }}>
              {accounts.map(a => (
                <option key={a.account_id} value={a.account_id}>{a.name} ({a.account_type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Type</label>
            <select data-testid="type-select" value={statementType} onChange={e => setStatementType(e.target.value)}
              style={{ padding: '8px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)', minWidth: 150 }}>
              <option value="bank">Bank Statement</option>
              <option value="credit_card">Credit Card Statement</option>
            </select>
          </div>
          <div>
            <label className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>File (CSV or PDF)</label>
            <input data-testid="file-input" type="file" accept=".csv,.pdf"
              onChange={handleUpload} disabled={uploading}
              style={{ padding: '6px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-body)' }} />
          </div>
          {uploading && (
            <span className="mono" style={{ fontSize: 12, color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowClockwise size={14} className="spin" /> Uploading & parsing...
            </span>
          )}
        </div>
      </div>

      {/* Statement History */}
      {statements.length > 0 && (
        <div data-testid="statement-history" style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
          overflow: 'hidden', marginBottom: 24
        }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} weight="duotone" style={{ color: 'var(--text-secondary)' }} />
              Uploaded Statements
              <span className="mono" style={{ fontSize: 12, padding: '2px 6px', background: 'var(--bg-primary)', borderRadius: 2, color: 'var(--text-muted)' }}>
                {statements.length}
              </span>
            </h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <th style={thStyle}>File</th>
                <th style={thStyle}>Account</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Entries</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Uploaded</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {statements.map(stmt => (
                <tr key={stmt.statement_id} data-testid={`stmt-row-${stmt.statement_id}`}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: activeStmt?.statement_id === stmt.statement_id ? 'rgba(194,109,92,0.05)' : '#fff'
                  }}>
                  <td style={tdStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={16} weight="duotone" style={{ color: stmt.file_ext === 'pdf' ? '#E53E3E' : '#38A169' }} />
                      {stmt.filename}
                    </span>
                  </td>
                  <td style={tdStyle}>{stmt.account_name || getAccountName(stmt.account_id)}</td>
                  <td style={tdStyle}>{stmt.statement_type === 'credit_card' ? 'Credit Card' : 'Bank'}</td>
                  <td className="mono" style={tdStyle}>{stmt.entry_count ?? '—'}</td>
                  <td style={tdStyle}><StatusBadge status={stmt.status} /></td>
                  <td className="mono" style={{ ...tdStyle, fontSize: 12 }}>
                    {stmt.uploaded_at ? new Date(stmt.uploaded_at).toLocaleDateString() : ''}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button data-testid={`view-stmt-${stmt.statement_id}`}
                        onClick={() => handleViewStatement(stmt.statement_id)}
                        style={{
                          background: 'var(--brand-primary)', color: '#fff', border: 'none',
                          borderRadius: 2, padding: '5px 12px', cursor: 'pointer', fontSize: 11,
                          fontWeight: 600, fontFamily: 'var(--font-body)',
                          display: 'flex', alignItems: 'center', gap: 3
                        }}>
                        <Eye size={12} weight="bold" /> View
                      </button>
                      <button data-testid={`delete-stmt-${stmt.statement_id}`}
                        onClick={() => handleDelete(stmt.statement_id)}
                        style={{
                          background: 'none', border: '1px solid var(--error)', color: 'var(--error)',
                          borderRadius: 2, padding: '5px 12px', cursor: 'pointer', fontSize: 11,
                          fontWeight: 600, fontFamily: 'var(--font-body)',
                          display: 'flex', alignItems: 'center', gap: 3
                        }}>
                        <Trash size={12} weight="bold" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
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
                </span>
              </div>
              {activeStmt.status === 'parsed' && (
                <button data-testid="reconcile-btn" onClick={handleReconcile} disabled={reconciling}
                  style={{
                    background: 'var(--brand-primary)', color: '#fff', border: 'none',
                    padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600,
                    cursor: reconciling ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                    display: 'flex', alignItems: 'center', gap: 6,
                    opacity: reconciling ? 0.6 : 1
                  }}>
                  <Scales size={16} weight="bold" /> {reconciling ? 'Reconciling...' : 'Reconcile with Ledger'}
                </button>
              )}
            </div>

            {activeStmt.parsed_entries?.length > 0 && !recon && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 650 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Description</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStmt.parsed_entries.map((e, i) => (
                    <tr key={`${e.date}-${e.amount}-${i}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="mono" style={{ ...tdStyle, fontSize: 12 }}>{e.date}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                          color: e.transaction_type === 'income' ? 'var(--success)' : 'var(--error)',
                          background: e.transaction_type === 'income' ? 'rgba(58,92,74,0.1)' : 'rgba(150,69,58,0.1)'
                        }}>{e.transaction_type}</span>
                      </td>
                      <td style={tdStyle}>{e.description || '—'}</td>
                      <td className="mono" style={{
                        ...tdStyle, textAlign: 'right', fontWeight: 600,
                        color: e.transaction_type === 'income' ? 'var(--success)' : 'var(--error)'
                      }}>{formatCurrency(e.amount)}</td>
                      <td className="mono" style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-muted)' }}>
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
