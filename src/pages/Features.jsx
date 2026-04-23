import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  EnvelopeSimple, ChartPie, Receipt, FileText, Users, Buildings,
  Shield, ArrowRight, CheckCircle, ChatsCircle, Brain, HandTap,
  TrendUp, Files, ArrowsLeftRight, Calendar, Camera, Repeat, Tag,
  CaretDown, CurrencyInr, Cpu, Bell, Wallet, CreditCard, Plugs,
  DeviceMobile, Desktop, GlobeHemisphereEast, Sparkle, ChartLine, Lock,
  UploadSimple, Gavel, MagnifyingGlass, ChartBar, ArrowCircleUp
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
    image: '/features/web/01-email-sync.png',
    imageAlt: 'SpentyAI Email Sync screen showing 1,962 emails scanned and transactions detected in real time',
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
    image: '/features/web/02-pending-review.png',
    imageAlt: 'Pending Review page with AI-detected transactions ready for one-tap approval',
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
    image: '/features/web/03-dashboard.png',
    imageAlt: 'SpentyAI Dashboard with monthly P&L, account balances, and pending review count',
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
    image: '/features/web/04-cashflow.png',
    imageAlt: 'Cash Flow projection calendar showing monthly recurring payments and balance forecast',
    flip: true,
  },
  {
    label: 'Feature 05',
    eyebrow: 'Invoices + Tax',
    title: 'ITR season is a ten-minute task.',
    body: 'Create GST-ready invoices with HSN/SAC codes, CGST/SGST/IGST auto-calculated, amount in words, and a clean PDF your client can print. Track who owes you with debtor aging. At year-end, run a Past Insights summary for FY 2025-26 and export a CSV your CA will actually thank you for.',
    bullets: [
      'GST invoices: CGST/SGST for same-state, IGST for inter-state — auto',
      'Debtor aging: current / 1-30 / 31-60 / 61-90 / 90+ days',
      'Past Insights: isolated FY summaries that never touch your live books',
    ],
    icon: FileText,
    image: '/features/web/05-invoices.png',
    imageAlt: 'Invoice editor with GST fields, HSN code, CGST + SGST breakdown, and customer debtor aging',
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
          <FeatureImage
            src="/features/web/00-hero.png"
            alt="SpentyAI dashboard and mobile app side by side — your intelligent personal accountant"
            aspect="16 / 9"
          />
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

      {/* Five hero features — alternating sides */}
      <section style={{ padding: '100px 24px 80px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <span className="mono" style={eyebrow}>Five reasons people pay</span>
            <h2 style={sectionH}>
              The features that <em style={{ color: 'var(--accent-1)', fontStyle: 'italic', fontFamily: 'var(--font-heading)' }}>earn</em> the subscription.
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 96 }}>
            {heroFeatures.map(({ label, eyebrow: ey, title, body, bullets, icon: Icon, image, imageAlt, flip }, i) => (
              <div key={label} style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 48,
                alignItems: 'center',
                direction: flip ? 'rtl' : 'ltr',
              }}>
                <div style={{ direction: 'ltr' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <Icon size={22} weight="duotone" style={{ color: 'var(--accent-1)' }} />
                    <span className="mono" style={{
                      fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
                      color: 'var(--text-muted)', fontWeight: 600,
                    }}>{label} · {ey}</span>
                  </div>
                  <h3 style={{
                    fontSize: 'clamp(1.6rem, 2.4vw, 2.2rem)', fontWeight: 500,
                    lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 16,
                    color: 'var(--text-primary)',
                  }}>
                    {title}
                  </h3>
                  <p style={{
                    fontSize: 16, color: 'var(--text-secondary)',
                    lineHeight: 1.7, marginBottom: 20,
                  }}>
                    {body}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {bullets.map((b, bi) => (
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
                <div style={{ direction: 'ltr' }}>
                  <FeatureImage src={image} alt={imageAlt} aspect="16 / 10" />
                </div>
              </div>
            ))}
          </div>
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
