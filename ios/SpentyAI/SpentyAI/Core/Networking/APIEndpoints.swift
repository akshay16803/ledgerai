import Foundation

struct APIEndpoints {
    // MARK: - Auth
    static let authGoogleMobile = "/api/auth/google/mobile"
    static let authMe = "/api/auth/me"
    static let authLogout = "/api/auth/logout"
    static let authDeleteAccount = "/api/auth/delete-account"
    static let authDevSimulatorLogin = "/api/auth/dev/simulator-login"

    // MARK: - Accounts
    static let accounts = "/api/accounts"
    static func account(_ id: String) -> String { "/api/accounts/\(id)" }
    static func accountRecalculate(_ id: String) -> String { "/api/accounts/\(id)/recalculate" }
    static func accountAmortization(_ id: String) -> String { "/api/accounts/\(id)/amortization" }
    static func accountBalance(_ id: String) -> String { "/api/accounts/\(id)/balance" }
    static func accountTransactions(_ id: String) -> String { "/api/accounts/\(id)/transactions" }
    static func accountODInterest(_ id: String) -> String { "/api/accounts/\(id)/od-interest" }
    static let accountSubTypes = "/api/account-sub-types"
    static func accountSubType(_ id: String) -> String { "/api/account-sub-types/\(id)" }

    // MARK: - Categories
    static let categories = "/api/categories"
    static func category(_ id: String) -> String { "/api/categories/\(id)" }
    static let categoriesDefaults = "/api/categories/defaults"
    static let categoriesMerge = "/api/categories/merge"

    // MARK: - Transactions
    static let transactions = "/api/transactions"
    static func transaction(_ id: String) -> String { "/api/transactions/\(id)" }
    static func transactionApprove(_ id: String) -> String { "/api/transactions/\(id)/approve" }
    static func transactionReject(_ id: String) -> String { "/api/transactions/\(id)/reject" }
    static let transactionsBulkApprove = "/api/transactions/bulk-approve"
    static let transactionsBulkReject = "/api/transactions/bulk-reject"
    static let transactionsBulkDelete = "/api/transactions/bulk-delete"
    static let transactionsBulkUpdate = "/api/transactions/bulk-update"
    static let transactionsPending = "/api/transactions/pending"
    static let transactionsSearch = "/api/transactions/search"
    static func transactionToggleRecurring(_ id: String) -> String { "/api/transactions/\(id)/toggle-recurring" }

    // MARK: - Dashboard
    static let dashboardSummary = "/api/dashboard/summary"

    // MARK: - AI Chat
    static let aiChat = "/api/ai/chat"
    static let aiChatHistory = "/api/ai/chat/history"
    static let aiChatClear = "/api/ai/chat/history/clear"
    static let aiChatSuggestions = "/api/ai/chat/suggestions"

    // MARK: - Payments / Billing
    static let paymentsPlans = "/api/payments/plans"
    static let paymentsStatus = "/api/payments/status"
    static let paymentsAppleVerify = "/api/payments/apple/verify"
    static let paymentsHistory = "/api/payments/history"
    static let paymentsCancel = "/api/payments/cancel"
    static let promoValidate = "/api/promo/validate"
    static let promoActivate = "/api/promo/activate"

    // MARK: - Cash Flow
    static let cashflowProjection = "/api/cashflow/projection"
    static let cashflowHistory = "/api/cashflow/history"
    static let mandates = "/api/mandates"
    static func mandate(_ id: String) -> String { "/api/mandates/\(id)" }
    static let mandatesDetect = "/api/mandates/detect"
    static let mandatesUpcoming = "/api/mandates/upcoming"
    static let recurringList = "/api/recurring/list"

    // MARK: - Reports
    static let reportsSummary = "/api/reports/summary"
    static let reportsByPeriod = "/api/reports/by-period"
    static let reportsByCategory = "/api/reports/by-category"
    static let reportsAccount = "/api/reports/account"
    static let reportsIncomeExpense = "/api/reports/income-expense"
    static let reportsExportCSV = "/api/reports/export/csv"
    static let reportsExportPDF = "/api/reports/export/pdf"

