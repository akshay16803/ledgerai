import Foundation

enum APIEndpoints {

    // MARK: - Auth
    enum Auth {
        static let me = "/api/auth/me"
        static let logout = "/api/auth/logout"
        static let googleMobile = "/api/auth/google/mobile"
        static let deleteAccount = "/api/auth/delete-account"
    }

    // MARK: - Accounts
    enum Accounts {
        static let list = "/api/accounts"
        static let create = "/api/accounts"
        static func account(_ id: String) -> String { "/api/accounts/\(id)" }
        static func update(_ id: String) -> String { "/api/accounts/\(id)" }
        static func delete(_ id: String) -> String { "/api/accounts/\(id)" }
        static func balance(_ id: String) -> String { "/api/accounts/\(id)/balance" }
        static func transactions(_ id: String) -> String { "/api/accounts/\(id)/transactions" }
        static func recalculate(_ id: String) -> String { "/api/accounts/\(id)/recalculate" }
        static func amortization(_ id: String) -> String { "/api/accounts/\(id)/amortization" }
        static func odInterest(_ id: String) -> String { "/api/accounts/\(id)/od-interest" }
    }

    // MARK: - Account Sub Types
    enum AccountSubTypes {
        static let list = "/api/account-sub-types"
        static func forType(_ type: String) -> String { "/api/account-sub-types/\(type)" }
    }

    // MARK: - Transactions
    enum Transactions {
        static let list = "/api/transactions"
        static let create = "/api/transactions"
        static func transaction(_ id: String) -> String { "/api/transactions/\(id)" }
        static func update(_ id: String) -> String { "/api/transactions/\(id)" }
        static func delete(_ id: String) -> String { "/api/transactions/\(id)" }
        static let bulkApprove = "/api/transactions/bulk-approve"
        static let bulkReject = "/api/transactions/bulk-reject"
        static let bulkDelete = "/api/transactions/bulk-delete"
        static let bulkUpdate = "/api/transactions/bulk-update"
        static let pending = "/api/transactions/pending"
        static let search = "/api/transactions/search"
        static func approve(_ id: String) -> String { "/api/transactions/\(id)/approve" }
        static func reject(_ id: String) -> String { "/api/transactions/\(id)/reject" }
    }

    // MARK: - Categories
    enum Categories {
        static let list = "/api/categories"
        static let create = "/api/categories"
        static func category(_ id: String) -> String { "/api/categories/\(id)" }
        static func update(_ id: String) -> String { "/api/categories/\(id)" }
        static func delete(_ id: String) -> String { "/api/categories/\(id)" }
        static let defaults = "/api/categories/defaults"
        static let merge = "/api/categories/merge"
    }

    // MARK: - Dashboard
    enum Dashboard {
        static let summary = "/api/dashboard/summary"
        static let trends = "/api/dashboard/trends"
        static let monthlyComparison = "/api/dashboard/monthly-comparison"
    }

    // MARK: - Reports
    enum Reports {
        static let summary = "/api/reports/summary"
        static let periodReport = "/api/reports/period"
        static let categoryReport = "/api/reports/category"
        static let accountReport = "/api/reports/account"
        static let incomeExpense = "/api/reports/income-expense"
        static let exportCSV = "/api/reports/export/csv"
        static let exportPDF = "/api/reports/export/pdf"
    }

    // MARK: - Cash Flow
    enum CashFlow {
        static let projection = "/api/cashflow/projection"
        static let recurring = "/api/cashflow/recurring"
        static let history = "/api/cashflow/history"
    }

    // MARK: - Mandates
    enum Mandates {
        static let list = "/api/mandates"
        static let create = "/api/mandates"
        static func mandate(_ id: String) -> String { "/api/mandates/\(id)" }
        static func update(_ id: String) -> String { "/api/mandates/\(id)" }
        static func delete(_ id: String) -> String { "/api/mandates/\(id)" }
        static let detect = "/api/mandates/detect"
        static let upcoming = "/api/mandates/upcoming"
    }

