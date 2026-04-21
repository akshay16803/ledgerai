# SpentyAI Comprehensive Test Cases

## Test Environment
- **iOS Simulator:** iPhone 17 Pro (iOS 26.3)
- **Backend:** https://api.spentyai.com (Railway, emergent branch)
- **Frontend:** https://www.spentyai.com (GitHub Pages)
- **Test User:** akshaychouhan16803@gmail.com

---

## SECTION 1: APP LAUNCH & AUTH

### TC-1.1: App Launch
- [ ] App launches without crash
- [ ] Loading spinner shows "Checking your session..."
- [ ] If authenticated + subscribed → MainTabView loads
- [ ] If authenticated + no subscription → SubscriptionPaywall shows
- [ ] If not authenticated → LoginView shows

### TC-1.2: Login Screen
- [ ] App icon and "SpentyAI" branding visible
- [ ] "Smart spending starts here" subtitle visible
- [ ] "Sign in with Google" button visible and tappable
- [ ] Button disabled while loading (shows ProgressView)
- [ ] Terms of Service link tappable
- [ ] Privacy Policy link tappable
- [ ] Error banner shows on failed login with dismiss X button
- [ ] Error alert shows with OK button
- [ ] Successful login transitions to MainTabView (with animation)

### TC-1.3: Subscription Paywall
- [ ] Crown icon and feature pills visible
- [ ] Plan selector shows all plans (Monthly, Quarterly, Yearly, Lifetime)
- [ ] Yearly selected by default with "Popular" badge
- [ ] "Continue" button triggers purchase flow
- [ ] Promo code section expandable/collapsible
- [ ] Promo code validation works (Apply button)
- [ ] "Restore Purchases" button tappable
- [ ] Processing overlay shows during purchase
- [ ] Successful subscription transitions to MainTabView

---

## SECTION 2: NAVIGATION

### TC-2.1: Tab Bar (iPhone)
- [ ] 5 tabs visible: Dashboard, Transactions, Accounts, Reports, More
- [ ] Each tab icon correct (house, arrows, building, chart, ellipsis)
- [ ] Tapping each tab switches content correctly
- [ ] Tab bar stays visible across all main tabs
- [ ] Selected tab highlighted with spentyPrimary color

### TC-2.2: More Menu
- [ ] All sections visible: Finance, People, Data, Tools, Account
- [ ] Finance items: Cash Flow, Invoices, Purchases, Categories — all tappable and navigate correctly
- [ ] People items: Customers, Vendors — all tappable and navigate correctly
- [ ] Data items: Reconciliation, Email Sync, SMS Sync, Records, Past Insights — all tappable
- [ ] Tools: AI Chat opens as sheet (not navigation push)
- [ ] Tools: Feature Requests, Support — navigate correctly
- [ ] Account: Settings, Billing — navigate correctly
- [ ] Scroll works if content exceeds screen height

### TC-2.3: iPad Sidebar (if applicable)
- [ ] NavigationSplitView with sidebar and detail pane
- [ ] All 20 items visible in sidebar
- [ ] Selecting each item shows correct detail view
- [ ] Empty state shows when no item selected

---

## SECTION 3: DASHBOARD

### TC-3.1: Dashboard Loading
- [ ] Loading state shows on first load
- [ ] Pull-to-refresh triggers data reload
- [ ] Error banner shows on API failure with dismiss button
- [ ] AI Chat button (sparkles) in toolbar opens AIChatView sheet

### TC-3.2: Stats Grid (2x2)
- [ ] "Net Worth" card shows correct amount (sum of all accounts, liabilities subtracted)
- [ ] "Income This Month" shows correct amount
- [ ] "Expenses This Month" shows correct amount
- [ ] "Pending Review" shows correct count
- [ ] Tapping Net Worth opens DashboardAccountsListView sheet
- [ ] Tapping Income opens DashboardFilteredTransactionsView (income filter)
- [ ] Tapping Expenses opens DashboardFilteredTransactionsView (expense filter)
- [ ] Tapping Pending opens DashboardAllPendingView sheet
- [ ] Currency formatting uses Indian numbering (Cr/L) for large values

### TC-3.3: Next Month Projection Tile
- [ ] Shows Expenses, EMIs, OD Interest, Total Outflow amounts
- [ ] Tapping opens MonthlyCalendarView sheet
- [ ] Calendar shows correct month name
- [ ] Calendar grid has 7 columns (Sun-Sat)
- [ ] Day cells show colored dots for different transaction types
- [ ] Tapping a day shows detail card with entries
- [ ] Summary bar shows Inflow/Outflow/Net
- [ ] "Unscheduled" section shows items without fixed date

### TC-3.4: Collapsible Sections
- [ ] "Accounts" section header tappable — toggles expand/collapse with animation
- [ ] Expanded accounts list shows all accounts with icon, name, type, balance
- [ ] Each account row is a NavigationLink → AccountDetailView
- [ ] "Recent Transactions" section toggles expand/collapse
- [ ] Shows max 10 approved transactions
- [ ] Each transaction row shows description, date, amount with correct color (green/red/blue)
- [ ] Tapping transaction row opens UnifiedTransactionForm (edit mode) sheet
- [ ] "Pending Approval" section toggles expand/collapse
- [ ] Pending items show description, date, amount, source icon
- [ ] Tapping pending item opens approval form sheet

