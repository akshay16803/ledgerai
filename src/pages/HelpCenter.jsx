import { s, getCurrentLanguage } from '../lib/localization';
import { useState, useEffect, useMemo } from 'react';
import { MagnifyingGlass, Book, CaretRight, ArrowLeft, CheckCircle, Question } from '@phosphor-icons/react';

/**
 * Help Center — static, searchable knowledge base for SpentyAI.
 *
 * Articles reference screenshots in /public/help/<filename>.png.
 * If a file is missing, the <img> simply fails silently (no fallback layout
 * shift) — the caption still gives the reader context.
 */

const CATEGORIES = [
  { id: 'getting_started', label: 'Getting Started' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'email_sync', label: 'Email Sync' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'invoices_bills', label: 'Invoices & Purchases' },
  { id: 'reports', label: 'Reports' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'settings', label: 'Settings' },
  { id: 'billing', label: 'Billing' },
  { id: 'mobile', label: 'Mobile App' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
  { id: 'web', label: 'Web App' },
];

// Helper that produces the screenshot <img> for an article.
// Using a function keeps the article list compact and uniform.
function Screenshot({ file, alt, lang }) {
  // `file` is just the base name (no extension, no language). We append
  // -en/-hi.png based on the current language. If the Hindi variant is
  // missing, we fall back to -en.png; if that's missing too, the <img>
  // hides itself silently.
  const preferred = lang === 'hi' ? 'hi' : 'en';
  const handleError = (e) => {
    const img = e.currentTarget;
    const enSrc = `/help/${file}-en.png`;
    if (!img.src.endsWith('-en.png')) {
      img.src = enSrc;
    } else {
      img.style.display = 'none';
    }
  };
  return (
    <img
      src={`/help/${file}-${preferred}.png`}
      alt={alt}
      onError={handleError}
      style={{
        width: '100%',
        maxWidth: 340,
        display: 'block',
        margin: '16px auto 8px',
        borderRadius: 8,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
      }}
    />
  );
}

// Full article catalog — 33 entries, one per screenshot in the handoff doc.
const ARTICLES = [
  // Getting Started (1–4)
  {
    id: 'sign-in',
    category: 'getting_started',
    title: 'Signing in with Google',
    summary: 'Create your SpentyAI account in one tap using Google.',
    file: '01-sign-in',
    body: [
      'Open the SpentyAI app or visit www.spentyai.com and tap "Sign in with Google".',
      'Choose the Google account you want to use for your business finances. SpentyAI only requests the minimum scopes needed — your email address and Gmail read access (only granted if you later enable Email Sync).',
      'If this is your first time, a short onboarding flow helps you set your business name and currency.',
    ],
  },
  {
    id: 'email-sync-connect',
    category: 'getting_started',
    title: 'Connecting your first email inbox',
    summary: 'Let SpentyAI read transactional emails and turn them into draft transactions.',
    file: '02-email-sync-connect',
    body: [
      'Go to Email Sync from the More tab (mobile) or sidebar (web).',
      'Tap "Connect Gmail" or "Connect Outlook". You will be redirected to Google/Microsoft to grant read-only access.',
      'Once connected, SpentyAI scans your inbox for bank alerts, UPI notifications, credit-card statements, invoices, and subscription receipts — and creates draft transactions for your approval.',
    ],
  },
  {
    id: 'pending-approval-list',
    category: 'getting_started',
    title: 'Approving AI-drafted transactions',
    summary: 'Every AI-created transaction lands in Pending Approval — nothing hits your books without a tap.',
    file: '03-pending-approval-list',
    body: [
      'Open the Dashboard and tap the "Pending Approval" card.',
      'Review each drafted transaction: amount, account, category, counterparty. Tap to approve, edit, or reject.',
      'Only approved transactions affect your dashboard, reports, and cash-flow projections. Pending items are intentionally excluded from every calculation.',
    ],
  },
  {
    id: 'hindi-toggle',
    category: 'getting_started',
    title: 'Switching between Hindi and English',
    summary: 'SpentyAI is fully bilingual. Flip the whole app with one toggle.',
    file: '04-hindi-toggle',
    body: [
      'On the mobile Dashboard, look for the "हि / En" button in the top-right corner.',
      'On the web app, the toggle sits at the bottom of the sidebar, just above Sign Out.',
      'Tap it to switch instantly. Your preference persists across sessions and devices signed into the same account.',
    ],
  },

  // Dashboard (5–7)
  {
    id: 'dashboard-overview',
    category: 'dashboard',
    title: 'Reading the Dashboard',
    summary: 'One glance gives you cash in, cash out, pending approvals, and a 30-day projection.',
    file: '05-dashboard-overview',
    body: [
      'Stat cards at the top show this month\'s money in, money out, and net.',
      'Projection chart forecasts your cash balance for the next 30 days using recurring mandates and historical patterns.',
      'Accounts block lists all connected accounts with live balances. Tap any card to drill into its full ledger.',
    ],
  },
  {
    id: 'pending-transaction-detail',
    category: 'dashboard',
    title: 'Reviewing a single pending transaction',
    summary: 'Inspect the source email, edit fields, then approve or reject in one sheet.',
    file: '06-pending-transaction-detail',
    body: [
      'From the Pending Approval list, tap any row to open the detail sheet.',
      'You can edit amount, account, category, counterparty, and notes. The original email snippet is shown at the bottom so you can verify context.',
      'Tap Approve to add it to your ledger, or Reject to discard. Rejected items are remembered so the AI learns not to re-draft them.',
    ],
  },
  {
    id: 'ai-chat',
    category: 'dashboard',
    title: 'Asking the AI Chat questions about your finances',
    summary: 'Type a natural-language question and get numbers pulled straight from your approved data.',
    file: '07-ai-chat',
    body: [
      'Open the AI Chat screen from the More tab.',
      'Ask things like "How much did I spend on vendors last month?" or "Show my top 3 income sources this quarter".',
      'The AI only uses approved transactions, so answers always line up with what you see on the dashboard.',
    ],
  },

  // Email Sync (8–10)
  {
    id: 'gmail-connected',
    category: 'email_sync',
    title: 'What the Gmail sync status shows',
    summary: 'See how many emails were scanned, how many became drafts, and the last sync time.',
    file: '08-gmail-connected',
    body: [
      'On the Email Sync screen, your connected Gmail account shows total emails processed, drafts created, and the last sync timestamp.',
      'Tap "Sync now" to force an immediate re-scan. SpentyAI also syncs in the background every few hours.',
      'Use "Disconnect" if you want to revoke access — your existing transactions remain.',
    ],
  },
  {
    id: 'outlook-connected',
    category: 'email_sync',
    title: 'Connecting Outlook / Office 365',
    summary: 'Outlook works the same as Gmail — same scan, same Pending Approval flow.',
    file: '09-outlook-connected',
    body: [
      'Under Email Sync, tap "Connect Outlook" and authorize SpentyAI against your Microsoft account.',
      'Outlook-sourced transactions also land in Pending Approval and are indistinguishable from Gmail-sourced ones once approved.',
      'You can connect both Gmail and Outlook simultaneously.',
    ],
  },
  {
    id: 'sync-date-picker',
    category: 'email_sync',
    title: 'Choosing how far back to sync',
    summary: 'Pick a start date so SpentyAI only scans emails you care about.',
    file: '10-sync-date-picker',
    body: [
      'On first connection, SpentyAI asks how far back to scan. Default is 30 days.',
      'Choose a farther-back date for a full historical reconstruction — note that very large inboxes can take a few minutes to process.',
      'You can always re-sync with a different window later from the Email Sync screen.',
    ],
  },

  // Transactions (11–13)
  {
    id: 'transaction-list',
    category: 'transactions',
    title: 'The Transactions tab',
    summary: 'Every approved transaction lives here. Search, filter, and export from one place.',
    file: '11-transaction-list',
    body: [
      'The Transactions tab shows all approved transactions, newest first.',
      'Tap the search icon to find a transaction by amount, counterparty, or note.',
      'Pending items are never mixed in — this list always reflects your official books.',
    ],
  },
  {
    id: 'new-transaction-form',
    category: 'transactions',
    title: 'Adding a transaction manually',
    summary: 'For cash payments or anything that did not come via email, add it yourself.',
    file: '12-new-transaction-form',
    body: [
      'Tap the "+" button on the Transactions tab to open the New Transaction form.',
      'Set type (income or expense), amount, account, category, date, counterparty, and an optional note.',
      'Save — it is added immediately to your ledger (no approval step needed for manual entries).',
    ],
  },
  {
    id: 'transaction-filters',
    category: 'transactions',
    title: 'Filtering transactions',
    summary: 'Narrow by type, account, date range, or category to find exactly what you need.',
    file: '13-transaction-filters',
    body: [
      'Tap the filter icon to expand the filter panel.',
      'Combine type + account + date range + category to answer questions like "show all FY26 Q1 expenses from HDFC".',
      'Filtered results can be exported directly from Reports.',
    ],
  },

  // Accounts (14–16)
  {
    id: 'accounts-list',
    category: 'accounts',
    title: 'Viewing all your accounts',
    summary: 'Accounts are grouped by type so you always know what is cash, credit, or investment.',
    file: '14-accounts-list',
    body: [
      'The Accounts tab lists every account grouped by type: Bank, Credit Card, Wallet, Cash, Investment, Loan.',
      'Each card shows the current balance (only approved transactions) and a small sparkline for the month.',
      'Tap "+" at the top to add a new account manually.',
    ],
  },
  {
    id: 'account-detail',
    category: 'accounts',
    title: 'Drilling into a single account',
    summary: 'See the full ledger for one account plus a month-over-month balance chart.',
    file: '15-account-detail',
    body: [
      'Tap any account card to open its detail view.',
      'You get the running balance over time, a full transaction list, and buttons to edit or archive the account.',
      'Reconciliation lives here too — match your statement line-by-line.',
    ],
  },
  {
    id: 'ai-created-account',
    category: 'accounts',
    title: 'What the AI badge on an account means',
    summary: 'SpentyAI can create an account automatically when it sees a new source in your emails.',
    file: '16-ai-created-account',
    body: [
      'If SpentyAI detects a new bank or card in your inbox, it creates a stub account labeled with an AI badge.',
      'Review the auto-created account, set its type and opening balance, then the badge disappears.',
      'AI-created accounts can also be deleted or merged with an existing account from the detail view.',
    ],
  },

  // Invoices & Purchases (17–19)
  {
    id: 'invoices-list',
    category: 'invoices_bills',
    title: 'The Invoices screen',
    summary: 'Track invoices you have issued to customers, with status, due date, and overdue alerts.',
    file: '17-invoices-list',
    body: [
      'Open Invoices from the sidebar (web) or More tab (mobile).',
      'Each row shows customer, amount, issue date, due date, and current status (draft, sent, paid, overdue).',
      'Tap a row to open the invoice, mark it as paid, or send a reminder email.',
    ],
  },
  {
    id: 'new-invoice-form',
    category: 'invoices_bills',
    title: 'Creating an invoice',
    summary: 'Issue a professional invoice with line items, tax, and a shareable PDF.',
    file: '18-new-invoice-form',
    body: [
      'Tap "New Invoice" and pick a customer (or create one inline).',
      'Add line items with quantity, unit price, and tax. Totals calculate automatically.',
      'Save the invoice as a draft or send it by email. A downloadable PDF is attached on send.',
    ],
  },
  {
    id: 'purchases-list',
    category: 'invoices_bills',
    title: 'Recording bills from vendors',
    summary: 'The Purchases screen is where vendor bills live — mirror-image of Invoices.',
    file: '19-purchases-list',
    body: [
      'Purchases tracks bills you owe to vendors.',
      'Each purchase can be marked paid, partially paid, or overdue, and pays down when you record a matching expense transaction.',
      'Use this to reconcile credit-card charges against actual vendor bills.',
    ],
  },

  // Reports (20–21)
  {
    id: 'reports-overview',
    category: 'reports',
    title: 'Running a report',
    summary: 'Slice your data by date, account, or category to answer finance questions in seconds.',
    file: '20-reports-overview',
    body: [
      'The Reports tab shows a stacked summary of income vs expenses by category for your selected period.',
      'Use the date filters at the top to switch between this month, last month, this quarter, this FY, or a custom range.',
      'Tap any category bar to see the underlying transactions that drove the number.',
    ],
  },
  {
    id: 'reports-export',
    category: 'reports',
    title: 'Exporting reports to CSV or PDF',
    summary: 'Hand your accountant a tidy file — CSV for spreadsheet work, PDF for filing.',
    file: '21-reports-export',
    body: [
      'Scroll to the bottom of any report to find the Export buttons.',
      'CSV gives you raw transaction rows for the filter you have applied.',
      'PDF gives you a formatted summary report suitable for sharing or printing.',
    ],
  },

  // Cash Flow (22–23)
  {
    id: 'cashflow-overview',
    category: 'cashflow',
    title: 'Reading the Cash Flow projection',
    summary: 'A forward-looking view of what your balance will be over the next 30–90 days.',
    file: '22-cashflow-overview',
    body: [
      'The Cash Flow screen projects your total cash balance using approved transactions + recurring mandates.',
      'Stat cards show expected cash in, expected cash out, and the lowest-projected balance.',
      'Points on the chart where the line dips below zero are highlighted — that is when to take action.',
    ],
  },
  {
    id: 'mandates-list',
    category: 'cashflow',
    title: 'Managing recurring mandates',
    summary: 'Rent, salaries, subscriptions — anything that repeats — lives as a mandate.',
    file: '23-mandates-list',
    body: [
      'The Mandates tab within Cash Flow lists every recurring obligation SpentyAI has learned.',
      'Mandates detected from email start as pending_review so you can confirm the amount and frequency before they affect projections.',
      'Edit or pause a mandate anytime — projections update instantly.',
    ],
  },

  // Settings (24–26)
  {
    id: 'settings-main',
    category: 'settings',
    title: 'Finding your way around Settings',
    summary: 'Business profile, currency, notifications, and data controls live here.',
    file: '24-settings-main',
    body: [
      'Settings is split into a few sections: Business Profile, Preferences, Integrations, and Danger Zone.',
      'Most day-to-day changes (currency, fiscal year, language) live under Preferences.',
      'Danger Zone is where you can reset or delete your data.',
    ],
  },
  {
    id: 'business-profile',
    category: 'settings',
    title: 'Editing your business profile',
    summary: 'Your business name, GSTIN, and logo appear on invoices and PDF reports.',
    file: '25-business-profile',
    body: [
      'Under Settings → Business Profile, update your business name, address, GSTIN / tax ID, and logo.',
      'Changes apply immediately to any new invoice or report you generate.',
      'Old invoices keep their original profile snapshot for audit clarity.',
    ],
  },
  {
    id: 'reset-data',
    category: 'settings',
    title: 'Resetting your data',
    summary: 'Wipe all transactions and accounts while keeping your login. Useful for testing.',
    file: '26-reset-data',
    body: [
      'In Settings → Danger Zone, tap "Reset Data".',
      'You will be asked to type the word RESET to confirm. This clears every transaction, account, invoice, and mandate.',
      'Your user account, subscription, and language preference are preserved. This action cannot be undone.',
    ],
  },

  // Billing (27)
  {
    id: 'billing-page',
    category: 'billing',
    title: 'Viewing and changing your subscription',
    summary: 'See which plan you are on, change plans, or update payment details.',
    file: '27-billing-page',
    body: [
      'Open Billing from the top of the sidebar (web) or under More → Billing (mobile).',
      'Current plan, next renewal date, and payment method are shown at the top.',
      'Tap "Change plan" to upgrade or downgrade, or "Manage billing" to update card and download invoices.',
    ],
  },

  // Mobile App (28–29)
  {
    id: 'bottom-tabs',
    category: 'mobile',
    title: 'The bottom tab bar on mobile',
    summary: 'Five tabs give you one-tap access to Dashboard, Transactions, Accounts, Reports, and More.',
    file: '28-bottom-tabs',
    body: [
      'The bottom tab bar is always visible on mobile.',
      'Order: Dashboard, Transactions, Accounts, Reports, More.',
      'The More tab expands into the full menu of secondary screens.',
    ],
  },
  {
    id: 'more-menu',
    category: 'mobile',
    title: 'What lives under the More tab',
    summary: 'Cash Flow, Invoices, Mandates, Email Sync, Settings, AI Chat, and Support — all one tap away.',
    file: '29-more-menu',
    body: [
      'Tap More (bottom-right) to see the full list of secondary screens.',
      'Items include Cash Flow, Invoices, Purchases, Categories, Customers, Vendors, Mandates, Email Sync, Records, Settings, Billing, AI Chat, Support.',
      'Order follows the web sidebar so the two surfaces feel consistent.',
    ],
  },

  // Troubleshooting (30–32)
  {
    id: 'email-sync-error',
    category: 'troubleshooting',
    title: 'Reconnecting after an Email Sync error',
    summary: 'If your Gmail or Outlook token expires, reconnect in one tap.',
    file: '30-email-sync-error',
    body: [
      'If a token expires (Google usually every 30 days of inactivity), Email Sync shows a yellow banner.',
      'Tap "Reconnect". You will re-authenticate and sync will resume from where it left off — no data is lost.',
      'If reconnection fails repeatedly, disconnect the account entirely and reconnect from scratch.',
    ],
  },
  {
    id: 'empty-transactions',
    category: 'troubleshooting',
    title: 'Why the Transactions list looks empty',
    summary: 'New accounts show "No Approved Transactions" until you approve your first item.',
    file: '31-empty-transactions',
    body: [
      'The Transactions tab only shows approved transactions. Items waiting in Pending Approval do not appear here.',
      'If you just connected Email Sync, head to Pending Approval on the Dashboard and approve a few items.',
      'You can also add a transaction manually with the "+" button.',
    ],
  },
  {
    id: 'outlook-settings',
    category: 'troubleshooting',
    title: 'Where to find the Outlook connect button',
    summary: 'Outlook lives alongside Gmail in the Email Sync screen.',
    file: '32-outlook-settings',
    body: [
      'In the Email Sync screen, scroll to the Outlook section.',
      'Tap "Connect Outlook" and authorize with Microsoft. The same approve-first workflow applies.',
      'If your organization restricts third-party apps, an admin may need to approve SpentyAI for your tenant.',
    ],
  },

  // Web App (33)
  {
    id: 'web-dashboard',
    category: 'web',
    title: 'Using SpentyAI on the web',
    summary: 'Every feature in the mobile app is also on www.spentyai.com.',
    file: '33-web-dashboard',
    body: [
      'Sign in at www.spentyai.com with the same Google account.',
      'The web app shares the exact same data as mobile — dashboard, transactions, accounts, reports, everything.',
      'A left-hand sidebar replaces the bottom tabs, but every action and shortcut mirrors the mobile app.',
    ],
  },
];

export default function HelpCenter() {
  const [lang, setLang] = useState(getCurrentLanguage());
  useEffect(() => {
    const h = () => setLang(getCurrentLanguage());
    window.addEventListener('languageChanged', h);
    return () => window.removeEventListener('languageChanged', h);
  }, []);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openArticle, setOpenArticle] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARTICLES.filter((a) => {
      if (activeCategory !== 'all' && a.category !== activeCategory) return false;
      if (!q) return true;
      const hay = `${a.title} ${a.summary} ${a.body.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, activeCategory]);

  const article = openArticle ? ARTICLES.find((a) => a.id === openArticle) : null;

  if (article) {
    return (
      <div data-testid="help-center-article">
        <button
          data-testid="help-back-btn"
          onClick={() => setOpenArticle(null)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-body)',
            padding: '6px 0', marginBottom: 16,
          }}
        >
          <ArrowLeft size={16} /> Back to Help Center
        </button>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>
          {article.title}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
          {article.summary}
        </p>
        <Screenshot file={article.file} alt={article.title} lang={lang} />
        <div style={{
          background: '#fff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 2,
          padding: 28,
          marginTop: 16,
        }}>
          {article.body.map((para, i) => (
            <p key={i} style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: i === article.body.length - 1 ? 0 : 14 }}>
              {para}
            </p>
          ))}
        </div>
        <div style={{
          marginTop: 24,
          padding: '18px 22px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <CheckCircle size={22} weight="duotone" style={{ color: 'var(--success)', flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Still have questions? Open <strong>Support</strong> from the sidebar to send a ticket directly to our team.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="help-center-page">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em' }}>
          Help Center
        </h1>
        <p className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          33 guides · updated for the latest release
        </p>
      </div>

      {/* Search */}
      <div style={{
        position: 'relative',
        marginBottom: 20,
      }}>
        <MagnifyingGlass size={16} style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
        }} />
        <input
          data-testid="help-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help articles…"
          style={{
            width: '100%',
            padding: '12px 14px 12px 40px',
            border: '1px solid var(--border-strong)',
            borderRadius: 2,
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            outline: 'none',
            background: 'var(--bg-primary)',
          }}
        />
      </div>

      {/* Category pills */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24,
      }}>
        {[{ id: 'all', label: 'All' }, ...CATEGORIES].map((c) => {
          const active = activeCategory === c.id;
          return (
            <button
              key={c.id}
              data-testid={`help-cat-${c.id}`}
              onClick={() => setActiveCategory(c.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 16,
                border: `1px solid ${active ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
                background: active ? 'var(--brand-primary)' : 'transparent',
                color: active ? '#fff' : 'var(--text-secondary)',
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Article list */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--text-muted)',
          background: '#fff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 2,
        }}>
          <Question size={32} weight="duotone" style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
          <div style={{ fontSize: 14 }}>No articles match your search.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((a) => (
            <button
              key={a.id}
              data-testid={`help-article-${a.id}`}
              onClick={() => setOpenArticle(a.id)}
              style={{
                textAlign: 'left',
                background: '#fff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 2,
                padding: '16px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                fontFamily: 'var(--font-body)',
                transition: 'border-color 0.15s, transform 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Book size={18} weight="duotone" style={{ color: 'var(--brand-primary)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {a.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {a.summary}
                </div>
              </div>
              <CaretRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}

      {/* Escape hatch — CTA to Support */}
      <div style={{
        marginTop: 32,
        padding: 24,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 2,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 6, fontWeight: 600 }}>
          Did not find what you need?
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Open a support ticket and we usually reply within one business day.
        </div>
        <a
          href="/support"
          data-testid="help-go-to-support"
          style={{
            display: 'inline-block',
            background: 'var(--brand-primary)',
            color: '#fff',
            padding: '9px 22px',
            borderRadius: 2,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            fontFamily: 'var(--font-body)',
          }}
        >
          Contact Support
        </a>
      </div>
    </div>
  );
}
