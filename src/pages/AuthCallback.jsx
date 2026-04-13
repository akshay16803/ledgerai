import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../lib/api';

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    const sessionId = params.get('session_id');

    if (!sessionId) {
      navigate('/login', { replace: true });
      return;
    }

    (async () => {
      try {
        const userData = await api.post('/api/auth/session', { session_id: sessionId });
        setUser(userData);
        navigate('/dashboard', { replace: true, state: { user: userData } });
      } catch (err) {
        console.error('Auth callback failed:', err);
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg-primary)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Authenticating...
        </div>
      </div>
    </div>
  );
}
