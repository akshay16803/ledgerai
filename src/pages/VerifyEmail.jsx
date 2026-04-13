import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { CheckCircle, XCircle, SpinnerGap } from '@phosphor-icons/react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') ? 'verifying' : 'error';
  });
  const [errorMsg, setErrorMsg] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') ? '' : 'No verification token found. Check your email link.';
  });
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await api.get(`/api/auth/verify-email?token=${token}`);
        setStatus(res.already_verified ? 'already' : 'success');
      } catch (err) {
        setStatus('error');
        setErrorMsg(err.message || 'Verification failed. The link may be expired or invalid.');
      }
    })();
  }, [token]);

  const iconMap = {
    verifying: <SpinnerGap size={48} weight="bold" className="spin" style={{ color: '#71717a' }} />,
    success: <CheckCircle size={48} weight="fill" style={{ color: '#16a34a' }} />,
    already: <CheckCircle size={48} weight="fill" style={{ color: '#16a34a' }} />,
    error: <XCircle size={48} weight="fill" style={{ color: '#dc2626' }} />,
  };

  const titleMap = {
    verifying: 'Verifying your email...',
    success: 'Email verified!',
    already: 'Already verified',
    error: 'Verification failed',
  };

  const descMap = {
    verifying: 'Hold tight, we\'re checking things out.',
    success: 'You\'re all set. Welcome to SpentyAI — check your inbox for a welcome email.',
    already: 'Your email was already confirmed. You\'re good to go.',
    error: errorMsg,
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
      <div style={{
        width: '100%', maxWidth: 440, textAlign: 'center'
      }}>
        <div style={{
          background: '#fff', border: '1px solid var(--border-subtle)',
          borderRadius: 8, padding: '48px 40px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <div style={{ marginBottom: 20 }}>{iconMap[status]}</div>
          <h1 data-testid="verify-email-title" style={{
            fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600,
            color: 'var(--text-primary)', margin: '0 0 8px'
          }}>
            {titleMap[status]}
          </h1>
          <p data-testid="verify-email-description" style={{
            color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6,
            margin: '0 0 28px'
          }}>
            {descMap[status]}
          </p>
          {(status === 'success' || status === 'already') && (
            <button
              data-testid="verify-go-to-dashboard"
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '12px 32px', background: 'var(--brand-primary)',
                color: '#fff', border: 'none', borderRadius: 4,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Go to Dashboard
            </button>
          )}
          {status === 'error' && (
            <button
              data-testid="verify-go-to-login"
              onClick={() => navigate('/login')}
              style={{
                padding: '12px 32px', background: 'var(--brand-primary)',
                color: '#fff', border: 'none', borderRadius: 4,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Back to Login
            </button>
          )}
        </div>
        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          SpentyAI — Autonomous Accounting
        </p>
      </div>
    </div>
  );
}
