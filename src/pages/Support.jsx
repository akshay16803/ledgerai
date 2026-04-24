import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Headset, PaperPlaneTilt, CheckCircle, Warning, CaretDown } from '@phosphor-icons/react';

const CATEGORIES = [
  { value: 'bug', label: 'Bug Report', description: 'Something is not working correctly' },
  { value: 'feature', label: 'Feature Request', description: 'Suggest a new feature or improvement' },
  { value: 'billing', label: 'Billing Issue', description: 'Questions about payments or subscriptions' },
  { value: 'account', label: 'Account Help', description: 'Login, settings, or profile issues' },
  { value: 'data', label: 'Data & Sync', description: 'Email sync, transactions, or data import' },
  { value: 'general', label: 'General Inquiry', description: 'Other questions or feedback' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'var(--text-muted)', description: 'No rush' },
  { value: 'medium', label: 'Medium', color: 'var(--warning)', description: 'Needs attention soon' },
  { value: 'high', label: 'High', color: 'var(--danger)', description: 'Urgent issue' },
];

export default function Support() {
  const { user } = useAuth();
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);
  const [form, setForm] = useState({
    subject: '',
    category: 'general',
    priority: 'medium',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.subject.trim()) {
      setError('Please enter a subject');
      return;
    }
    if (!form.message.trim()) {
      setError('Please describe your issue or request');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.post('/api/support/ticket', {
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        message: form.message.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({ subject: '', category: 'general', priority: 'medium', message: '' });
    setSubmitted(false);
    setError('');
  };

  if (submitted) {
    return (
      <div data-testid="support-page">
        <div style={{
          maxWidth: 500,
          margin: '60px auto',
          textAlign: 'center',
          padding: '48px 32px',
          background: '#fff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 2,
        }}>
          <CheckCircle size={56} weight="duotone" style={{ color: 'var(--success)', marginBottom: 16 }} />
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{s('support_submitted')}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
            We have received your request and will get back to you as soon as possible. 
            You will receive a response at <strong>{user?.email}</strong>.
          </p>
          <button
            data-testid="submit-another-btn"
            onClick={resetForm}
            style={{
              background: 'var(--brand-primary)',
              color: '#fff',
              border: 'none',
              padding: '12px 28px',
              borderRadius: 2,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {s('submit')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="support-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Headset size={28} weight="duotone" style={{ color: 'var(--brand-primary)' }} />
        <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em' }}>{s('support')}</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
        Need help? Submit a ticket and we will get back to you as soon as possible.
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
        {/* Contact Info Card */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 2,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {user?.picture ? (
            <img src={user.picture} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--brand-primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 600,
            }}>
              {user?.name?.[0] || '?'}
            </div>
          )}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              We will respond to: {user?.email}
            </div>
          </div>
        </div>

        {/* Subject */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            {s('subject')} <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            data-testid="support-subject"
            type="text"
            value={form.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
            placeholder={s('subject_placeholder')}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid var(--border-strong)',
              borderRadius: 2,
              fontSize: 14,
              fontFamily: 'var(--font-body)',
            }}
          />
        </div>

        {/* Category & Priority Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Category */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {s('category')}
            </label>
            <div style={{ position: 'relative' }}>
              <select
                data-testid="support-category"
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  paddingRight: 36,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 2,
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                  background: '#fff',
                  appearance: 'none',
                  cursor: 'pointer',
                }}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <CaretDown
                size={16}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {CATEGORIES.find(c => c.value === form.category)?.description}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {s('priority')}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  data-testid={`priority-${p.value}`}
                  onClick={() => handleChange('priority', p.value)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: 2,
                    cursor: 'pointer',
                    border: form.priority === p.value
                      ? `2px solid ${p.color}`
                      : '1px solid var(--border-strong)',
                    background: form.priority === p.value ? 'rgba(0,0,0,0.02)' : '#fff',
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    fontWeight: form.priority === p.value ? 600 : 400,
                    color: form.priority === p.value ? p.color : 'var(--text-secondary)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {PRIORITIES.find(p => p.value === form.priority)?.description}
            </div>
          </div>
        </div>

        {/* Message */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            {s('message')} <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea
            data-testid="support-message"
            value={form.message}
            onChange={(e) => handleChange('message', e.target.value)}
            placeholder="Please describe your issue or request in detail. Include any relevant information like steps to reproduce, error messages, or specific transaction IDs."
            rows={6}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid var(--border-strong)',
              borderRadius: 2,
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              resize: 'vertical',
              lineHeight: 1.5,
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            The more detail you provide, the faster we can help.
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            data-testid="support-error"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              background: 'rgba(220, 53, 69, 0.08)',
              border: '1px solid rgba(220, 53, 69, 0.2)',
              borderRadius: 2,
              marginBottom: 20,
              color: 'var(--danger)',
              fontSize: 13,
            }}
          >
            <Warning size={18} weight="fill" />
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          data-testid="submit-ticket-btn"
          type="submit"
          disabled={submitting}
          style={{
            background: 'var(--brand-primary)',
            color: '#fff',
            border: 'none',
            padding: '14px 32px',
            borderRadius: 2,
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)',
            opacity: submitting ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <PaperPlaneTilt size={18} weight="fill" />
          {submitting ? s('syncing') : s('submit')}
        </button>
      </form>
    </div>
  );
}