### TC-3.5: Floating Action Button
- [ ] "+" FAB visible at bottom-right
- [ ] Tapping opens new transaction sheet (UnifiedTransactionForm create mode)

### TC-3.6: Dashboard Drill-Down Sheets
- [ ] DashboardAccountsListView: all accounts listed, tapping navigates to AccountDetailView, "Done" dismisses
- [ ] DashboardFilteredTransactionsView: correct filter applied (income/expense), tapping opens edit form, "Done" dismisses
- [ ] DashboardAllPendingView: all pending items listed, tapping opens approval form, "Done" dismisses

### TC-3.7: Pending Transaction Approval Sheet
- [ ] Type picker (Income/Expense/Transfer) works
- [ ] Amount field editable
- [ ] Date picker works
- [ ] Account picker shows all accounts + "Add New" inline button
- [ ] "Add New Account" alert: name field, type picker, create button works
- [ ] To-Account picker visible only for transfers
- [ ] Payment method picker works
- [ ] Category picker shows categories filtered by type + "Add New" button
- [ ] Subcategory picker shows when category selected + "Add New" button
- [ ] Description field editable
- [ ] Recurring toggle + frequency picker + day field work
- [ ] Source Document card expandable, loads source content
- [ ] "Approve Transaction" button (green) works — removes from list
- [ ] "Reject Transaction" button (red) works — removes from list

### TC-3.8: Cross-Screen Data — Dashboard
- [ ] After approving pending transaction on Dashboard → Transactions tab shows it as approved
- [ ] After rejecting → it disappears from pending count
- [ ] Net Worth matches sum of all accounts in Accounts tab
- [ ] Income/Expense amounts match Reports totals for current month
- [ ] Pending count matches Email Sync pending review count

---

## SECTION 4: TRANSACTIONS

### TC-4.1: Transaction List View
- [ ] List loads with transactions on appear
- [ ] Pull-to-refresh reloads data
- [ ] Segmented control toggles between List and Ledger view modes
- [ ] Search bar functional — typing triggers search, clear works
- [ ] Filter chips: All, Income, Expense, Transfer — each filters correctly
- [ ] Account picker dropdown shows "All Accounts" + all accounts
- [ ] Date range button opens popover with From/To pickers and Apply button
- [ ] Clear date filter (X button) removes date filter
- [ ] Toolbar "+" opens create transaction form
- [ ] Empty state shows "Add Transaction" button

### TC-4.2: Transaction List Rows
- [ ] Each row shows: type icon (colored), description, category name, account name, date, amount
- [ ] Amount color: green=income, red=expense, blue=transfer
- [ ] Category shows human-readable name (not ID)
- [ ] Account shows human-readable name (not ID)
- [ ] Tapping row opens edit sheet (UnifiedTransactionForm)
- [ ] Long press enters selection mode
- [ ] In selection mode: checkmarks visible, tapping toggles selection
- [ ] Toolbar shows "Select All" / "Cancel" in selection mode
- [ ] Bulk delete bar visible with trash icon

### TC-4.3: Transaction Swipe Actions
- [ ] Swipe left reveals "Delete" (destructive) — shows confirmation dialog
- [ ] Swipe left reveals "Edit" — opens edit form
- [ ] Delete confirmation dialog has "Delete" and "Cancel" buttons
- [ ] Deleting removes row from list

### TC-4.4: Infinite Scroll
- [ ] Scrolling to bottom triggers loadMore
- [ ] Loading spinner shows at bottom while loading
- [ ] New transactions append to list
- [ ] Stops loading when no more pages

### TC-4.5: Ledger View
- [ ] Switching to Ledger shows table with Date, Description, Debit, Credit columns
- [ ] "Select an account to see running balance" hint shown when no account filter
- [ ] When account selected: Balance column appears with running balance
- [ ] Debit column (red) for expenses, Credit column (green) for income
- [ ] Running balance colored: blue=positive, red=negative
- [ ] Alternating row backgrounds
- [ ] Pull-to-refresh works
- [ ] Infinite scroll works

### TC-4.6: Transaction Create Form
- [ ] Type picker: Income, Expense, Transfer buttons — colors change
- [ ] Amount hero field with decimal pad
- [ ] Context label updates: "Money received" / "Money spent" / "Transfer amount"
- [ ] Date picker works
- [ ] Account picker shows all accounts
- [ ] "+" next to Account opens New Account alert (name + type picker + Create)
- [ ] Creating new account adds it to picker immediately
- [ ] To-Account picker visible only for Transfer type
- [ ] Payment method picker: Cash, UPI, Bank Transfer, Credit Card, etc.
- [ ] Category picker filtered by type (income categories for income, etc.)
- [ ] "+" next to Category opens New Category alert
- [ ] Subcategory picker visible when category selected
- [ ] "+" next to Subcategory opens New Subcategory alert
- [ ] Note text field works
- [ ] Recurring toggle: shows frequency buttons + recurrence day
- [ ] PhotosPicker for receipt attachment works
- [ ] "Switch to Invoice" visible for income type
- [ ] Cancel button dismisses without saving
- [ ] Create/Save button disabled when required fields empty
- [ ] Successful create adds to list and dismisses