    // MARK: - Reconciliation (Statements)
    enum Reconciliation {
        static let statements = "/api/reconciliation/statements"
        static let upload = "/api/reconciliation/upload"
        static func statement(_ id: String) -> String { "/api/reconciliation/statements/\(id)" }
        static func delete(_ id: String) -> String { "/api/reconciliation/statements/\(id)" }
        static func entries(_ id: String) -> String { "/api/reconciliation/statements/\(id)/entries" }
        static func approve(_ id: String) -> String { "/api/reconciliation/statements/\(id)/approve" }
        static func reject(_ id: String) -> String { "/api/reconciliation/statements/\(id)/reject" }
        static func reconcile(_ id: String) -> String { "/api/reconciliation/statements/\(id)/reconcile" }
        static func password(_ id: String) -> String { "/api/reconciliation/statements/\(id)/password" }
        static func updateEntry(_ statementId: String, entryIndex: Int) -> String {
            "/api/reconciliation/statements/\(statementId)/entries/\(entryIndex)"
        }
        static func bulkCategorize(_ id: String) -> String { "/api/reconciliation/statements/\(id)/bulk-categorize" }
    }

    // MARK: - Email Sync — Gmail
    enum Gmail {
        static let authURL = "/api/email-sync/gmail/auth-url"
        static let callback = "/api/email-sync/gmail/callback"
        static let status = "/api/email-sync/gmail/status"
        static let sync = "/api/email-sync/gmail/sync"
        static let disconnect = "/api/email-sync/gmail/disconnect"
        static let records = "/api/email-sync/gmail/records"
    }

    // MARK: - Email Sync — Outlook
    enum Outlook {
        static let authURL = "/api/email-sync/outlook/auth-url"
        static let callback = "/api/email-sync/outlook/callback"
        static let status = "/api/email-sync/outlook/status"
        static let sync = "/api/email-sync/outlook/sync"
        static let disconnect = "/api/email-sync/outlook/disconnect"
        static let records = "/api/email-sync/outlook/records"
    }

    // MARK: - SMS
    enum SMS {
        static let parse = "/api/sms/parse"
        static let bulkParse = "/api/sms/bulk-parse"
        static let detectMandates = "/api/sms/detect-mandates"
    }

    // MARK: - Records (Archive)
    enum Records {
        static let list = "/api/records"
        static func record(_ id: String) -> String { "/api/records/\(id)" }
        static func delete(_ id: String) -> String { "/api/records/\(id)" }
        static let search = "/api/records/search"
    }

    // MARK: - Receipts
    enum Receipts {
        static let list = "/api/receipts"
        static let upload = "/api/receipts/upload"
        static func receipt(_ id: String) -> String { "/api/receipts/\(id)" }
        static func delete(_ id: String) -> String { "/api/receipts/\(id)" }
        static func download(_ id: String) -> String { "/api/receipts/\(id)/download" }
        static func parse(_ id: String) -> String { "/api/receipts/\(id)/parse" }
        static func linkTransaction(_ id: String) -> String { "/api/receipts/\(id)/link" }
        static func byTransaction(_ transactionId: String) -> String { "/api/receipts/by-transaction/\(transactionId)" }
    }

    // MARK: - Invoices
    enum Invoices {
        static let list = "/api/invoices"
        static let create = "/api/invoices"
        static func invoice(_ id: String) -> String { "/api/invoices/\(id)" }
        static func update(_ id: String) -> String { "/api/invoices/\(id)" }
        static func delete(_ id: String) -> String { "/api/invoices/\(id)" }
        static func pdf(_ id: String) -> String { "/api/invoices/\(id)/pdf" }
        static func markPaid(_ id: String) -> String { "/api/invoices/\(id)/mark-paid" }
        static func recordPayment(_ id: String) -> String { "/api/invoices/\(id)/record-payment" }
        static func duplicate(_ id: String) -> String { "/api/invoices/\(id)/duplicate" }
        static let nextNumber = "/api/invoices/next-number"
        static let stats = "/api/invoices/stats"
        static let count = "/api/invoices/count"
        static let debtors = "/api/invoices/debtors"
        static let aging = "/api/invoices/aging"
        static let salesByCustomer = "/api/invoices/sales-by-customer"
    }

    // MARK: - Customers
    enum Customers {
        static let list = "/api/customers"
        static let create = "/api/customers"
        static func customer(_ id: String) -> String { "/api/customers/\(id)" }
        static func update(_ id: String) -> String { "/api/customers/\(id)" }
        static func delete(_ id: String) -> String { "/api/customers/\(id)" }
        static func invoices(_ id: String) -> String { "/api/customers/\(id)/invoices" }
    }

