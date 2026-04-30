import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  EnvelopeSimple, ChartPie, Receipt, FileText, Users, Buildings,
  Shield, ArrowRight, CheckCircle, ChatsCircle, Brain, HandTap,
  TrendUp, Files, ArrowsLeftRight, Calendar, Camera, Repeat, Tag,
  CaretDown, CurrencyInr, Cpu, Bell, Wallet, CreditCard, Plugs,
  DeviceMobile, Desktop, GlobeHemisphereEast, Sparkle, ChartLine, Lock,
  UploadSimple, Gavel, MagnifyingGlass, ChartBar, ArrowCircleUp,
  CaretLeft, CaretRight, Pause, Play
} from '@phosphor-icons/react';

// ---- Hero narrative beats ---------------------------------------------------
const dayBeats = [
  {
    time: '09:03',
    title: 'Bank SMS arrives.',
    body: 'Ola ride ₹284 on your HDFC card. Logged as Travel the moment it hits — before you even open the app.',
    icon: Bell,
  },
  {
    time: '13:47',
    title: 'Snap a lunch receipt.',
    body: 'Hold up your phone. AI fills in ₹680, Food, paid by card, GST extracted. You just hit Save.',
    icon: Camera,
  },
  {
    time: '15:20',
    title: 'Approve six in one sweep.',
    body: 'Pending review shows the day\'s AI-detected transactions. Swipe through them in seconds — approve, edit, or reject.',
    icon: HandTap,
  },
  {
    time: '18:00',
    title: 'Client payment lands.',
    body: 'Polaris Ventures paid your ₹1.8L invoice. SpentyAI matches the NEFT to the invoice automatically; nothing sits unreconciled.',
    icon: ArrowCircleUp,
  },
  {
    time: '23:00',
    title: 'Tomorrow\'s balance, tonight.',
    body: 'Dashboard shows this month\'s P&L, cash runway for 60 days out, and your GST-ready invoices waiting to go.',
    icon: ChartLine,
  },
];

// ---- App screen mock components (replace missing screenshots) ---------------
function MockFrame({ children }) {
  return (
    <div style={{
      aspectRatio: '16 / 10', background: '#fff', borderRadius: 8,
      border: '1px solid var(--border-subtle)', overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(26,54,45,0.10)', fontFamily: 'var(--font-body)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)',
        padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
      }}>
        {['#ff5f57','#ffbd2e','#28ca41'].map(c => (
          <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
        ))}
        <div style={{ flex: 1, marginLeft: 8, background: 'rgba(0,0,0,0.05)', borderRadius: 4, padding: '3px 10px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          spentyai.com
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 40, background: '#1a362d', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, gap: 10, flexShrink: 0 }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ width: 22, height: 22, borderRadius: 4, background: i === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)' }} />
          ))}
        </div>
        <div style={{ flex: 1, padding: '14px 16px', overflowY: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
}

function MockTile({ value, label, color }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, padding: '8px 12px', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
    </div>
  );
}

function MockEmailSync() {
  const txns = [
    { d: 'Swiggy Order #4928', a: '₹284', c: 'Food', b: 'HDFC', t: 'Today 09:03' },
    { d: 'Uber Technologies', a: '₹520', c: 'Travel', b: 'ICICI', t: 'Today 08:41' },
    { d: 'Netflix Subscription', a: '₹649', c: 'Entertainment', b: 'Axis', t: 'Yesterday' },
    { d: 'Amazon.in Purchase', a: '₹1,299', c: 'Shopping', b: 'HDFC', t: '25 Apr' },
    { d: 'HDFC Car Loan EMI', a: '₹8,500', c: 'Loan EMI', b: 'HDFC', t: '25 Apr' },
    { d: 'Zomato Order #1021', a: '₹420', c: 'Food', b: 'Axis CC', t: '24 Apr' },
  ];
  return (
    <MockFrame>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Email Sync</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        <MockTile value="1,962" label="Emails scanned" />
        <MockTile value="47" label="Txns found" color="#16a34a" />
        <MockTile value="12" label="Pending" color="#d97706" />
      </div>
      {txns.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)', gap: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.d}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{t.b} · {t.c} · {t.t}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{t.a}</span>
        </div>
      ))}
    </MockFrame>
  );
}