### TC-4.7: Transaction Detail View
- [ ] Amount displayed with correct sign and color
- [ ] Status badge shown for non-approved (pending, rejected)
- [ ] Detail card rows: Type, Date, Description, Category, Subcategory, Account, To Account (transfers), Payment Method
- [ ] Recurring info shown if applicable
- [ ] Foreign currency info shown if applicable
- [ ] Edit button opens edit form sheet
- [ ] Approve/Reject buttons visible for pending transactions
- [ ] Delete button shows confirmation dialog
- [ ] Source Document card loads and expands (for email/SMS sourced)
- [ ] Attachments list shows with download buttons
- [ ] Downloading attachment shows progress, then opens preview
- [ ] Receipt section shows receipt or "No receipt attached"

### TC-4.8: Cross-Screen Data — Transactions
- [ ] Creating transaction on Transactions tab → appears in Dashboard recent
- [ ] Creating income → Dashboard Income amount increases
- [ ] Creating expense → Dashboard Expense amount increases
- [ ] Deleting transaction → disappears from all views
- [ ] Editing transaction → reflected in transaction detail, list, and reports
- [ ] Transaction account balance updates in Accounts tab

---

## SECTION 5: ACCOUNTS

### TC-5.1: Account List
- [ ] List loads on appear
- [ ] Search bar filters accounts by name, type, sub-type, account number
- [ ] Total Balance card shows correct aggregate
- [ ] Accounts grouped by type (Asset, Liability, Equity, Investment)
- [ ] Section headers show icon, type name, section total
- [ ] Each row shows icon, name, sub-type badge (if present), balance
- [ ] Tapping row navigates to AccountDetailView
- [ ] Toolbar "+" opens AccountFormView (create mode)
- [ ] Swipe left: Delete (with confirmation), Edit
- [ ] Pull-to-refresh
- [ ] Empty state: "Add Account" button
- [ ] Error banner dismissible

### TC-5.2: Account Detail
- [ ] Info card: icon, name, type, sub-type badge, current balance, opening balance with as-of date
- [ ] Detail grid: account number, currency
- [ ] Loan accounts: interest rate, tenure, EMI amount, EMI day, sanctioned amount
- [ ] Investment accounts: broker name
- [ ] Edit button (pencil) opens edit form sheet
- [ ] Opening balance row tappable — toggles inline editing
- [ ] Inline edit: amount field, date picker, "Save & Recalculate", close button
- [ ] Tab selector: Transactions, Amortization (loans), OD Interest (OD), Demat (demat)

### TC-5.3: Account Detail — Transactions Tab
- [ ] Search field works
- [ ] Type segmented control: All/Income/Expense/Transfer
- [ ] "More Filters" toggle expands advanced filters
- [ ] Date from/to pickers, Category picker, Min/Max amount, "Apply Filters" button
- [ ] "Clear Filters" button visible when filters active
- [ ] Transaction rows: type icon, description, date, signed amount
- [ ] Tapping transaction opens TransactionDetailView sheet
- [ ] Filter result count shown

### TC-5.4: Account Detail — Amortization Tab (Loan Accounts)
- [ ] Total Payment and Total Interest stat cards
- [ ] Stacked bar chart (principal vs interest)
- [ ] Amortization table: Month #, EMI, Principal, Interest, Outstanding Balance
- [ ] At least 24 rows visible

### TC-5.5: Account Detail — OD Interest Tab
- [ ] From/To date pickers visible
- [ ] "Calculate Interest" button works
- [ ] Results: Interest amount, number of days, average balance, effective rate

### TC-5.6: Account Detail — Demat Tab
- [ ] DematUploadView embedded
- [ ] Upload area (dashed) opens file picker for PDF/CSV
- [ ] Uploaded statements list: filename, date, count, status badge
- [ ] Pending statements: Approve/Reject buttons with confirmation

### TC-5.7: Account Form (Create/Edit)
- [ ] Title: "New Account" or "Edit Account"
- [ ] Account Name field (required)
- [ ] Account Type picker: asset, liability, equity, investment
- [ ] Sub-Type picker/field
- [ ] Account Number field
- [ ] Currency picker (INR, USD, EUR, etc.)
- [ ] Opening Balance field
- [ ] Balance As-of Date picker
- [ ] Loan fields visible when type=liability: Interest Rate, Tenure, EMI, EMI Day, Sanctioned
- [ ] Demat fields visible when type=investment + sub-type contains "demat"
- [ ] Notes field (multiline)
- [ ] Cancel dismisses
- [ ] Save creates/updates and dismisses
- [ ] Saving overlay shown

### TC-5.8: Cross-Screen Data — Accounts
- [ ] Creating account → appears in Dashboard accounts section
- [ ] Creating account → appears in Transaction form account pickers
- [ ] Editing account balance → Dashboard Net Worth updates
- [ ] Deleting account → removed from all pickers and views
- [ ] Account transactions match those in Transactions tab filtered by account

---

## SECTION 6: REPORTS

### TC-6.1: Reports View
- [ ] Loading overlay on first load
- [ ] Period filter chips: This Month, Last 3 Months, Last 6 Months, This Year, All Time, Custom
- [ ] Selecting each period reloads data
- [ ] Custom: From/To DatePickers + Refresh button
- [ ] Pull-to-refresh works
- [ ] Error alert with OK

