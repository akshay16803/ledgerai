import { s, getCurrentLanguage, toggleLanguage } from '../lib/localization';
import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../lib/api';
import {
  House, ArrowsLeftRight, Bank, Tag,
  Lightbulb, SignOut, Gear, EnvelopeSimple, TrendUp, Scales, ChartBar, Archive, Receipt, List, X, Headset, Users, Package, Storefront, Repeat
} from '@phosphor-icons/react';

function getBaseNavItems() {
  return [
    { to: '/dashboard', icon: House, label: s('dashboard') },
    { to: '/transactions', icon: ArrowsLeftRight, label: s('transactions') },
    { to: '/accounts', icon: Bank, label: s('accounts') },
    { to: '/categories', icon: Tag, label: s('categories') },
    { to: '/cashflow', icon: TrendUp, label: s('cash_flow') },
    { to: '/cashflow?tab=mandates', icon: Repeat, label: s('mandates') },
    { to: '/reports', icon: ChartBar, label: s('reports') },
    { to: '/reconciliation', icon: Scales, label: s('reconciliation') },
    { to: '/email-sync', icon: EnvelopeSimple, label: s('email_sync') },
    { to: '/records', icon: Archive, label: s('records') },
    { to: '/past-insights', icon: Receipt, label: s('past_insights') },
    { to: '/feature-requests', icon: Lightbulb, label: s('feature_requests') },
    { to: '/support', icon: Headset, label: s('support') },
    { to: '/settings', icon: Gear, label: s('settings') },
  ];
}

function getInvoiceNavItems() {
  return [
    { to: '/invoices', icon: Receipt, label: s('invoices') },
    { to: '/customers', icon: Users, label: s('customers') },
  ];
}

function getBillNavItems() {
  return [
    { to: '/purchases', icon: Package, label: s('purchases') },
    { to: '/vendors', icon: Storefront, label: s('vendors') },
  ];
}

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => { const h = () => setLang(getCurrentLanguage()); window.addEventListener('languageChanged', h); return () => window.removeEventListener('languageChanged', h); }, []);
  const navigate = useNavigate();
  const initializedRef = useRef(false);

  // null = use CSS default, true/false = user toggled
  const [userToggled, setUserToggled] = useState(null);
  const [isMobile, setIsMobile] = useState(true);
  const [hasInvoices, setHasInvoices] = useState(false);
  const [hasBills, setHasBills] = useState(false);

  // Check if user has any invoices or bills to decide sidebar visibility
  useEffect(() => {
    api.get('/api/invoices').then(data => {
      const list = Array.isArray(data) ? data : data.invoices || [];
      setHasInvoices(list.length > 0);
    }).catch(() => {});
    api.get('/api/bills').then(data => {
      const list = Array.isArray(data) ? data : data.bills || [];
      setHasBills(list.length > 0);
    }).catch(() => {});
  }, []);

  // Build nav items — only show invoice/bill tabs after first creation
  // Re-compute on every render so language changes are picked up
  const base = getBaseNavItems();
  const invoiceItems = getInvoiceNavItems();
  const billItems = getBillNavItems();
  const navItems = [
    base[0],
    ...(hasInvoices ? invoiceItems : []),
    ...(hasBills ? billItems : []),
    ...base.slice(1),
  ];

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
          background: 'var(--sidebar-bg)', color: 'var(--sidebar-text)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
          overflow: 'hidden',
          transition: 'width 0.25s ease, min-width 0.25s ease',
        }}
      >
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg viewBox="0 0 40 40" width="36" height="36" style={{ flexShrink: 0 }}>
              <rect width="40" height="40" rx="10" fill="var(--sidebar-brand)"/>
              <text x="12" y="30" fill="white" fontSize="28" fontWeight="bold" fontFamily="system-ui">S</text>
              <path d="M30 8 L31 10 L33 11 L31 12 L30 14 L29 12 L27 11 L29 10Z" fill="rgba(255,255,255,0.6)"/>
              <path d="M34 16 L34.5 17 L35.5 17.5 L34.5 18 L34 19 L33.5 18 L32.5 17.5 L33.5 17Z" fill="rgba(255,255,255,0.4)"/>
            </svg>
            <div>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1.2 }}>
                SpentyAI
              </h1>
              <span className="mono" style={{ fontSize: 10, color: 'var(--sidebar-text)', opacity: 0.6, display: 'block', marginTop: 2 }}>
                {s('autonomous_accounting')}
              </span>
            </div>
          </div>
          <button
            data-testid="close-sidebar-btn"
            onClick={() => setUserToggled(false)}
            style={{
              background: 'none', border: 'none', color: 'var(--sidebar-text)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
              opacity: 0.5, marginTop: 2,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={handleNavClick}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              className="sidebar-nav-item"
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 6, fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                borderLeft: isActive ? '3px solid var(--brand-primary)' : '3px solid transparent',
                transition: 'all 0.15s ease',
                textDecoration: 'none', whiteSpace: 'nowrap',
              })}
              onMouseEnter={e => {
                if (!e.currentTarget.classList.contains('active')) {
                  e.currentTarget.style.background = 'var(--sidebar-hover)';
                }
              }}
              onMouseLeave={e => {
                const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
                e.currentTarget.style.background = isActive ? 'var(--sidebar-active-bg)' : 'transparent';
              }}
            >
              <Icon size={18} weight="regular" style={{ flexShrink: 0, opacity: 0.85 }} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 8px', borderTop: '1px solid var(--sidebar-border)' }}>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {user?.picture ? (
              <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--sidebar-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, color: '#fff' }}>
                {user?.name?.[0] || '?'}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--sidebar-text-active)' }}>
                {user?.name || 'User'}
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--sidebar-text)', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
          </div>
          <button
            data-testid="language-toggle-btn"
            onClick={() => { toggleLanguage(); setLang(getCurrentLanguage()); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--sidebar-border)',
              background: 'transparent', color: 'var(--sidebar-text)',
              cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-body)',
              transition: 'background 0.15s', marginBottom: 6, fontWeight: 500,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {lang === 'en' ? '\u0939\u093F / En' : 'En / \u0939\u093F'}
          </button>
          <button
            data-testid="logout-button"
            onClick={handleLogout}
            disabled={loggingOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 6, border: 'none',
              background: 'transparent', color: '#C27A7A',
              cursor: loggingOut ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'var(--font-body)',
              transition: 'background 0.15s', whiteSpace: 'nowrap',
              opacity: loggingOut ? 0.5 : 1,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <SignOut size={16} /> {loggingOut ? s('syncing') : s('sign_out')}
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