function MockPendingReview() {
  const items = [
    { d: 'Ola Cabs Ride', a: '₹284', c: 'Travel', src: 'SMS · HDFC', ok: true },
    { d: 'Zomato Order', a: '₹450', c: 'Food & Dining', src: 'Email · Axis CC', ok: true },
    { d: 'SIP — Mirae Asset', a: '₹5,000', c: 'Investments', src: 'Email · ICICI', ok: false },
    { d: 'HDFC Credit Card Bill', a: '₹12,400', c: 'Credit Card', src: 'Email · HDFC', ok: false },
    { d: 'Blinkit Delivery', a: '₹186', c: 'Groceries', src: 'SMS · SBI', ok: false },
  ];
  return (
    <MockFrame>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Pending Review</div>
        <span style={{ fontSize: 9, background: '#d97706', color: '#fff', borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}>12 items</span>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', marginBottom: 5,
          background: item.ok ? 'rgba(22,163,74,0.06)' : 'var(--bg-secondary)',
          border: `1px solid ${item.ok ? 'rgba(22,163,74,0.2)' : 'var(--border-subtle)'}`,
          borderRadius: 4,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.d}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{item.src} · {item.c}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{item.a}</span>
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <div style={{ width: 20, height: 20, borderRadius: 3, background: item.ok ? '#16a34a' : 'rgba(22,163,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: item.ok ? '#fff' : '#16a34a' }}>✓</div>
            {!item.ok && <div style={{ width: 20, height: 20, borderRadius: 3, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#dc2626' }}>✕</div>}
          </div>
        </div>
      ))}
    </MockFrame>
  );
}

function MockDashboard() {
  const accounts = [
    { name: 'HDFC Savings', bal: '₹4,24,000', pos: true },
    { name: 'ICICI Credit Card', bal: '-₹12,450', pos: false },
    { name: 'SBI Fixed Deposit', bal: '₹2,00,000', pos: true },
    { name: 'Axis Business CA', bal: '₹1,88,200', pos: true },
  ];
  return (
    <MockFrame>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Net Worth</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1a362d', fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em', marginBottom: 10 }}>₹8,24,350</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <MockTile value="₹1.42L" label="Income" color="#16a34a" />
        <MockTile value="₹68,240" label="Expenses" color="#dc2626" />
        <MockTile value="12" label="Pending" color="#d97706" />
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Your Accounts</div>
      {accounts.map((a, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{a.name}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: a.pos ? '#16a34a' : '#dc2626', fontFamily: 'var(--font-mono)' }}>{a.bal}</div>
        </div>
      ))}
      <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 4, padding: '7px 10px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12 }}>🤖</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Ask AI anything about your finances…</span>
      </div>
    </MockFrame>
  );
}

function MockCashFlow() {
  const bars = [
    { m: 'Nov', inc: 65, exp: 45 }, { m: 'Dec', inc: 80, exp: 55 },
    { m: 'Jan', inc: 72, exp: 48 }, { m: 'Feb', inc: 90, exp: 52 },
    { m: 'Mar', inc: 68, exp: 60 }, { m: 'Apr', inc: 85, exp: 50 },
  ];
  const mandates = [
    { name: 'Netflix', amt: '₹649/mo' }, { name: 'Mirae Asset SIP', amt: '₹10,000/mo' },
    { name: 'Home Loan EMI', amt: '₹35,000/mo' }, { name: 'Office Rent', amt: '₹28,000/mo' },
  ];
  return (
    <MockFrame>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Cash Flow</div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#16a34a', fontWeight: 700 }}>Net ₹74,260/mo</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52, marginBottom: 12, paddingBottom: 4 }}>
        {bars.map(b => (
          <div key={b.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 42, width: '100%' }}>
              <div style={{ flex: 1, height: `${b.inc * 0.5}px`, background: '#16a34a', borderRadius: '2px 2px 0 0', opacity: 0.8 }} />
              <div style={{ flex: 1, height: `${b.exp * 0.5}px`, background: '#dc2626', borderRadius: '2px 2px 0 0', opacity: 0.8 }} />
            </div>
            <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>{b.m}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Active Mandates</div>
      {mandates.map((m, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{m.name}</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', fontFamily: 'var(--font-mono)' }}>{m.amt}</span>
        </div>
      ))}
    </MockFrame>
  );
}

function MockReconciliation() {
  const rows = [
    { s: 'Swiggy ₹284', b: 'Swiggy ₹284', ok: true },
    { s: 'HDFC EMI ₹8,500', b: 'HDFC Car Loan ₹8,500', ok: true },
    { s: 'UPI-ZOMATO ₹450', b: 'Zomato ₹450', ok: true },
    { s: 'NEFT-POLARIS ₹1,50,000', b: '— not in books', ok: false },
    { s: 'Amazon ₹1,299', b: 'Amazon ₹1,299', ok: true },
    { s: 'Netflix ₹649', b: 'Netflix ₹649', ok: true },
  ];
  return (
    <MockFrame>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Bank Reconciliation</div>
        <div style={{ background: '#16a34a', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '2px 8px' }}>94% matched</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 22px', gap: 4, marginBottom: 5 }}>
        {['Bank Statement','Your Books',''].map((h, i) => (
          <div key={i} style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 22px', gap: 4,
          padding: '5px 6px', borderRadius: 3, marginBottom: 3,
          background: r.ok ? 'rgba(22,163,74,0.05)' : 'rgba(220,38,38,0.06)',
          border: `1px solid ${r.ok ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.22)'}`,
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.s}</div>
          <div style={{ fontSize: 10, color: r.ok ? 'var(--text-primary)' : '#dc2626', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.b}</div>
          <div style={{ fontSize: 12, color: r.ok ? '#16a34a' : '#dc2626', textAlign: 'center' }}>{r.ok ? '✓' : '✕'}</div>
        </div>
      ))}
    </MockFrame>
  );
}

function MockAskAI() {
  const msgs = [
    { role: 'user', text: 'Record ₹2,500 Zomato expense from HDFC savings' },
    { role: 'ai', text: '✓ Done! Expense ₹2,500 · Food & Dining · Zomato · HDFC Savings — queued for approval.' },
    { role: 'user', text: 'Create invoice for Polaris Ventures ₹1,50,000 + 18% GST' },
    { role: 'ai', text: '✓ Invoice #INV-0024 · Polaris Ventures · ₹1,77,000 (incl. GST) — PDF ready to send.' },
    { role: 'user', text: 'What did I spend on food last month?' },
    { role: 'ai', text: '₹8,240 on Food in March — Swiggy, Zomato, Blinkit ×3 and 1 restaurant.' },
  ];
  return (
    <MockFrame>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1a362d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🤖</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Ask AI</div>
          <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 600 }}>● Online · knows your books</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%', padding: '6px 10px', fontSize: 10, lineHeight: 1.45,
              borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              background: m.role === 'user' ? '#1a362d' : 'var(--bg-secondary)',
              border: m.role === 'ai' ? '1px solid var(--border-subtle)' : 'none',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
            }}>{m.text}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Type what happened…</div>
        <div style={{ width: 28, height: 28, borderRadius: 4, background: '#1a362d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>↑</div>
      </div>
    </MockFrame>
  );
}

