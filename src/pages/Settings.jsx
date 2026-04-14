import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Check, Globe, CalendarBlank } from '@phosphor-icons/react';

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QR' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '15/04/2026' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '04/15/2026' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-04-15' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY', example: '15-04-2026' },
  { value: 'DD MMM YYYY', label: 'DD MMM YYYY', example: '15 Apr 2026' },
];

export default function Settings() {
  const { user, checkAuth } = useAuth();
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/settings').then(s => {
      setBaseCurrency(s.base_currency || 'INR');
      setDateFormat(s.date_format || 'DD/MM/YYYY');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/settings', { base_currency: baseCurrency, date_format: dateFormat });
      setSaved(true);
      checkAuth();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { alert(err.message); }
    setSaving(false);
  };

  const selectedCurrency = CURRENCIES.find(c => c.code === baseCurrency);

  if (loading) return <div className="mono" style={{ color: 'var(--text-muted)', padding: 40 }}>Loading settings...</div>;

  return (
    <div data-testid="settings-page">
      <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>Settings</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
        Configure your preferences for SpentyAI.
      </p>

      {/* Profile Section */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: 28, marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Profile</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user?.picture ? (
            <img src={user.picture} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'var(--text-muted)' }}>
              {user?.name?.[0] || '?'}
            </div>
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Currency Section */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: 28, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Globe size={18} weight="duotone" style={{ color: 'var(--info)' }} />
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Default Currency</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          All transactions will be recorded in this currency. Foreign currency transactions will be automatically converted.
        </p>
        <select
          data-testid="currency-select"
          value={baseCurrency}
          onChange={e => setBaseCurrency(e.target.value)}
          style={{
            width: '100%', maxWidth: 400, padding: '12px 16px',
            border: '1px solid var(--border-strong)', borderRadius: 2,
            fontSize: 14, fontFamily: 'var(--font-body)', background: '#fff',
          }}
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
          ))}
        </select>
        {selectedCurrency && (
          <div className="mono" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            Example: {selectedCurrency.symbol}1,00,000
          </div>
        )}
      </div>

      {/* Date Format Section */}
      <div style={{
        background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
        padding: 28, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <CalendarBlank size={18} weight="duotone" style={{ color: 'var(--info)' }} />
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Date Format</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Choose how dates are displayed across the app.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {DATE_FORMATS.map(df => (
            <button
              key={df.value}
              data-testid={`date-format-${df.value}`}
              onClick={() => setDateFormat(df.value)}
              style={{
                padding: '12px 20px', borderRadius: 2, cursor: 'pointer',
                border: dateFormat === df.value ? '2px solid var(--brand-primary)' : '1px solid var(--border-strong)',
                background: dateFormat === df.value ? 'rgba(194,109,92,0.06)' : '#fff',
                fontFamily: 'var(--font-body)', fontSize: 13,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ fontWeight: 600, color: dateFormat === df.value ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                {df.label}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{df.example}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          data-testid="save-settings-btn"
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--brand-primary)', color: '#fff', border: 'none',
            padding: '12px 28px', borderRadius: 2, fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
            opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
            <Check size={16} weight="bold" /> Saved!
          </span>
        )}
      </div>
    </div>
  );
}