### TC-6.2: Summary Cards
- [ ] 4 stat cards: Total Income, Total Expense, Net, Transaction count
- [ ] Colors correct: green=income, red=expense, blue/green=net depending on sign
- [ ] Tapping each card opens drill-down sheet with matching transactions

### TC-6.3: Category Analysis
- [ ] Expense/Income segmented toggle switches data
- [ ] DonutChartView shows correct categories with colors
- [ ] Tapping donut chart legend selects/deselects category
- [ ] Center label shows total or selected category
- [ ] PeriodChartView shows Income vs Expense bars per period
- [ ] Tapping bar shows detail row

### TC-6.4: Category Table
- [ ] "Category Details" header visible
- [ ] Each category row: name, count, amount, percentage, progress bar
- [ ] Tapping category expands to show subcategories (chevron rotates)
- [ ] Subcategory rows: name, count, total, percentage
- [ ] Tapping subcategory opens drill-down
- [ ] "View all in [category]" and "View all transactions" links work

### TC-6.5: Export
- [ ] "Export CSV" button works (shows progress, then share sheet)
- [ ] "Export PDF" button works (shows progress, then share sheet)
- [ ] Share sheet presents correctly

### TC-6.6: Drill-Down Sheet (ReportTransactionsView)
- [ ] Title shows context (e.g., "Income Transactions", category name)
- [ ] Breadcrumb bar shows filter path
- [ ] Date filter toggleable with refresh
- [ ] Summary header: count + total amount
- [ ] Transaction rows: description, date, amount (correct color)
- [ ] Tapping transaction opens UnifiedTransactionForm (edit mode)
- [ ] "Close" toolbar button dismisses

### TC-6.7: Cross-Screen Data — Reports
- [ ] Total Income matches Dashboard "Income This Month" for same period
- [ ] Total Expense matches Dashboard "Expenses This Month" for same period
- [ ] Transaction count matches total approved transactions
- [ ] Category totals sum to overall totals
- [ ] Editing a transaction via drill-down → reports update on return

---

## SECTION 7: CASH FLOW

### TC-7.1: Cash Flow View
- [ ] 4 stat cards: Monthly Income, Monthly Expense, OD Interest, Monthly EMI
- [ ] Each card tappable — opens drill-down sheet
- [ ] Next Month Projection button shows correct month name
- [ ] CashFlowChartView: 24-month bar chart (Income green, Expense red)
- [ ] Chart horizontally scrollable
- [ ] RecurringListView embedded — shows recurring transactions
- [ ] Monthly Breakdown table: Month, Income, Expense, OD Int. columns
- [ ] Table horizontally scrollable
- [ ] Pull-to-refresh
- [ ] Error banner dismissible

### TC-7.2: Cash Flow Drill-Down
- [ ] Income drill-down: lists recurring income items, tapping opens edit form
- [ ] Expense drill-down: "Recurring Expenses" + "Mandates" sections
- [ ] Tapping mandate opens mandate detail sheet
- [ ] OD Interest drill-down: list of OD items, tapping opens detail
- [ ] EMI drill-down: list of EMI items + "Total Monthly EMI" summary
- [ ] Net Summary section: all categories listed with amounts
- [ ] "Done" button dismisses

### TC-7.3: Mandate Detail
- [ ] Header: merchant name and amount
- [ ] Info rows: Type, Frequency, Source, Mandate ID
- [ ] "View Source Document" button (email-sourced) loads content
- [ ] "View Latest Transaction" button finds and opens transaction
- [ ] "Edit Mandate" button opens edit sheet
- [ ] Edit sheet: Merchant, Amount, Frequency, Type, Status fields
- [ ] Save updates mandate
- [ ] "Delete Mandate" button with confirmation dialog

### TC-7.4: MandatesListView
- [ ] "Detect Mandates" button scans past transactions
- [ ] "Upcoming" section shows upcoming mandates
- [ ] "All Mandates" list shows all mandates
- [ ] Each mandate: merchant, frequency badge, status badge
- [ ] Inline-editable amount (tap to edit)
- [ ] Swipe: Delete, Pause/Resume

---

## SECTION 8: INVOICES

### TC-8.1: Invoice List
- [ ] Search bar searches by number or customer
- [ ] Toolbar "+" creates new invoice
- [ ] Stats section: Total Invoiced, Paid, Outstanding, Overdue (4 cards)
- [ ] Status filter chips: All, Paid, Partial, Unpaid, Overdue
- [ ] Invoice rows: number, customer, date, due date, total, amount paid, "Record Payment" button
- [ ] Due date red if overdue
- [ ] Trailing swipe: Delete (confirmation), Edit
- [ ] Leading swipe: Mark Paid (if not paid), Duplicate
- [ ] Tapping row navigates to InvoicePreviewView
- [ ] Debtors section (expandable): customer, invoice count, outstanding
- [ ] Aging section (expandable): bucket, count, amount
- [ ] Pull-to-refresh
- [ ] Empty state: "Create Invoice" button

