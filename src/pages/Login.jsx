import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { GoogleLogo } from '@phosphor-icons/react';
import { useEffect } from 'react';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleGoogleLogin = () => {
    const API = import.meta.env.REACT_APP_BACKEND_URL || '';
    window.location.href = `${API}/api/auth/google`;
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      <div style={{
        width: '100%', maxWidth: 400, textAlign: 'center'
      }}>
        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600,
          color: 'var(--brand-primary)', marginBottom: 8
        }}>
          SpentyAI
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 40 }}>
          Sign in to manage your accounts
        </p>

        <div style={{
          background: '#fff', border: '1px solid var(--border-subtle)',
          borderRadius: 4, padding: '32px 24px'
        }}>
          <button
            data-testid="google-login-button"
            onClick={handleGoogleLogin}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: '14px 24px', border: '1px solid var(--border-strong)',
              borderRadius: 2, background: '#fff', cursor: 'pointer',
              fontSize: 15, fontWeight: 500, fontFamily: 'var(--font-body)',
              color: 'var(--text-primary)', transition: 'background 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <GoogleLogo size={20} weight="bold" />
            Continue with Google
          </button>

          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            By signing in, you agree to our{' '}
            <a href="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Privacy Policy</a>.
          </p>
        </div>

        <button
          data-testid="back-to-home-btn"
          onClick={() => navigate('/')}
          style={{
            marginTop: 24, background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
            fontFamily: 'var(--font-body)'
          }}
        >
          Back to home
        </button>
      </div>
    </div>
  );
}
