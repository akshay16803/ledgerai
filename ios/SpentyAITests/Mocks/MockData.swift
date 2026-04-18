import Foundation
@testable import SpentyAI

// MARK: - Mock Data Factory

/// Provides factory methods for creating test instances of all domain models.
/// All parameters have sensible defaults, making it easy to create minimal fixtures
/// or override specific fields for targeted test scenarios.
enum MockData {

    // MARK: - User

    static func mockUser(
        id: String = "user-001",
        email: String = "test@spentyai.com",
        name: String? = "Test User",
        picture: String? = nil,
        emailVerified: Bool? = true,
        subscriptionPlan: String? = "pro",
        subscriptionStatus: String? = "active",
        subscriptionExpiry: String? = "2027-01-01"
    ) -> User {
        User(
            id: id,
            email: email,
            name: name,
            picture: picture,
            emailVerified: emailVerified,
            subscriptionPlan: subscriptionPlan,
            subscriptionStatus: subscriptionStatus,
            subscriptionExpiry: subscriptionExpiry,
            settings: UserSettings(baseCurrency: "INR", dateFormat: "dd/MM/yyyy")
        )
    }

    // MARK: - Account

    static func mockAccount(
        id: String = "acc-001",
        name: String = "Test Savings Account",
        type: String = "Asset",
        balance: Double = 50000.0,
        subType: String? = "Savings",
        currency: String? = "INR",
        userId: String? = "user-001",
        openingBalance: Double? = 10000.0
    ) -> Account {
        Account(
            accountId: id,
            userId: userId,
            name: name,
            accountType: type,
            subType: subType,
            accountNumber: nil,
            openingBalance: openingBalance,
            currentBalance: balance,
            balanceAsOfDate: nil,
            currency: currency,
            description: nil,
            loanSanctionedAmount: nil,
            loanInterestRate: nil,
            loanTenureMonths: nil,
            loanEmiAmount: nil,
            loanEmiDay: nil,
            loanStartDate: nil,
            loanOutstandingBalance: nil,
            brokerName: nil,
            createdAt: "2025-01-01T00:00:00Z"
        )
    }

    // MARK: - Transaction

    static func mockTransaction(
        id: String = "txn-001",
        amount: Double = 1500.0,
        type: TransactionType = .expense,
        date: String = "2026-04-18",
        status: TransactionStatus? = .approved,
        description: String? = "Test transaction",
        accountId: String? = "acc-001",
        categoryId: String? = "cat-001",
        categoryName: String? = "Food",
        accountName: String? = "Test Savings Account"
    ) -> Transaction {
        Transaction(
            transactionId: id,
            userId: "user-001",
            transactionType: type,
            amount: amount,
            date: date,
            accountId: accountId,
            toAccountId: nil,
            categoryId: categoryId,
            subcategoryId: nil,
            description: description,
            paymentMethod: "UPI",
            isRecurring: false,
            recurringFrequency: nil,
            source: "manual",
            status: status,
            receiptId: nil,
            createdAt: "2026-04-18T10:00:00Z",
            accountName: accountName,
            categoryName: categoryName
        )
    }

    // MARK: - Invoice

    static func mockInvoice(
        id: String = "inv-001",
        status: String? = "unpaid",
        amount: Double = 25000.0,
        invoiceNumber: String? = "INV-2026-001",
        customerName: String? = "Acme Corp",
        invoiceDate: String? = "2026-04-01",
        dueDate: String? = "2026-04-30"
    ) -> Invoice {
        Invoice(
            invoiceId: id,
            userId: "user-001",
            invoiceNumber: invoiceNumber,
            invoiceType: "tax_invoice",
            invoiceDate: invoiceDate,
            dueDate: dueDate,
            customerId: "cust-001",
            customerName: customerName,
            customerGstin: nil,
            customerAddress: nil,
            customerState: nil,
            placeOfSupply: nil,
            lineItems: [
                LineItem(
                    description: "Consulting Services",
                    quantity: 10,
                    rate: 2500,
                    discountPercent: nil,
                    gstRate: nil,
                    hsnSac: nil,
                    amount: amount,
                    taxAmount: nil
                )
            ],
            subtotal: amount,
            taxTotal: 0,
            grandTotal: amount,
            paymentStatus: status,
            amountPaid: status == "paid" ? amount : 0,
            paymentAccountId: nil,
            paymentMethod: nil,
            paymentDate: nil,
            poNumber: nil,
            notes: nil,
            termsConditions: nil,
            createdAt: "2026-04-01T00:00:00Z"
        )
    }