### TC-8.2: Invoice Form
- [ ] Title: "New Invoice" or "Edit Invoice"
- [ ] Invoice # auto-generated for new
- [ ] Customer picker opens customer sheet with list
- [ ] Invoice Date and Due Date pickers
- [ ] Line items: Description, HSN/SAC, Qty, Rate, GST%, computed Amount
- [ ] Swipe-to-delete line items
- [ ] "Add Line Item" button works
- [ ] GST summary: Subtotal, CGST/SGST or IGST, Total Tax, Grand Total (auto-computed)
- [ ] Payment Terms and Notes fields
- [ ] Cancel dismisses
- [ ] Save validates (customer required, line items required)
- [ ] Validation errors shown

### TC-8.3: Invoice Preview
- [ ] PDF loads and displays in PDFKitView
- [ ] Toolbar Share button shares PDF
- [ ] Toolbar Print button prints (if available)
- [ ] Loading state: "Loading invoice PDF..."
- [ ] Error state: "Could not load PDF" + Retry button
- [ ] Fallback detail view: invoice info, line items, totals, notes
- [ ] Actions: Mark as Paid, Edit, Duplicate, Delete (with confirmation)

### TC-8.4: Record Payment
- [ ] Invoice summary: number, customer, total, paid, balance due
- [ ] Amount pre-filled with balance due
- [ ] Validation: amount > 0 and <= balance
- [ ] Date picker
- [ ] Method picker: Cash, Bank Transfer, UPI, Cheque, Card, Other
- [ ] Account picker (bank/cash account)
- [ ] Notes field
- [ ] Cancel/Save buttons

### TC-8.5: Cross-Screen Data — Invoices
- [ ] Creating invoice → stats update (Total Invoiced increases)
- [ ] Recording payment → Paid increases, Outstanding decreases
- [ ] Marking paid → status changes to Paid in list
- [ ] Customer's invoices appear in CustomerDetailView
- [ ] Invoice total matches customer's "Invoiced" amount in customer list

---

## SECTION 9: PURCHASES (BILLS)

### TC-9.1: Purchase List
- [ ] Search bar works
- [ ] Toolbar: Upload (doc icon) and "+" (create)
- [ ] Stats: Total Billed, Paid, Outstanding, Overdue
- [ ] Status filter chips
- [ ] Bill rows: number, vendor, total, status badge, date, due date
- [ ] Trailing swipe: Delete (confirmation), Edit
- [ ] Leading swipe: Mark Paid, Duplicate
- [ ] Tapping row opens PurchasePreviewView sheet
- [ ] Creditors section: vendor, count, outstanding, oldest date
- [ ] Aging Analysis section: bucket, amount, count
- [ ] Pull-to-refresh
- [ ] Empty state: "New Bill" and "Upload" buttons

### TC-9.2: Purchase Form
- [ ] Bill Number auto-generated
- [ ] Vendor picker or manual name
- [ ] Dates: Bill Date and Due Date (default +30 days)
- [ ] Line items: same structure as invoice form
- [ ] Totals: Subtotal, Tax, Grand Total
- [ ] Notes field
- [ ] Validation works
- [ ] Cancel/Save

### TC-9.3: Bill Upload & AI Parse
- [ ] PhotosPicker and file importer for PDF
- [ ] Uploading state with spinner
- [ ] Parsed result: vendor, bill number, date, due date, subtotal, tax, grand total, line items
- [ ] "Create Bill" saves parsed data
- [ ] "Upload Another" resets form

### TC-9.4: Bill PDF Preview
- [ ] PDF loads in viewer
- [ ] Share and Print toolbar buttons
- [ ] Retry on error

### TC-9.5: Record Bill Payment
- [ ] Same structure as invoice payment recording
- [ ] Bill summary, amount, date, method, account, notes
- [ ] Validation works

### TC-9.6: Cross-Screen Data — Purchases
- [ ] Bill total appears in vendor's "Billed" amount
- [ ] Payment recorded → vendor's "Paid" increases
- [ ] Vendor's bills appear in VendorDetailView

---

## SECTION 10: CATEGORIES

### TC-10.1: Category List
- [ ] Expense/Income segmented control
- [ ] Switching tab reloads correct category type
- [ ] Tree structure: parents with DisclosureGroup expand to show children
- [ ] Parent rows: folder icon, name, child count badge
- [ ] Child rows: tag icon, name
- [ ] Inline "+" button on parent adds subcategory
- [ ] "Add Subcategory" row at bottom of expanded parent
- [ ] Toolbar "+" creates new top-level category
- [ ] Swipe: Delete (destructive), Edit (yellow)
- [ ] Pull-to-refresh
- [ ] Empty state

### TC-10.2: Category Form
- [ ] Title dynamic: New Category / New Subcategory / Edit Category
- [ ] Name field
- [ ] Parent picker: None (top-level) + existing parents
- [ ] Type display (read-only)
- [ ] Cancel/Save

### TC-10.3: Cross-Screen Data — Categories
- [ ] Creating category → appears in Transaction form picker
- [ ] Creating category → appears in Reports category breakdown
- [ ] Deleting category → removed from all pickers
- [ ] Renaming category → reflected everywhere

---

## SECTION 11: CUSTOMERS

### TC-11.1: Customer List
- [ ] Search by name or email
- [ ] Toolbar "+" creates customer
- [ ] Each row: name, Invoiced/Paid/Due amounts
- [ ] Due highlighted red if > 0
- [ ] Tapping row navigates to CustomerDetailView
- [ ] Swipe-to-delete
- [ ] Pull-to-refresh
- [ ] Empty state

