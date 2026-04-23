import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { getCached, setCache } from '../lib/cache';
import { PaperPlaneRight, Clock, CheckCircle } from '@phosphor-icons/react';

export default function FeatureRequests() {
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);
  const [requests, setRequests] = useState(() => getCached('featurerequests') || []);
  const [loading, setLoading] = useState(!getCached('featurerequests'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'general' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    api.get('/api/feature-requests').then(data => { setRequests(data); setCache('featurerequests', data); }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSuccess('');
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.description.trim()) { setError('Description is required'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/feature-requests', form);
      setSuccess('Feature request submitted! Thank you for your feedback.');
      setForm({ title: '', description: '', category: 'general' });
      setShowForm(false);
      load();
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1px solid var(--border-strong)', borderRadius: 2, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', background: 'var(--bg-primary)' };

  return (
    <div data-testid="feature-requests-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>{s('feature_requests')}</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s('feature_requests')}</p>
        </div>
        <button data-testid="new-request-btn" onClick={() => setShowForm(!showForm)} style={{
          background: 'var(--brand-primary)', color: '#fff', border: 'none',
          padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <PaperPlaneRight size={14} weight="bold" /> {s('new_request')}
        </button>
      </div>

      {success && (
        <div data-testid="success-message" style={{
          background: 'rgba(58,92,74,0.1)', border: '1px solid var(--success)',
          borderRadius: 2, padding: '12px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--success)'
        }}>
          <CheckCircle size={18} weight="bold" /> {success}
        </div>
      )}

      {showForm && (
        <div data-testid="feature-request-form" style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 28, marginBottom: 24
        }}>
          <h3 style={{ fontSize: 16, fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: 20 }}>{s('new_request')}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{s('title')} *</label>
              <input data-testid="request-title-input" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                style={inputStyle} placeholder="Brief title for your feature request" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Category</label>
              <select data-testid="request-category-select" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} style={inputStyle}>
                <option value="general">General</option>
                <option value="accounting">Accounting</option>
                <option value="ai">AI & Automation</option>
                <option value="reporting">Reporting</option>
                <option value="integration">Integration</option>
                <option value="mobile">Mobile App</option>
                <option value="ui">UI/UX</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{s('description')} *</label>
              <textarea data-testid="request-description-input" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
                placeholder="Describe the feature you'd like to see in detail..." />
            </div>
            {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button data-testid="submit-request-btn" type="submit" disabled={submitting} style={{
                background: 'var(--brand-primary)', color: '#fff', border: 'none',
                padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)'
              }}>{submitting ? 'Submitting...' : 'Submit Request'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={{
                background: 'none', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
                padding: '10px 24px', borderRadius: 2, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)'
              }}>{s('cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Requests List */}
      {loading ? (
        <div className="mono" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>{s('no_requests')}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Be the first to suggest a new feature!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map(req => (
            <div key={req.request_id} data-testid={`request-${req.request_id}`} style={{
              background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 24
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)' }}>{req.title}</h3>
                <span style={{
                  padding: '2px 10px', borderRadius: 2, fontSize: 11, fontWeight: 600,
                  textTransform: 'capitalize',
                  background: req.status === 'submitted' ? 'rgba(194,140,60,0.1)' : 'rgba(58,92,74,0.1)',
                  color: req.status === 'submitted' ? 'var(--warning)' : 'var(--success)'
                }}>
                  {req.status}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{req.description}</p>
              <div style={{ display: 'flex', gap: 16 }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {new Date(req.created_at).toLocaleDateString()}
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--accent-1)', textTransform: 'capitalize' }}>{req.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
