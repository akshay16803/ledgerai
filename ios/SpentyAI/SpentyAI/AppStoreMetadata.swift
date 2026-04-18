import Foundation

// MARK: - App Store Metadata
// Reference constants for App Store Connect submission. Keep in sync with ASC entries.

enum AppStoreMetadata {

    static let appName = "SpentyAI - Smart Finance"

    static let subtitle = "AI-Powered Accounting & Invoicing"

    static let description = """
    Take control of your finances with SpentyAI — the intelligent accounting companion that \
    automates expense tracking, invoicing, and financial reporting so you can focus on growing \
    your business.

    SMART EXPENSE TRACKING
    Stop entering transactions manually. SpentyAI uses advanced AI to automatically categorize \
    your expenses as they arrive via email, SMS, or bank sync. Every coffee run, vendor payment, \
    and subscription is logged, labeled, and ready for review — no data entry required.

    PROFESSIONAL INVOICING — GST & INTERNATIONAL
    Create stunning, tax-compliant invoices in seconds. SpentyAI supports full GST invoicing for \
    India (CGST, SGST, IGST) along with international invoicing across 20+ countries. Customize \
    templates with your logo, set payment terms, and send invoices directly from the app. Track \
    payment status and send automatic reminders for overdue invoices.

    AI-POWERED BANK RECONCILIATION
    Upload your bank statements and let our AI parser match transactions to your records \
    automatically. SpentyAI highlights discrepancies, suggests matches, and learns from your \
    corrections to get smarter over time. End-of-month reconciliation has never been faster.

    CASH FLOW PROJECTIONS
    See where your money is going — and where it will be. SpentyAI analyzes your income and \
    expense patterns to generate cash flow forecasts, helping you plan ahead and avoid surprises. \
    Visualize trends with interactive charts and set alerts for low-balance thresholds.

    COMPREHENSIVE FINANCIAL REPORTS
    Generate profit & loss statements, balance sheets, expense breakdowns, and tax summaries \
    with a single tap. Export reports as PDF or CSV for your accountant, or share them directly. \
    All reports update in real time as new transactions flow in.

    EMAIL & SMS TRANSACTION SYNC
    Connect your email and SMS inbox to automatically detect and import transaction \
    notifications from banks, payment apps, and merchants. SpentyAI parses amounts, dates, \
    and vendors so every transaction is captured without lifting a finger.

    CROSS-PLATFORM WITH REAL-TIME SYNC
    Start on your iPhone, continue on the web. SpentyAI syncs your data in real time across \
    iOS and web so your books are always up to date, wherever you are.

    SUBSCRIPTION PLANS
    • Free: Up to 50 transactions/month, basic reports
    • Pro: Unlimited transactions, invoicing, reconciliation, cash flow projections
    • Business: Multi-user access, priority support, advanced analytics

    Download SpentyAI today and let AI handle your books.
    """

    static let keywords = "finance,accounting,invoice,GST,bookkeeping,expense tracker,budget,cash flow,reconciliation,AI"

    static let category = "Finance"

    static let secondaryCategory = "Business"

    static let privacyPolicyURL = "https://spentyai.com/privacy"

    static let supportURL = "https://spentyai.com/support"

    static let marketingURL = "https://spentyai.com"

    static let reviewNotes = """
    Test account credentials:
    - Email: reviewer@spentyai.com
    - Password: AppReview2026!

    The app requires Sign in with Google for production use. For review purposes, use the \
    test credentials above which bypass OAuth and provide access to a pre-populated demo \
    account with sample transactions, invoices, and reports.

    The app uses Apple In-App Purchase subscriptions (auto-renewable). The sandbox environment \
    is configured and the test account above has an active Pro subscription for review.

    Key areas to review:
    1. Dashboard — shows financial summary with stat cards and linked accounts
    2. Transactions — list of income/expenses with AI-categorized labels
    3. Invoicing — create and send GST-compliant invoices (More → Sales Invoices)
    4. Reconciliation — upload a bank statement to test AI matching (More → Reconciliation)
    5. Reports — generate P&L, balance sheet, and tax summaries

    No special hardware is required. The app requires an internet connection for sync and \
    AI features.
    """

    static let whatsNew = """
    Welcome to SpentyAI v1.0! Here's what's included in our launch release:

    • AI-powered expense tracking with automatic categorization
    • Professional GST invoicing for India + international invoicing (20+ countries)
    • Bank statement reconciliation with intelligent AI matching
    • Cash flow projections and interactive financial charts
    • Email and SMS transaction sync
    • Comprehensive reports: P&L, balance sheet, tax summaries
    • Real-time sync across iOS and web
    • Pro and Business subscription plans via Apple In-App Purchase
    """
}