### TC-11.2: Customer Form
- [ ] Name (required, validation error shown)
- [ ] Email, Phone, GSTIN fields
- [ ] Billing Address, Shipping Address (multiline)
- [ ] Cancel/Save

### TC-11.3: Customer Detail
- [ ] Info card: Name, Email, Phone, GSTIN, Addresses
- [ ] Financial summary: Invoiced, Paid, Outstanding tiles
- [ ] Invoices list: number, date, total, status badge
- [ ] Edit button opens form sheet

### TC-11.4: Cross-Screen Data — Customers
- [ ] Customer appears in Invoice form customer picker
- [ ] Invoice totals match customer financial summary
- [ ] Deleting customer → removed from invoice form picker

---

## SECTION 12: VENDORS

### TC-12.1: Vendor List
- [ ] Search by name
- [ ] Toolbar "+" creates vendor
- [ ] Each row: name, Billed/Paid/Due pills
- [ ] Tapping row navigates to VendorDetailView
- [ ] Swipe-to-delete
- [ ] Pull-to-refresh
- [ ] Empty state

### TC-12.2: Vendor Form
- [ ] Name (required), Email, Phone, GSTIN, Address
- [ ] Cancel/Save

### TC-12.3: Vendor Detail
- [ ] Avatar circle, Name, GSTIN, Email, Phone, Address
- [ ] Financial summary: Total Billed, Total Paid, Outstanding
- [ ] Bills list: number, date, total, status badge
- [ ] Edit button opens form

### TC-12.4: Cross-Screen Data — Vendors
- [ ] Vendor appears in Purchase form vendor picker
- [ ] Bill totals match vendor financial summary

---

## SECTION 13: RECONCILIATION

### TC-13.1: Reconciliation List
- [ ] "Reconciliation" title (large)
- [ ] Toolbar "+" opens upload sheet
- [ ] Statement rows: filename, account name, period, entry count, status badge
- [ ] Progress bar shown when in progress
- [ ] Tapping row navigates to StatementDetailView
- [ ] Swipe-to-delete with confirmation dialog
- [ ] Pull-to-refresh
- [ ] Empty state: "Upload Statement" button

### TC-13.2: Statement Upload
- [ ] Sub-Type picker
- [ ] Account picker (filtered by sub-type)
- [ ] Period From/To date pickers
- [ ] File picker (PDF + CSV)
- [ ] Selected filename shown
- [ ] "Upload Statement" button (disabled when incomplete)
- [ ] Uploading state with spinner
- [ ] Error banner on failure
- [ ] Successful upload dismisses and adds to list

### TC-13.3: Statement Detail — Workflow
- [ ] 5-step stepper: Upload, Parse, Review, Reconcile, Done
- [ ] Correct step highlighted based on status
- [ ] Terminal banners: green "Approved" or red "Rejected"
- [ ] Header: icon, filename, account, status badge, period, entries, type, audit status

### TC-13.4: Statement Detail — Actions
- [ ] "Reconcile" button (when parsed/reconciled) triggers reconciliation
- [ ] "Bulk Categorize" button opens category picker sheet
- [ ] "Add All Missing" / "Add Selected" buttons (when reconciled + missing entries)
- [ ] "Re-audit" button re-runs audit
- [ ] "Unlock" button (password_required status) opens password sheet
- [ ] "Approve" button (green) with confirmation dialog
- [ ] "Reject" button (red) with confirmation dialog

### TC-13.5: Statement Detail — Results
- [ ] Reconciliation results card: Total Entries, Matched, Missing (Ledger), Missing (Statement), Conflicts
- [ ] Balance rows: opening, closing, computed closing, difference
- [ ] "Matched" DisclosureGroup: entry rows with score percentage
- [ ] "Missing from Ledger" section: checkboxes + select/deselect all
- [ ] "Missing from Statement" section: entry rows
- [ ] "Conflicts" section: statement vs ledger vs difference

### TC-13.6: Statement Detail — Parsed Entries
- [ ] All parsed entries listed
- [ ] Each entry: date, amount, description
- [ ] Category picker menu (hierarchical with subcategories)
- [ ] Matched indicator (checkmark)
- [ ] Category change updates via API

### TC-13.7: Cross-Screen Data — Reconciliation
- [ ] "Add Missing to Ledger" creates transactions in Transactions tab
- [ ] After approve: status reflected in statement list
- [ ] Matched transactions correspond to actual ledger transactions

---

## SECTION 14: EMAIL SYNC

### TC-14.1: Email Sync View
- [ ] Stats: Total Emails, Transactions, Pending Review, AI Failed
- [ ] Gmail section: connected accounts with status badges
- [ ] Per-account stats: Emails, Transactions, Review
- [ ] "Connect Gmail" button
- [ ] Per-account: Reconnect (if needed), Sync, Disconnect (confirmation)
- [ ] Outlook section: same structure
- [ ] "Start Email Sync" button
- [ ] "Retry Failed Emails" button (conditional)
- [ ] Pending Review NavigationLink to PendingReviewView
- [ ] Pull-to-refresh
- [ ] Error/success banners