    // MARK: - Reconciliation / Statements
    static let statementsUpload = "/api/statements/upload"
    static let statementsList = "/api/statements/list"
    static func statement(_ id: String) -> String { "/api/statements/\(id)" }
    static func statementReconcile(_ id: String) -> String { "/api/statements/\(id)/reconcile" }
    static func statementAddMissing(_ id: String) -> String { "/api/statements/\(id)/add-missing" }
    static func statementReaudit(_ id: String) -> String { "/api/statements/\(id)/reaudit" }
    static func statementApprove(_ id: String) -> String { "/api/statements/\(id)/approve" }
    static func statementReject(_ id: String) -> String { "/api/statements/\(id)/reject" }
    static func statementEntries(_ id: String) -> String { "/api/statements/\(id)/entries" }
    static func statementBulkCategorize(_ id: String) -> String { "/api/statements/\(id)/bulk-categorize" }
    static func statementEntryUpdate(_ id: String, _ index: Int) -> String { "/api/statements/\(id)/entries/\(index)" }
    static func statementUnlock(_ id: String) -> String { "/api/statements/\(id)/unlock" }

    // MARK: - Email Sync
    static let gmailConnect = "/api/gmail/connect?platform=ios"
    static let gmailStatus = "/api/gmail/status"
    static let gmailDisconnect = "/api/gmail/disconnect"
    static let outlookConnect = "/api/outlook/connect?platform=ios"
    static let outlookStatus = "/api/outlook/status"
    static let outlookDisconnect = "/api/outlook/disconnect"
    static let outlookStartSync = "/api/outlook/start-sync"
    static let outlookRetryPending = "/api/outlook/retry-pending"
    static let emailStartSync = "/api/email/start-sync"
    static let emailRetryPending = "/api/email/retry-pending"
    static let emailSyncStats = "/api/email/sync-stats"
    static let emailPendingReview = "/api/email/pending-review"
    static func sourceContent(_ id: String) -> String { "/api/source/\(id)" }

    // MARK: - SMS
    static let smsUpload = "/api/sms/upload"
    static let smsStats = "/api/sms/stats"
    static let smsRetryPending = "/api/sms/retry-pending"
    static let smsParse = "/api/sms/parse"
    static let smsBulkParse = "/api/sms/bulk-parse"
    static let smsDetectMandates = "/api/sms/detect-mandates"

    // MARK: - Records
    static let records = "/api/records"
    static let recordsSearch = "/api/records/search"
    static func record(_ id: String) -> String { "/api/records/\(id)" }
    static func recordPreview(_ id: String) -> String { "/api/records/\(id)/preview" }
    static func recordDownloadEml(_ id: String) -> String { "/api/records/\(id)/download-eml" }
    static func recordAttachment(_ id: String, _ index: Int) -> String { "/api/records/\(id)/attachments/\(index)/download" }
    static let recordsDownloadZip = "/api/records/download-zip"

    // MARK: - Receipts
    static let receiptsUpload = "/api/receipts/upload"
    static let receipts = "/api/receipts"
    static func receipt(_ id: String) -> String { "/api/receipts/\(id)" }
    static func receiptParse(_ id: String) -> String { "/api/receipts/\(id)/parse" }
    static func receiptDownload(_ id: String) -> String { "/api/receipts/\(id)/download" }
    static func receiptsByTransaction(_ id: String) -> String { "/api/receipts/by-transaction/\(id)" }
    static func receiptLink(_ id: String) -> String { "/api/receipts/\(id)/link" }
    static let billsParseUpload = "/api/bills/parse-upload"

