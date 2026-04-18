import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  House, ArrowsLeftRight, Bank, Tag,
  Lightbulb, SignOut, Gear, EnvelopeSimple, TrendUp, Scales, ChartBar, Archive, Receipt, List, X, Headset, Users, Package, Storefront
} from '@phosphor-icons/react';

const baseNavItems = [
  { to: '/dashboard', icon: House, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowsLeftRight, label: 'Transactions' },
  { to: '/accounts', icon: Bank, label: 'Accounts' },
  { to: '/categories', icon: Tag, label: 'Categories' },
  { to: '/cashflow', icon: TrendUp, label: 'Cash Flow' },
  { to: '/reports', icon: ChartBar, label: 'Reports' },
  { to: '/reconciliation', icon: Scales, label: 'Reconciliation' },
  { to: '/email-sync', icon: EnvelopeSimple, label: 'Email & SMS' },
  { to: '/records', icon: Archive, label: 'Records' },
  { to: '/past-insights', icon: Receipt, label: 'Past Insights' },
  { to: '/feature-requests', icon: Lightbulb, label: 'Feature Requests' },
  { to: '/support', icon: Headset, label: 'Support' },
  { to: '/settings', icon: Gear, label: 'Settings' },
];

const invoiceNavItems = [
  { to: '/invoices', icon: Receipt, label: 'Sales Invoice' },
  { to: '/customers', icon: Users, label: 'Customers' },
];

const billNavItems = [
  { to: '/purchases', icon: Package, label: 'Purchase Invoice' },
  { to: '/vendors', icon: Storefront, label: 'Vendors' },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initializedRef = useRef(false);

  // null = use CSS default, true/false = user toggled
  const [userToggled, setUserToggled] = useState(null);
  const [isMobile, setIsMobile] = useState(true);
  // Build nav items — Sales Invoice/Customers and Purchase Invoice/Vendors always visible after Dashboard
  const navItems = [baseNavItems[0], ...invoiceNavItems, ...billNavItems, ...baseNavItems.slice(1)];

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Reset user toggle when switching between mobile/desktop
      if (!initializedRef.current) {
        initializedRef.current = true;
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    } finally { setLoggingOut(false); }
  };
  
  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setUserToggled(prev => {
      // If user hasn't toggled yet, start from the CSS default
      if (prev === null) {
        return isMobile ? true : false; // On mobile, toggle opens; on desktop, toggle closes
      }
      return !prev;
    });
  }, [isMobile]);
  
  // Close sidebar on mobile when navigating
  const handleNavClick = useCallback(() => {
    if (isMobile) {
      setUserToggled(false);
    }
  }, [isMobile]);
  
  // Determine if sidebar should be open
  // If user hasn't toggled: open on desktop, closed on mobile
  // If user has toggled: use their preference
  const sidebarOpen = userToggled !== null ? userToggled : !isMobile;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <style>{`
        @media (max-width: 767px) {
          .app-main { margin-left: 0 !important; }
          .app-main-content { padding: 20px 16px !important; }
        }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="sidebar-overlay"
          onClick={() => setUserToggled(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            zIndex: 40, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        data-testid="app-sidebar"
        className="app-sidebar"
        style={{
          width: sidebarOpen ? (isMobile ? 260 : 240) : 0,
          minWidth: sidebarOpen ? (isMobile ? 260 : 240) : 0,
          background: 'var(--brand-primary)', color: '#fff',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
          overflow: 'hidden',
          transition: 'width 0.25s ease, min-width 0.25s ease',
        }}
      >
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
              SpentyAI
            </h1>
            <span className="mono" style={{ fontSize: 11, opacity: 0.5, display: 'block', marginTop: 2 }}>
              Autonomous Accounting
            </span>
          </div>
          <button
            data-testid="close-sidebar-btn"
            onClick={() => setUserToggled(false)}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={handleNavClick}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 4, fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                transition: 'all 0.15s ease',
                textDecoration: 'none', whiteSpace: 'nowrap',
              })}
            >
              <Icon size={18} weight="regular" style={{ flexShrink: 0 }} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {user?.picture ? (
              <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
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
            disabled={loggingOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 4, border: 'none',
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
              cursor: loggingOut ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'var(--font-body)',
              transition: 'background 0.15s', whiteSpace: 'nowrap',
              opacity: loggingOut ? 0.6 : 1,
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.08)'}
          >
            <SignOut size={16} /> {loggingOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className="app-main"
        style={{
          flex: 1,
          marginLeft: sidebarOpen ? 240 : 0,
          minHeight: '100vh',
          transition: 'margin-left 0.25s ease',
        }}
      >
        {/* Top bar with hamburger */}
        <div
          data-testid="topbar"
          style={{
            position: 'sticky', top: 0, zIndex: 30,
            background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '12px 24px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <button
            data-testid="toggle-sidebar-btn"
            onClick={toggleSidebar}
            style={{
              background: 'none', border: '1px solid var(--border-strong)',
              borderRadius: 4, padding: '6px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', color: 'var(--text-secondary)',
            }}
          >
            <List size={20} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
            SpentyAI
          </span>
        </div>

        <div className="app-main-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 40px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