### TC-14.2: Pending Review
- [ ] Toolbar: Select All/Deselect All menu
- [ ] Bulk actions: Approve All, Reject All
- [ ] Per-transaction cards: checkbox, description, date, amount, account, category, source, recurring badge
- [ ] Per-row: Approve, Reject, Edit (opens form), View Source (opens content)
- [ ] Edit form: description, amount, type, account picker (+create), category/subcategory pickers (+create)
- [ ] Source content sheet shows email/SMS details

### TC-14.3: Cross-Screen Data — Email Sync
- [ ] Pending review count matches Dashboard pending count
- [ ] Approving → transaction appears in Transactions tab
- [ ] Rejecting → removed from pending

---

## SECTION 15: SMS SYNC

### TC-15.1: SMS Sync View
- [ ] Intro section with explanation
- [ ] TextEditor for pasting SMS messages
- [ ] Message count badge
- [ ] "Upload & Parse" button (disabled when no text)
- [ ] Results: Stored, Duplicates, Processing counts
- [ ] Stats: Total Synced, Transactions, Pending Review, Failed
- [ ] "Retry Pending Messages" button
- [ ] "Detect Auto-Debit Mandates" button
- [ ] Error banner

---

## SECTION 16: RECORDS

### TC-16.1: Records — Emails Tab
- [ ] Tab selector: Emails / Receipts
- [ ] Search bar with debounced search
- [ ] Date Range filter (popover)
- [ ] Amount Range filter (popover)
- [ ] Download ZIP button
- [ ] Clearable filter indicators
- [ ] Email rows: source icon (Gmail red/Outlook blue), subject, sender, date, amount, attachment count
- [ ] Tapping row navigates to RecordPreviewView
- [ ] Swipe-to-delete with confirmation
- [ ] Infinite scroll
- [ ] Pull-to-refresh

### TC-16.2: Records — Receipts Tab
- [ ] Toolbar "+" for receipt upload
- [ ] Receipt rows: mime icon, filename, merchant, date, linked status, parsed amount
- [ ] Swipe: Delete (confirmation), Download
- [ ] Infinite scroll + pull-to-refresh
- [ ] Empty state: "Upload Receipt" button
- [ ] Upload sheet: PhotosPicker, image preview, parsed data, link to transaction, Upload & Parse

### TC-16.3: Record Preview (Email)
- [ ] Header: subject, sender, date, source badge, linked transaction indicator
- [ ] HTML body rendered or plain text fallback
- [ ] Attachments with download buttons
- [ ] Toolbar: Download EML, Delete (confirmation)

---

## SECTION 17: AI CHAT

### TC-17.1: AI Chat View
- [ ] Close button in toolbar
- [ ] Welcome section when empty: sparkles icon, title, description, suggestion chips
- [ ] Suggestion chips tappable (sends suggestion)
- [ ] Message list with chat bubbles
- [ ] Typing indicator when sending
- [ ] Input bar: mic button, text field, send button
- [ ] Send button enabled only when text not empty
- [ ] Voice mode toggle (waveform icon)
- [ ] Speaker toggle
- [ ] Clear History (menu) with confirmation dialog

### TC-17.2: Voice Mode
- [ ] Full-screen replacement with pulsing mic animation
- [ ] Status: "Speaking..." / "Listening..." / "Thinking..." / "Tap to speak"
- [ ] Live transcription preview
- [ ] Send, Mute/Unmute, Exit buttons
- [ ] Exit returns to text mode

---

## SECTION 18: SETTINGS

### TC-18.1: Settings View
- [ ] Business Profile NavigationLink (shows firm name or placeholder)
- [ ] Currency & Locale NavigationLink (shows base currency / date format)
- [ ] Business Logo: upload (PhotosPicker), preview (AsyncImage), replace, remove
- [ ] Signature: same pattern as logo
- [ ] "Sign Out" button works
- [ ] "Delete Account" button shows confirmation dialog
- [ ] Error alert

### TC-18.2: Business Profile
- [ ] Firm Name, GSTIN, PAN fields
- [ ] State Picker (Indian states/UTs)
- [ ] Country Picker
- [ ] Business Address (multiline)
- [ ] Keyboard "Done" button
- [ ] Save button (toolbar) with loading state
- [ ] "Saved" success alert

### TC-18.3: Currency Settings
- [ ] Currency picker with code, symbol, name
- [ ] Date Format picker with format and example
- [ ] Save button
- [ ] "Saved" success alert

---

## SECTION 19: BILLING

### TC-19.1: Billing View
- [ ] Current Plan header (if subscribed): plan name, renewal date, provider
- [ ] Plan cards: Monthly (₹199), Quarterly (₹449), Yearly (₹1499, Popular), Lifetime (₹4999, Best Value)
- [ ] "Subscribe" button on non-current plans
- [ ] "Active" badge on current plan
- [ ] Promo Code section: text field, Validate, result message, Activate
- [ ] Payment History: first 3 orders, "See All" NavigationLink
- [ ] Payment row: plan name, date, amount, status
- [ ] Cancel Subscription button (destructive) with confirmation
- [ ] Loading overlay, Error alert

### TC-19.2: Payment History (Full)
- [ ] All payment orders listed
- [ ] Status icon, plan name, date, provider, amount, status label

