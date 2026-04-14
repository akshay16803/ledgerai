import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const userData = await api.get('/api/auth/me');
      setUser(userData);
    } catch {
      // User not authenticated - this is expected for non-logged-in users
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Logout may fail if session already expired - proceed with local cleanup
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, loading, logout, checkAuth }),
    [user, loading, logout, checkAuth]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
}
