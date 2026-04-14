import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  House, ArrowsLeftRight, Bank, Tag, BookOpen,
  Lightbulb, SignOut, Gear, EnvelopeSimple, TrendUp, Scales, ChartBar, Archive, Receipt
} from '@phosphor-icons/react';

const navItems = [
  { to: '/dashboard', icon: House, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowsLeftRight, label: 'Transactions' },
  { to: '/accounts', icon: Bank, label: 'Accounts' },
  { to: '/categories', icon: Tag, label: 'Categories' },
  { to: '/ledger', icon: BookOpen, label: 'Ledger' },
  { to: '/cashflow', icon: TrendUp, label: 'Cash Flow' },
  { to: '/reports', icon: ChartBar, label: 'Reports' },
  { to: '/reconciliation', icon: Scales, label: 'Reconciliation' },
  { to: '/email-sync', icon: EnvelopeSimple, label: 'Email & SMS' },
  { to: '/records', icon: Archive, label: 'Records' },
  { to: '/past-insights', icon: Receipt, label: 'Past Insights' },
  { to: '/feature-requests', icon: Lightbulb, label: 'Feature Requests' },
  { to: '/settings', icon: Gear, label: 'Settings' },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside data-testid="app-sidebar" style={{
        width: 240, background: 'var(--brand-primary)', color: '#fff',
        display: 'flex', flexDirection: 'column', position: 'fixed',
        top: 0, left: 0, bottom: 0, zIndex: 50
      }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
            SpentyAI
          </h1>
          <span className="mono" style={{ fontSize: 11, opacity: 0.5, display: 'block', marginTop: 2 }}>
            Autonomous Accounting
          </span>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 4, fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                transition: 'all 0.15s ease',
                textDecoration: 'none',
              })}
            >
              <Icon size={18} weight="regular" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {user?.picture ? (
              <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                {user?.name?.[0] || '?'}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || 'User'}
              </div>
              <div className="mono" style={{ fontSize: 10, opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
          </div>
          <button
            data-testid="logout-button"
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 4, border: 'none',
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.08)'}
          >
            <SignOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 240, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 40px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