    // MARK: - Bill

    static func mockBill(
        id: String = "bill-001",
        status: String? = "unpaid",
        amount: Double = 15000.0,
        billNumber: String? = "BILL-2026-001",
        vendorName: String? = "Office Supplies Co"
    ) -> Bill {
        Bill(
            billId: id,
            userId: "user-001",
            billNumber: billNumber,
            billType: "purchase_bill",
            billDate: "2026-04-05",
            dueDate: "2026-05-05",
            vendorId: "vnd-001",
            vendorName: vendorName,
            vendorGstin: nil,
            vendorAddress: nil,
            vendorState: nil,
            placeOfSupply: nil,
            lineItems: nil,
            subtotal: amount,
            taxTotal: 0,
            grandTotal: amount,
            paymentStatus: status,
            amountPaid: status == "paid" ? amount : 0,
            paymentAccountId: nil,
            paymentMethod: nil,
            paymentDate: nil,
            poNumber: nil,
            notes: nil,
            termsConditions: nil,
            createdAt: "2026-04-05T00:00:00Z"
        )
    }

    // MARK: - Customer

    static func mockCustomer(
        id: String = "cust-001",
        name: String = "Acme Corp"
    ) -> Customer {
        Customer(
            customerId: id,
            name: name,
            gstin: nil,
            pan: nil,
            phone: "9876543210",
            email: "contact@acme.com",
            billingAddress: "123 Business St",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
            notes: nil,
            createdAt: "2025-06-01T00:00:00Z"
        )
    }

    // MARK: - Vendor

    static func mockVendor(
        id: String = "vnd-001",
        name: String = "Office Supplies Co"
    ) -> Vendor {
        Vendor(
            vendorId: id,
            name: name,
            gstin: nil,
            pan: nil,
            phone: "9123456789",
            email: "info@officesupplies.com",
            billingAddress: "456 Vendor Lane",
            city: "Delhi",
            state: "Delhi",
            pincode: "110001",
            notes: nil,
            createdAt: "2025-03-15T00:00:00Z"
        )
    }

    // MARK: - Category

    static func mockCategory(
        id: String = "cat-001",
        name: String = "Food & Dining",
        type: CategoryType = .expense,
        parentId: String? = nil
    ) -> Category {
        Category(
            categoryId: id,
            userId: "user-001",
            name: name,
            categoryType: type,
            parentId: parentId,
            createdAt: "2025-01-01T00:00:00Z"
        )
    }

    // MARK: - DashboardSummary

    static func mockDashboardSummary(
        totalAssets: Double? = 500000.0,
        totalLiabilities: Double? = 100000.0,
        netWorth: Double? = 400000.0,
        incomeThisMonth: Double? = 75000.0,
        expenseThisMonth: Double? = 45000.0,
        savingsThisMonth: Double? = 30000.0,
        pendingReview: Int? = 3
    ) -> DashboardSummary {
        DashboardSummary(
            totalAssets: totalAssets,
            totalLiabilities: totalLiabilities,
            netWorth: netWorth,
            incomeThisMonth: incomeThisMonth,
            expenseThisMonth: expenseThisMonth,
            savingsThisMonth: savingsThisMonth,
            pendingReview: pendingReview,
            accounts: [
                mockAccount(id: "acc-001", name: "Savings", type: "Asset", balance: 300000),
                mockAccount(id: "acc-002", name: "Credit Card", type: "Liability", balance: -50000)
            ],
            recentTransactions: [
                mockTransaction(id: "txn-001", amount: 1500, type: .expense),
                mockTransaction(id: "txn-002", amount: 75000, type: .income)
            ]
        )
    }

    // MARK: - ReportSummary