function MockHero() {
  const accounts = [
    { name: 'HDFC Savings', bal: '₹4,24,000', pos: true },
    { name: 'ICICI Credit Card', bal: '-₹12,450', pos: false },
    { name: 'Axis Business CA', bal: '₹1,88,200', pos: true },
  ];
  const txns = [
    { d: 'Swiggy Order', a: '₹284', c: 'Food', ok: true },
    { d: 'Uber Ride', a: '₹520', c: 'Travel', ok: false },
    { d: 'Netflix Sub', a: '₹649', c: 'Entertainment', ok: false },
  ];
  return (
    <div style={{
      aspectRatio: '16 / 9', background: 'linear-gradient(135deg, #1a362d 0%, #2d5a45 100%)',
      borderRadius: 8, border: '1px solid var(--border-subtle)', overflow: 'hidden',
      boxShadow: '0 24px 80px rgba(26,54,45,0.18)', fontFamily: 'var(--font-body)',
      padding: 20, display: 'flex', gap: 16,
    }}>
      {/* Left — Dashboard */}
      <div style={{ flex: 2, background: '#fff', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#f4f3f0', borderBottom: '1px solid #e5e3df', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
          {['#ff5f57','#ffbd2e','#28ca41'].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
          <span style={{ fontSize: 10, color: '#9c9a97', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>spentyai.com/dashboard</span>
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: 36, background: '#1a362d', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 8 }}>
            {[0,1,2,3].map(i => <div key={i} style={{ width: 18, height: 18, borderRadius: 3, background: i === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)' }} />)}
          </div>
          <div style={{ flex: 1, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: '#9c9a97', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Net Worth</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a362d', fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em', marginBottom: 8 }}>₹8,24,350</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
              {[{v:'₹1.42L',l:'Income',c:'#16a34a'},{v:'₹68,240',l:'Expenses',c:'#dc2626'},{v:'12',l:'Pending',c:'#d97706'}].map(t => (
                <div key={t.l} style={{ background: '#f4f3f0', borderRadius: 3, padding: '6px 8px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.c, fontFamily: 'var(--font-mono)' }}>{t.v}</div>
                  <div style={{ fontSize: 8, color: '#9c9a97' }}>{t.l}</div>
                </div>
              ))}
            </div>
            {accounts.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0eeeb' }}>
                <span style={{ fontSize: 10, color: '#3a3835' }}>{a.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: a.pos ? '#16a34a' : '#dc2626', fontFamily: 'var(--font-mono)' }}>{a.bal}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Right — Pending + AI */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: '#fff', borderRadius: 6, padding: 12, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#3a3835', marginBottom: 8 }}>Pending Review <span style={{ background: '#d97706', color: '#fff', borderRadius: 3, padding: '1px 5px', fontSize: 8, marginLeft: 4 }}>12</span></div>
          {txns.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #f0eeeb' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#3a3835' }}>{t.d}</div>
                <div style={{ fontSize: 8, color: '#9c9a97' }}>{t.c}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', fontFamily: 'var(--font-mono)' }}>{t.a}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <div style={{ width: 16, height: 16, borderRadius: 2, background: t.ok ? '#16a34a' : 'rgba(22,163,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: t.ok ? '#fff' : '#16a34a' }}>✓</div>
                {!t.ok && <div style={{ width: 16, height: 16, borderRadius: 2, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#dc2626' }}>✕</div>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: 6, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#3a3835', marginBottom: 8 }}>🤖 Ask AI</div>
          <div style={{ background: '#f4f3f0', borderRadius: '8px 8px 8px 2px', padding: '6px 8px', fontSize: 9, color: '#3a3835', lineHeight: 1.4, marginBottom: 6 }}>
            ✓ Invoice #INV-0024 for Polaris Ventures ₹1,77,000 — PDF ready.
          </div>
          <div style={{ background: '#1a362d', borderRadius: '8px 8px 2px 8px', padding: '6px 8px', fontSize: 9, color: '#fff', lineHeight: 1.4, textAlign: 'right' }}>
            Create invoice ₹1.5L + GST for Polaris Ventures
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Hero features (Tier 1 — the sell) --------------------------------------
const heroFeatures = [
  {
    label: 'Feature 01',
    eyebrow: 'Auto-sync',
    title: 'Stop typing what your bank already sent you.',
    body: 'Connect Gmail, Outlook, or forward your bank SMS. SpentyAI reads every payment alert, UPI confirmation, NEFT memo, and e-invoice — then drafts a double-entry transaction, ready for your approval. Works with HDFC, ICICI, Axis, SBI, Kotak, and every major Indian bank that sends transaction emails or SMS.',
    bullets: [
      'Reads only transaction-related emails — nothing else',
      'UPI, NEFT, RTGS, IMPS, credit-card, debit-card auto-detected',
      'Choose how far back to scan: 30 days, 6 months, all-time',
    ],
    icon: EnvelopeSimple,
    Mockup: MockEmailSync,
  },
  {
    label: 'Feature 02',
    eyebrow: 'AI approval queue',
    title: 'Your ledger, one tap from clean.',
    body: 'SpentyAI drafts every entry — income, expense, transfer, recurring payment, UPI mandate — but nothing posts until you approve. You scan, you swipe, you\'re done. Your books stay exactly as clean as you want them, and you can edit any field before committing.',
    bullets: [
      'One tap to approve, edit, or reject',
      'Bulk-approve a whole batch at once',
      'See the original email or SMS for every detected transaction',
    ],
    icon: HandTap,
    Mockup: MockPendingReview,
    flip: true,
  },
  {
    label: 'Feature 03',
    eyebrow: 'Dashboard',
    title: 'Finally know where it all went.',
    body: 'A single view for net worth, this month\'s income and expenses, all your accounts, and AI-detected transactions waiting for review. Talk to the Ask-AI chat in plain English — "what did I spend on travel last month?" — and get answers or even post transactions without leaving the page.',
    bullets: [
      'Net worth, income, expenses — always live',
      'Ask-AI chat posts transactions and creates invoices in plain English',
      'Drill into any account to see its history and running balance',
    ],
    icon: ChartPie,
    Mockup: MockDashboard,
  },
  {
    label: 'Feature 04',
    eyebrow: 'Cash flow',
    title: 'See the next 60 days before they happen.',
    body: 'SpentyAI detects your recurring payments — rent, EMI, SIP, Netflix, UPI autopay mandates — and projects your balance forward month by month. Pause a SIP, add a one-off expense, see the impact instantly. No spreadsheets.',
    bullets: [
      'Auto-detected recurring payments and UPI mandates',
      'Month-by-month projection with running balance',
      'Pause, resume, or edit recurring entries without losing history',
    ],
    icon: TrendUp,
    Mockup: MockCashFlow,
    flip: true,
  },
  {
    label: 'Feature 05',
    eyebrow: 'Reconciliation',
    title: 'Know in seconds if your books match the bank.',
    body: 'Upload a bank statement — PDF, Excel, or CSV, even password-protected — and SpentyAI matches every line to your ledger automatically. Matched entries get a green tick. Unmatched entries are flagged with the amount so you can investigate and close. Complete audit trail, every time.',
    bullets: [
      'Parses HDFC, ICICI, Axis, SBI, and Kotak statement formats automatically',
      'Every match is one-click confirmable; mismatches are flagged with reason',
      'Reconciliation history stored — revisit any period at any time',
    ],
    icon: ArrowsLeftRight,
    Mockup: MockReconciliation,
  },
  {
    label: 'Feature 06',
    eyebrow: 'Ask AI',
    title: 'Just tell it what happened. AI does the accounting.',
    body: 'You don\'t need to know double-entry bookkeeping. Type what happened — "paid ₹2,500 to Zomato from HDFC card" — and SpentyAI posts the correct journal entry, picks the right account and category, and queues it for your approval. Create invoices, log expenses, record transfers — all in plain English.',
    bullets: [
      'Natural language entry: "record lunch ₹450" creates the full journal',
      'Create GST invoices and purchase bills from a single sentence',
      'Answers questions: "how much did I spend on food last quarter?"',
    ],
    icon: Brain,
    Mockup: MockAskAI,
    flip: true,
  },
];

// ---- Closer features grid (Tier 2) ------------------------------------------
const closerFeatures = [
  { icon: Camera, title: 'Receipt scanner', body: 'Point your phone at a receipt; AI fills in vendor, amount, category, GST, and payment method.' },
  { icon: Shield, title: 'Bank reconciliation', body: 'Upload a statement — even password-protected PDFs. AI matches every line to your books and flags mismatches.' },
  { icon: Wallet, title: 'Multi-account, multi-bank', body: 'Savings, current, credit card, cash, loan, investment — track them all, with per-account running balance.' },
  { icon: Repeat, title: 'Recurring & mandate detection', body: 'AI spots your SIPs, autopay mandates, OTT subscriptions, and rent cycles automatically.' },
  { icon: Tag, title: 'Categories + subcategories', body: 'Two-level hierarchy. Pre-populated for Indian business types, fully editable.' },
  { icon: ArrowsLeftRight, title: 'Transfers between accounts', body: 'Move money between your own accounts with one entry — no double-counting on P&L.' },
  { icon: Users, title: 'Customers + debtor aging', body: 'Track client GSTIN, outstanding invoices, and who\'s 30/60/90+ days overdue.' },
  { icon: Buildings, title: 'Vendors + creditor aging', body: 'Track what you owe whom, with payment priority coloured by urgency.' },
  { icon: Receipt, title: 'Purchase bills', body: 'Mirror of invoicing for the buy side — vendor bills with ITC-ready GST breakdowns.' },
  { icon: Files, title: 'Records vault', body: 'Every source email, .eml receipt, and attachment stored alongside its transaction — audit-ready.' },
  { icon: ChatsCircle, title: 'Ask-AI chat', body: 'Natural-language queries. "How much did I spend on food this month?" gets you an answer or action.' },
  { icon: UploadSimple, title: 'Statement upload', body: 'No email sync? Drop a bank statement PDF. AI parses every line and drafts the full ledger for your approval.' },
];

// ---- Everything else (Tier 3) ----------------------------------------------
const everythingElse = [
  'Ledger view with running balance',
  'Opening balance as-of date',
  'Account detail pages',
  'Reports: income vs expense, category drill-down',
  'GSTIN + HSN/SAC in firm settings',
  'Financial-year picker',
  'Reset data (nuclear option, one click)',
  'Feature Requests — community roadmap',
  'In-app support tickets',
  'Billing transparency',
  'Privacy controls',
  'Works on Web, iOS, Android',
];

// ---- FAQ --------------------------------------------------------------------
const faqs = [
  {
    q: 'Will SpentyAI read ALL my emails?',
    a: 'No. We request read-only Gmail/Outlook access, and we only scan emails that look like transactions — bank alerts, invoices, payment confirmations. Personal emails are never processed, stored, or sent to the AI. You can disconnect at any time in Settings.',
  },
  {
    q: 'Does it work with my bank?',
    a: 'If your bank sends transaction SMS or emails (and all major Indian banks do), SpentyAI works with it. Tested against HDFC, ICICI, Axis, SBI, Kotak, Yes Bank, IndusInd, and most credit-card issuers. For banks without email alerts, just upload a statement — the AI parses every line.',
  },
  {
    q: 'Is my financial data safe?',
    a: 'All data is transmitted over TLS, stored on encrypted MongoDB Atlas, and access is authenticated on every request. Gmail/Outlook tokens are stored securely and can be revoked with one tap. You control everything — Settings → Reset Data wipes every transaction, invoice, and synced email on the spot.',
  },
  {
    q: 'Can I try before paying?',
    a: 'Yes. Every new account starts with a free trial. You connect Gmail, run a test sync, and see the AI in action with your actual transactions before you ever see a charge. No credit card needed to start.',
  },
  {
    q: 'Can I import my existing Excel / Tally data?',
    a: 'You can set opening balances on each account as of a specific date, so your history is reflected without importing every transaction. For detailed imports, the statement-upload feature lets you drop in bank statements as far back as you need.',
  },
  {
    q: 'Does it handle GST and ITR?',
    a: 'Yes. Every invoice and bill has full GST fields — GSTIN, HSN/SAC, CGST/SGST/IGST, place of supply, amount in words. Past Insights gives you isolated summaries per financial year, exportable as CSV for your CA or for ITR filing.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'Native iOS and Android apps, both built to match the web experience exactly. Connect your Gmail once; everything syncs across devices. Every feature on this page works on mobile.',
  },
];

// ---- Placeholder image component with graceful fallback ---------------------
function FeatureImage({ src, alt, aspect = '16 / 10' }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div style={{
      position: 'relative',
      aspectRatio: aspect,
      borderRadius: 4,
      overflow: 'hidden',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-subtle)',
      boxShadow: '0 20px 60px rgba(26, 54, 45, 0.08)',
    }}>
      {!failed && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        />
      )}
      {(failed || !loaded) && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
        }}>
          <Desktop size={32} weight="thin" style={{ opacity: 0.4 }} />
          <span style={{ opacity: 0.5 }}>Preview</span>
        </div>
      )}
    </div>
  );
}

// ---- Modern feature carousel ------------------------------------------------
function FeatureCarousel({ slides }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const touchRef = useRef({ x: 0, active: false });
  const rootRef = useRef(null);

  const total = slides.length;
  const SLIDE_MS = 7000;

  // Respect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = (e) => setReduceMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Auto-advance with progress bar
  useEffect(() => {
    if (paused || reduceMotion) return;
    const tick = 50;
    const step = (tick / SLIDE_MS) * 100;
    let p = 0;
    setProgress(0);
    const id = setInterval(() => {
      p += step;
      if (p >= 100) {
        p = 0;
        setActive((a) => (a + 1) % total);
      }
      setProgress(p);
    }, tick);
    return () => clearInterval(id);
  }, [active, paused, total, reduceMotion]);

  // Keyboard navigation when section has focus
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const go = (idx) => {
    const next = ((idx % total) + total) % total;
    setActive(next);
    setProgress(0);
  };

  // Touch / swipe
  const onTouchStart = (e) => {
    touchRef.current = { x: e.touches[0].clientX, active: true };
  };
  const onTouchEnd = (e) => {
    if (!touchRef.current.active) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    touchRef.current.active = false;
    if (Math.abs(dx) > 40) {
      if (dx < 0) go(active + 1); else go(active - 1);
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="SpentyAI feature highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ outline: 'none' }}
    >
      {/* Tab pills — feature names */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 28,
      }}>
        {slides.map((s, i) => {
          const isActive = i === active;
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={() => go(i)}
              aria-label={`Show ${s.eyebrow}`}
              aria-current={isActive ? 'true' : 'false'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                border: `1px solid ${isActive ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                background: isActive ? 'var(--brand-primary)' : 'var(--bg-primary)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-body)',
              }}
            >
              <Icon size={14} weight={isActive ? 'fill' : 'duotone'} />
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>{s.eyebrow}</span>
            </button>
          );
        })}
      </div>

      {/* Slide stage */}
      <div style={{
        position: 'relative',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 16,
        boxShadow: '0 30px 80px rgba(26, 54, 45, 0.08), 0 6px 18px rgba(26, 54, 45, 0.04)',
        overflow: 'hidden',
      }}>
        {/* Soft accent halo behind the active mockup */}
        <div aria-hidden="true" style={{
          position: 'absolute',
          right: '-10%',
          top: '-30%',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52,199,89,0.18) 0%, rgba(52,199,89,0) 65%)',
          pointerEvents: 'none',
        }} />

        {/* Top progress bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 3, background: 'rgba(26,54,45,0.06)',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--brand-primary)',
            transition: paused ? 'none' : 'width 50ms linear',
          }} />
        </div>

        {/* Slides track */}
        <div style={{ position: 'relative' }}>
          {slides.map((slide, i) => {
            const Icon = slide.icon;
            const Mockup = slide.Mockup;
            const isActive = i === active;
            return (
              <div
                key={slide.label}
                aria-hidden={!isActive}
                style={{
                  display: isActive ? 'block' : 'none',
                  padding: 'clamp(28px, 4vw, 56px)',
                  animation: isActive && !reduceMotion ? 'spentyFadeSlide 500ms ease both' : 'none',
                }}
              >
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 'clamp(28px, 4vw, 56px)',
                  alignItems: 'center',
                }}>
                  {/* Text column */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'rgba(52,199,89,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--brand-primary)',
                      }}>
                        <Icon size={20} weight="duotone" />
                      </div>
                      <span className="mono" style={{
                        fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
                        color: 'var(--text-muted)', fontWeight: 600,
                      }}>{slide.label} · {slide.eyebrow}</span>
                    </div>
                    <h3 style={{
                      fontSize: 'clamp(1.6rem, 2.5vw, 2.4rem)', fontWeight: 500,
                      lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 16,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-heading)',
                    }}>
                      {slide.title}
                    </h3>
                    <p style={{
                      fontSize: 16, color: 'var(--text-secondary)',
                      lineHeight: 1.65, marginBottom: 22,
                    }}>
                      {slide.body}
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
                      {slide.bullets.map((b, bi) => (
                        <li key={bi} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '6px 0', fontSize: 14,
                          color: 'var(--text-secondary)', lineHeight: 1.5,
                        }}>
                          <CheckCircle size={18} weight="fill" style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Mockup column */}
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      borderRadius: 12, overflow: 'hidden',
                      transform: 'translateZ(0)',
                    }}>
                      <Mockup />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer controls */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '16px clamp(20px, 3vw, 36px)',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-primary)',
        }}>
          <span className="mono" style={{
            fontSize: 12, letterSpacing: '0.18em', color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}>
            {String(active + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>

          {/* Dot indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {slides.map((s, i) => (
              <button
                key={`dot-${s.label}`}
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{
                  width: i === active ? 26 : 8, height: 8,
                  borderRadius: 999,
                  background: i === active ? 'var(--brand-primary)' : 'rgba(26,54,45,0.18)',
                  border: 'none', padding: 0, cursor: 'pointer',
                  transition: 'all 0.25s ease',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Play auto-advance' : 'Pause auto-advance'}
              title={paused ? 'Play' : 'Pause'}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-primary)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              {paused ? <Play size={14} weight="fill" /> : <Pause size={14} weight="fill" />}
            </button>
            <button
              type="button"
              onClick={() => go(active - 1)}
              aria-label="Previous feature"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-primary)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label="Next feature"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: 'none',
                background: 'var(--brand-primary)',
                cursor: 'pointer',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: '0 6px 14px rgba(52, 199, 89, 0.28)',
              }}
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Page -------------------------------------------------------------------
export default function Features() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState(null);

  const handleGetStarted = () => {
    if (user) navigate('/dashboard');
    else navigate('/login');
  };

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>

      {/* Nav (matches Landing) */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(249, 248, 246, 0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Link to="/" style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, color: 'var(--brand-primary)' }}>
          SpentyAI
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/features" style={{ fontSize: 14, color: 'var(--brand-primary)', fontWeight: 600 }}>Features</Link>
          <Link to="/pricing" style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>Pricing</Link>
          {user ? (
            <button onClick={() => navigate('/dashboard')} style={navBtn}>Dashboard</button>
          ) : (
            <button onClick={() => navigate('/login')} style={navBtn}>Sign In</button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        paddingTop: 140, paddingBottom: 60, textAlign: 'center',
        maxWidth: 860, margin: '0 auto', padding: '140px 24px 60px'
      }}>
        <div style={{ marginBottom: 16 }}>
          <span className="mono" style={eyebrow}>A guided tour</span>
        </div>
        <h1 style={{
          fontSize: 'clamp(2.4rem, 5vw, 3.6rem)', fontWeight: 500,
          lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 20,
          color: 'var(--text-primary)'
        }}>
          Your intelligent<br />
          <span style={{ color: 'var(--accent-1)', fontStyle: 'italic' }}>personal accountant</span>
        </h1>
        <p style={{
          fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.7,
          maxWidth: 620, margin: '0 auto 36px'
        }}>
          SpentyAI reads your bank SMS and email, drafts every transaction for you,
          keeps your GST invoices clean, and projects your cash flow 60 days ahead —
          so you stop doing your own books.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 48 }}>
          <button onClick={handleGetStarted} style={primaryBtn}>
            Start free trial <ArrowRight size={16} weight="bold" />
          </button>
          <button onClick={() => navigate('/pricing')} style={secondaryBtn}>
            See pricing
          </button>
        </div>

        {/* Hero visual */}
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <MockHero />
        </div>

        {/* Trust strip */}
        <div style={{
          marginTop: 40, padding: '16px 24px',
          display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center',
          alignItems: 'center', fontSize: 12,
          color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          <span>Works with</span>
          <span>HDFC</span>
          <span>•</span>
          <span>ICICI</span>
          <span>•</span>
          <span>Axis</span>
          <span>•</span>
          <span>SBI</span>
          <span>•</span>
          <span>Kotak</span>
          <span>•</span>
          <span>Gmail</span>
          <span>•</span>
          <span>Outlook</span>
        </div>
      </section>

      {/* Narrative — A day with SpentyAI */}
      <section style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span className="mono" style={eyebrow}>A day with SpentyAI</span>
            <h2 style={sectionH}>
              Your books done,<br />while you actually live your life.
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
          }}>
            {dayBeats.map(({ time, title, body, icon: Icon }, i) => (
              <div key={time} style={{
                position: 'relative',
                padding: 24,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 18,
                    background: 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent-1)',
                  }}>
                    <Icon size={18} weight="duotone" />
                  </div>
                  <span className="mono" style={{
                    fontSize: 13, color: 'var(--text-muted)', fontWeight: 600,
                  }}>{time}</span>
                </div>
                <h3 style={{
                  fontSize: 16, fontWeight: 600, marginBottom: 8,
                  fontFamily: 'var(--font-body)', color: 'var(--text-primary)',
                }}>{title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Six hero features — interactive carousel */}
      <section style={{ padding: '100px 24px 80px', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span className="mono" style={eyebrow}>Six reasons people pay</span>
            <h2 style={sectionH}>
              The features that <em style={{ color: 'var(--accent-1)', fontStyle: 'italic', fontFamily: 'var(--font-heading)' }}>earn</em> the subscription.
            </h2>
            <p style={{ marginTop: 16, fontSize: 15, color: 'var(--text-muted)', maxWidth: 580, marginLeft: 'auto', marginRight: 'auto' }}>
              Swipe through the six things SpentyAI actually does. Every claim here maps to a working part of the app.
            </p>
          </div>
          <FeatureCarousel slides={heroFeatures} />
        </div>
      </section>

      {/* Closer grid */}
      <section style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '80px 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <span className="mono" style={eyebrow}>Everything else you need</span>
            <h2 style={sectionH}>
              The work your CA<br />didn&rsquo;t want to do.
            </h2>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
          }}>
            {closerFeatures.map(({ icon: Icon, title, body }) => (
              <div key={title} style={{
                padding: 24,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(26,54,45,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <Icon size={24} weight="duotone" style={{ color: 'var(--accent-1)', marginBottom: 14 }} />
                <h3 style={{
                  fontSize: 16, fontWeight: 600, marginBottom: 8,
                  fontFamily: 'var(--font-body)', color: 'var(--text-primary)',
                }}>{title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Everything else row */}
      <section style={{ padding: '60px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span className="mono" style={eyebrow}>Plus the small-but-useful</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 8,
            fontSize: 14,
            color: 'var(--text-secondary)',
          }}>
            {everythingElse.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <CheckCircle size={14} weight="fill" style={{ color: 'var(--accent-3)', flexShrink: 0 }} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust row */}
      <section style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '80px 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 32,
          }}>
            <TrustCard icon={Lock} title="Your data, your control.">
              Read-only Gmail and Outlook. TLS everywhere. Reset wipes everything in one tap. We never sell, share, or train on your data.
            </TrustCard>
            <TrustCard icon={GlobeHemisphereEast} title="Web, iOS, Android.">
              Connect Gmail once. Everything syncs across every device. Every feature on this page works on mobile.
            </TrustCard>
            <TrustCard icon={CurrencyInr} title="Built for India.">
              GST, HSN/SAC, CGST/SGST/IGST, UPI mandates, ITR-friendly summaries, INR everywhere. No clumsy "foreign tool" friction.
            </TrustCard>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{
        background: 'var(--brand-primary)', color: '#fff',
        padding: '80px 24px', textAlign: 'center',
      }}>
        <h2 style={{
          fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
          fontWeight: 500, marginBottom: 16, fontFamily: 'var(--font-heading)'
        }}>
          Ready to stop doing your own books?
        </h2>
        <p style={{ fontSize: 16, opacity: 0.7, marginBottom: 32, maxWidth: 520, margin: '0 auto 32px' }}>
          Connect Gmail in under a minute. Your first 30 days are free.
        </p>
        <button onClick={handleGetStarted} style={{
          background: '#fff', color: 'var(--brand-primary)', border: 'none',
          padding: '14px 36px', borderRadius: 2, fontSize: 15, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          transition: 'transform 0.2s ease',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          Start free trial <ArrowRight size={16} weight="bold" />
        </button>
      </section>

      {/* FAQ */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span className="mono" style={eyebrow}>Frequently asked</span>
            <h2 style={sectionH}>Questions we hear a lot.</h2>
          </div>
          <div>
            {faqs.map((f, i) => (
              <div key={i} style={{
                borderBottom: '1px solid var(--border-subtle)',
                padding: '20px 0',
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    padding: 0, cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{f.q}</span>
                  <CaretDown
                    size={16} weight="bold"
                    style={{
                      transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      color: 'var(--text-muted)',
                    }}
                  />
                </button>
                {openFaq === i && (
                  <p style={{
                    marginTop: 12, fontSize: 14, color: 'var(--text-secondary)',
                    lineHeight: 1.7,
                  }}>
                    {f.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px 24px', textAlign: 'center',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          SpentyAI {new Date().getFullYear()}. Autonomous accounting software.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Link to="/features" style={footLink}>Features</Link>
          <Link to="/pricing" style={footLink}>Pricing</Link>
          <a href="/privacy" style={footLink}>Privacy</a>
          <a href="/terms" style={footLink}>Terms</a>
        </div>
      </footer>
    </div>
  );
}

// ---- Shared styles ----------------------------------------------------------
const navBtn = {
  background: 'var(--brand-primary)', color: '#fff', border: 'none',
  padding: '8px 20px', borderRadius: 2, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-body)',
};

const primaryBtn = {
  background: 'var(--brand-primary)', color: '#fff', border: 'none',
  padding: '14px 32px', borderRadius: 2, fontSize: 15, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-body)',
  display: 'inline-flex', alignItems: 'center', gap: 8,
  transition: 'transform 0.2s ease, background 0.2s ease',
};

const secondaryBtn = {
  background: 'transparent', color: 'var(--text-primary)',
  border: '1px solid var(--border-strong)', padding: '14px 32px',
  borderRadius: 2, fontSize: 15, fontWeight: 500, cursor: 'pointer',
  fontFamily: 'var(--font-body)',
};

const eyebrow = {
  fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: 'var(--accent-1)', fontWeight: 600,
};

const sectionH = {
  fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', marginTop: 12,
  fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)',
  fontFamily: 'var(--font-heading)',
};

const footLink = {
  fontSize: 12, color: 'var(--text-muted)', textDecoration: 'underline',
};

// ---- Sub-components ---------------------------------------------------------
function TrustCard({ icon: Icon, title, children }) {
  return (
    <div style={{
      padding: 28,
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 4,
    }}>
      <Icon size={24} weight="duotone" style={{ color: 'var(--accent-1)', marginBottom: 14 }} />
      <h3 style={{
        fontSize: 17, fontWeight: 600, marginBottom: 8,
        fontFamily: 'var(--font-body)', color: 'var(--text-primary)',
      }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {children}
      </p>
    </div>
  );
}