---

## SECTION 20: SUPPORT & FEATURE REQUESTS

### TC-20.1: Support View
- [ ] Header: headphones icon, "How can we help?"
- [ ] Subject text field
- [ ] Category menu picker
- [ ] Priority selector buttons
- [ ] Message text editor
- [ ] "Submit Ticket" button
- [ ] FAQ section: expandable/collapsible items
- [ ] Error alert
- [ ] "Ticket Submitted" success alert

### TC-20.2: Feature Requests
- [ ] Toolbar "+" opens request form
- [ ] Request rows: vote button (count), title, description (2 lines), category badge, status badge
- [ ] Vote button increments count
- [ ] Pull-to-refresh
- [ ] Empty state: "Submit a Request" button
- [ ] Form sheet: title, description, category

---

## SECTION 21: PAST INSIGHTS

### TC-21.1: Past Insights List
- [ ] Toolbar "+" starts create (loads available emails)
- [ ] Summary rows: name, status badge, date range, Income/Expense/Net pills
- [ ] Tapping row navigates to PastInsightDetailView
- [ ] Swipe-to-delete
- [ ] Pull-to-refresh
- [ ] Create form sheet: Name, From/To dates, Email Account picker, "Generate" button

### TC-21.2: Past Insight Detail
- [ ] Header: status badge, date range, email
- [ ] Stats: Total Income, Total Expense, Net, Transaction count
- [ ] "Export CSV" and "Download CSV" buttons
- [ ] Transaction list with swipe (Edit, Delete)
- [ ] Toolbar "+" adds transaction (form with description, amount, date, type, category)
- [ ] Share sheet for export

---

## SECTION 22: SUB-TYPE MANAGER & MISC

### TC-22.1: SubTypeManagerView
- [ ] Tab bar filters by account type
- [ ] Text field + "+" button creates sub-type
- [ ] Sub-type list with swipe: Edit, Delete
- [ ] Inline editing with checkmark/cancel

### TC-22.2: Recurring List (Cash Flow)
- [ ] Rows: icon, description, frequency badge, income/expense badge, amount
- [ ] Empty state prompt

### TC-22.3: CashFlowChartView
- [ ] 24-month bar chart visible
- [ ] Income (green) vs Expense (red) bars
- [ ] Legend visible
- [ ] Horizontally scrollable

---

## SECTION 23: CROSS-SCREEN DATA INTEGRITY (GLOBAL)

### TC-23.1: Account Balance Consistency
- [ ] Dashboard Net Worth = sum of all account balances (liabilities subtracted)
- [ ] Account detail balance matches account list balance
- [ ] After transaction create/delete → account balance updates

### TC-23.2: Transaction Count Consistency
- [ ] Reports transaction count matches actual approved transaction count
- [ ] Dashboard recent shows max 10 approved transactions
- [ ] Ledger view shows same transactions as list view

### TC-23.3: Category Consistency
- [ ] Categories in Reports match Categories page
- [ ] Category names in transaction list/detail match Categories page
- [ ] Subcategory totals sum to parent category total in Reports

### TC-23.4: Customer/Vendor Financial Consistency
- [ ] Customer "Invoiced" = sum of their invoice grand totals
- [ ] Customer "Paid" = sum of their invoice payments
- [ ] Customer "Due" = Invoiced - Paid
- [ ] Vendor "Billed" = sum of their bill totals
- [ ] Vendor "Paid" = sum of their bill payments

### TC-23.5: Cash Flow Consistency
- [ ] Cash Flow Monthly Income matches Reports income (for same period)
- [ ] Dashboard projection tile matches Cash Flow tile amounts
- [ ] Monthly Breakdown table values match chart values

### TC-23.6: Pending Review Consistency
- [ ] Dashboard pending count = Email Sync pending count = PendingReviewView count
- [ ] After approve/reject → all counts update consistently

---

## SECTION 24: ERROR HANDLING & EDGE CASES

### TC-24.1: Network Errors
- [ ] Error banner/alert shown on API failure (any screen)
- [ ] Error messages are human-readable (not raw JSON/status codes)
- [ ] Dismiss buttons work on all error banners
- [ ] Pull-to-refresh works after error

### TC-24.2: Empty States
- [ ] Every list view shows appropriate empty state when no data
- [ ] Empty state has actionable button (where applicable)
- [ ] Empty state icon and text appropriate for context

### TC-24.3: Loading States
- [ ] LoadingView shown during initial data fetch
- [ ] ProgressView shown during actions (save, delete, reconcile)
- [ ] Pull-to-refresh indicator works
- [ ] Buttons disabled during operations

### TC-24.4: Form Validation
- [ ] Transaction form: amount + account required
- [ ] Account form: name required
- [ ] Invoice form: customer + line items required
- [ ] Customer form: name required
- [ ] All validation errors shown visually

### TC-24.5: Delete Operations
- [ ] All deletes require confirmation dialog
- [ ] Confirmation has both Delete and Cancel options
- [ ] Cancel does NOT delete
- [ ] Successful delete removes item from list
- [ ] Deleted items don't appear in related views

---

**Total Test Cases: ~350+**
**Priority: Execute in order (Sections 1-8 are highest priority, 9-24 are comprehensive)**