    static func mockReportSummary(
        totalIncome: Double? = 75000.0,
        totalExpense: Double? = 45000.0,
        totalTransfers: Double? = 5000.0,
        net: Double? = 30000.0,
        transactionCount: Int? = 42
    ) -> ReportSummary {
        ReportSummary(
            totalIncome: totalIncome,
            totalExpense: totalExpense,
            totalTransfers: totalTransfers,
            net: net,
            transactionCount: transactionCount
        )
    }

    // MARK: - CashFlowProjection

    static func mockCashFlowProjection(
        currentBalance: Double? = 250000.0,
        monthlyIncome: Double? = 75000.0,
        monthlyExpense: Double? = 45000.0,
        monthlyNet: Double? = 30000.0
    ) -> CashFlowProjection {
        CashFlowProjection(
            currentBalance: currentBalance,
            monthlyIncome: monthlyIncome,
            monthlyExpense: monthlyExpense,
            monthlyNet: monthlyNet,
            recurringItems: [],
            mandateItems: [],
            odInterestItems: [],
            projection: [
                CashFlowProjectionEntry(
                    month: "2026-05",
                    label: "May 2026",
                    projectedIncome: 75000,
                    projectedExpense: 45000,
                    projectedNet: 30000,
                    projectedBalance: 280000
                ),
                CashFlowProjectionEntry(
                    month: "2026-06",
                    label: "Jun 2026",
                    projectedIncome: 75000,
                    projectedExpense: 45000,
                    projectedNet: 30000,
                    projectedBalance: 310000
                )
            ]
        )
    }

    // MARK: - Statement

    static func mockStatement(
        id: String = "stmt-001",
        status: StatementStatus? = .ready,
        filename: String? = "bank_statement_april.pdf",
        accountId: String? = "acc-001"
    ) -> Statement {
        Statement(
            statementId: id,
            userId: "user-001",
            accountId: accountId,
            filename: filename,
            statementType: "bank",
            periodFrom: "2026-04-01",
            periodTo: "2026-04-30",
            status: status,
            parsedEntries: [
                ParsedEntry(
                    date: "2026-04-10",
                    description: "UPI Payment",
                    debit: 500,
                    credit: nil,
                    categoryId: nil,
                    subcategoryId: nil,
                    transactionType: "expense"
                )
            ],
            createdAt: "2026-04-18T12:00:00Z"
        )
    }

    // MARK: - AppSettings

    static func mockSettings(
        firmName: String? = "Test Business",
        businessCountry: String? = "IN",
        baseCurrency: String? = "INR"
    ) -> AppSettings {
        AppSettings(
            baseCurrency: baseCurrency,
            dateFormat: "dd/MM/yyyy",
            businessCountry: businessCountry,
            firmName: firmName,
            firmAddress: "123 Test Street",
            firmCity: "Mumbai",
            firmState: "Maharashtra",
            firmPincode: "400001",
            firmPhone: "9876543210",
            firmEmail: "test@business.com",
            firmGstin: nil,
            firmPan: nil,
            firmWebsite: nil,
            firmLogoUrl: nil,
            firmSignatureUrl: nil,
            invoiceBankName: nil,
            invoiceBankAccountNumber: nil,
            invoiceBankIfsc: nil,
            invoiceBankBranch: nil,
            invoiceBankUpi: nil,
            invoicePrefix: "INV",
            invoiceTerms: nil,
            billPrefix: "BILL",
            billTerms: nil
        )
    }

    // MARK: - PaginatedList Helpers

    static func mockTransactionList(
        count: Int = 3,
        total: Int? = nil
    ) -> PaginatedList<Transaction> {
        let transactions = (0..<count).map { i in
            mockTransaction(
                id: "txn-\(String(format: "%03d", i + 1))",
                amount: Double((i + 1) * 1000),
                type: i % 2 == 0 ? .expense : .income
            )
        }
        return PaginatedList(items: transactions, total: total ?? count)
    }

    static func mockInvoiceList(
        count: Int = 3,
        total: Int? = nil
    ) -> PaginatedList<Invoice> {
        let invoices = (0..<count).map { i in
            mockInvoice(
                id: "inv-\(String(format: "%03d", i + 1))",
                status: ["unpaid", "paid", "partial"][i % 3],
                amount: Double((i + 1) * 10000)
            )
        }
        return PaginatedList(items: invoices, total: total ?? count)
    }
}