    // MARK: - Past Insights / Tax Summary
    static let taxSummary = "/api/tax-summary"
    static let taxSummaryAvailableEmails = "/api/tax-summary/available-emails"
    static let taxSummaryGenerate = "/api/tax-summary/generate"
    static func taxSummaryDetail(_ id: String) -> String { "/api/tax-summary/\(id)" }
    static func taxSummaryTransactions(_ id: String) -> String { "/api/tax-summary/\(id)/transactions" }
    static func taxSummaryTransaction(_ id: String, _ txnId: String) -> String { "/api/tax-summary/\(id)/transactions/\(txnId)" }
    static func taxSummaryExport(_ id: String) -> String { "/api/tax-summary/\(id)/export" }
    static func taxSummaryDownload(_ id: String) -> String { "/api/tax-summary/\(id)/download" }

    // MARK: - Invoices
    static let invoices = "/api/invoices"
    static let invoicesNextNumber = "/api/invoices/next-number"
    static let invoicesStats = "/api/invoices/stats"
    static let invoicesCount = "/api/invoices/count"
    static let invoicesDebtors = "/api/invoices/debtors"
    static let invoicesAging = "/api/invoices/aging"
    static let invoicesSalesByCustomer = "/api/invoices/sales-by-customer"
    static func invoice(_ id: String) -> String { "/api/invoices/\(id)" }
    static func invoicePDF(_ id: String) -> String { "/api/invoices/\(id)/pdf" }
    static func invoiceRecordPayment(_ id: String) -> String { "/api/invoices/\(id)/record-payment" }
    static func invoiceMarkPaid(_ id: String) -> String { "/api/invoices/\(id)/mark-paid" }
    static func invoiceDuplicate(_ id: String) -> String { "/api/invoices/\(id)/duplicate" }

    // MARK: - Customers
    static let customers = "/api/customers"
    static func customer(_ id: String) -> String { "/api/customers/\(id)" }
    static func customerInvoices(_ id: String) -> String { "/api/customers/\(id)/invoices" }

    // MARK: - Bills (Purchases)
    static let bills = "/api/bills"
    static let billsNextNumber = "/api/bills/next-number"
    static let billsStats = "/api/bills/stats"
    static let billsCount = "/api/bills/count"
    static let billsCreditors = "/api/bills/creditors"
    static let billsAging = "/api/bills/aging"
    static let billsPurchasesByVendor = "/api/bills/purchases-by-vendor"
    static func bill(_ id: String) -> String { "/api/bills/\(id)" }
    static func billPDF(_ id: String) -> String { "/api/bills/\(id)/pdf" }
    static func billRecordPayment(_ id: String) -> String { "/api/bills/\(id)/record-payment" }
    static func billMarkPaid(_ id: String) -> String { "/api/bills/\(id)/mark-paid" }
    static func billDuplicate(_ id: String) -> String { "/api/bills/\(id)/duplicate" }

    // MARK: - Vendors
    static let vendors = "/api/vendors"
    static func vendor(_ id: String) -> String { "/api/vendors/\(id)" }
    static func vendorBills(_ id: String) -> String { "/api/vendors/\(id)/bills" }

    // MARK: - Feature Requests
    static let featureRequests = "/api/feature-requests"
    static func featureRequest(_ id: String) -> String { "/api/feature-requests/\(id)" }
    static func featureRequestVote(_ id: String) -> String { "/api/feature-requests/\(id)/vote" }

    // MARK: - Support
    static let supportTicket = "/api/support/ticket"
    static let supportFaq = "/api/support/faq"

    // MARK: - Settings
    static let settings = "/api/settings"
    static let settingsCurrencies = "/api/settings/currencies"
    static let settingsDateFormats = "/api/settings/date-formats"
    static let settingsLogo = "/api/settings/logo"
    static let settingsSignature = "/api/settings/signature"

    // MARK: - Demat
    static let dematUpload = "/api/demat/upload-statement"
    static let dematManualEntry = "/api/demat/manual-entry"
    static func dematStatements(_ accountId: String) -> String { "/api/demat/statements/\(accountId)" }
    static func dematApprove(_ id: String) -> String { "/api/demat/approve-statement/\(id)" }
    static func dematReject(_ id: String) -> String { "/api/demat/reject-statement/\(id)" }
}