    // MARK: - Bills
    enum Bills {
        static let list = "/api/bills"
        static let create = "/api/bills"
        static func bill(_ id: String) -> String { "/api/bills/\(id)" }
        static func update(_ id: String) -> String { "/api/bills/\(id)" }
        static func delete(_ id: String) -> String { "/api/bills/\(id)" }
        static func pdf(_ id: String) -> String { "/api/bills/\(id)/pdf" }
        static func markPaid(_ id: String) -> String { "/api/bills/\(id)/mark-paid" }
        static func recordPayment(_ id: String) -> String { "/api/bills/\(id)/record-payment" }
        static func duplicate(_ id: String) -> String { "/api/bills/\(id)/duplicate" }
        static let nextNumber = "/api/bills/next-number"
        static let stats = "/api/bills/stats"
        static let count = "/api/bills/count"
        static let creditors = "/api/bills/creditors"
        static let aging = "/api/bills/aging"
        static let purchasesByVendor = "/api/bills/purchases-by-vendor"
        static let parseUpload = "/api/bills/parse-upload"
    }

    // MARK: - Vendors
    enum Vendors {
        static let list = "/api/vendors"
        static let create = "/api/vendors"
        static func vendor(_ id: String) -> String { "/api/vendors/\(id)" }
        static func update(_ id: String) -> String { "/api/vendors/\(id)" }
        static func delete(_ id: String) -> String { "/api/vendors/\(id)" }
        static func bills(_ id: String) -> String { "/api/vendors/\(id)/bills" }
    }

    // MARK: - Tax Summary
    enum TaxSummary {
        static let list = "/api/tax-summary"
        static let create = "/api/tax-summary"
        static func summary(_ id: String) -> String { "/api/tax-summary/\(id)" }
        static func delete(_ id: String) -> String { "/api/tax-summary/\(id)" }
        static func download(_ id: String) -> String { "/api/tax-summary/\(id)/download" }
        static let generate = "/api/tax-summary/generate"
    }

    // MARK: - Demat
    enum Demat {
        static let statements = "/api/demat/statements"
        static let upload = "/api/demat/upload"
        static func statement(_ id: String) -> String { "/api/demat/statements/\(id)" }
        static func delete(_ id: String) -> String { "/api/demat/statements/\(id)" }
        static func entries(_ id: String) -> String { "/api/demat/statements/\(id)/entries" }
        static let summary = "/api/demat/summary"
    }

    // MARK: - AI Chat
    enum AIChat {
        static let send = "/api/ai/chat"
        static let history = "/api/ai/chat/history"
        static let clearHistory = "/api/ai/chat/history/clear"
        static let suggestions = "/api/ai/chat/suggestions"
    }

    // MARK: - Settings
    enum Settings {
        static let get = "/api/settings"
        static let update = "/api/settings"
        static let currencies = "/api/settings/currencies"
        static let dateFormats = "/api/settings/date-formats"
        static let logo = "/api/settings/logo"
        static let deleteLogo = "/api/settings/logo"
        static let signature = "/api/settings/signature"
        static let deleteSignature = "/api/settings/signature"
    }

    // MARK: - Payments (Apple IAP)
    enum Payments {
        static let plans = "/api/payments/plans"
        static let appleVerify = "/api/payments/apple/verify"
        static let appleWebhook = "/api/payments/apple/webhook"
        static let status = "/api/payments/status"
        static let cancel = "/api/payments/cancel"
        static let history = "/api/payments/history"
    }

    // MARK: - Promo
    enum Promo {
        static let apply = "/api/promo/apply"
        static let validate = "/api/promo/validate"
    }

    // MARK: - Feature Requests
    enum FeatureRequests {
        static let list = "/api/feature-requests"
        static let create = "/api/feature-requests"
        static func featureRequest(_ id: String) -> String { "/api/feature-requests/\(id)" }
        static func vote(_ id: String) -> String { "/api/feature-requests/\(id)/vote" }
    }

    // MARK: - Support
    enum Support {
        static let create = "/api/support/tickets"
        static let list = "/api/support/tickets"
        static func ticket(_ id: String) -> String { "/api/support/tickets/\(id)" }
        static let faq = "/api/support/faq"
    }
}
