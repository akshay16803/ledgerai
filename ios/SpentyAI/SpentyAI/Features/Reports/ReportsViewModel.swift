import Foundation

enum ReportPeriod: String, CaseIterable, Identifiable {
    case thisMonth = "This Month"
    case last3Months = "Last 3 Months"
    case last6Months = "Last 6 Months"
    case thisYear = "This Year"
    case allTime = "All Time"
    case custom = "Custom"

    var id: String { rawValue }
}

enum ReportTransactionType: String, CaseIterable, Identifiable {
    case all = "All"
    case expense = "Expense"
    case income = "Income"

    var id: String { rawValue }

    var apiValue: String? {
        switch self {
        case .all: return nil
        case .expense: return "expense"
        case .income: return "income"
        }
    }
}

@Observable
final class ReportsViewModel {

    // MARK: - State

    var selectedPeriod: ReportPeriod = .thisMonth
    var customStartDate: Date = Calendar.current.date(byAdding: .month, value: -1, to: .now) ?? .now
    var customEndDate: Date = .now

    var summary: ReportSummary?
    var periodReport: PeriodReport?
    var categoryReport: CategoryReport?

    var isLoading: Bool = false
    var error: String?

    var expandedCategories: Set<String> = []
    var selectedType: ReportTransactionType = .expense

    // MARK: - Dependencies

    private let repository = ReportRepository()

    // MARK: - Computed

    var dateRange: (startDate: String?, endDate: String?) {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        let now = Date.now

        switch selectedPeriod {
        case .thisMonth:
            let start = calendar.date(from: calendar.dateComponents([.year, .month], from: now))!
            return (formatter.string(from: start), formatter.string(from: now))

        case .last3Months:
            let start = calendar.date(byAdding: .month, value: -3, to: now)!
            return (formatter.string(from: start), formatter.string(from: now))

        case .last6Months:
            let start = calendar.date(byAdding: .month, value: -6, to: now)!
            return (formatter.string(from: start), formatter.string(from: now))

        case .thisYear:
            let start = calendar.date(from: calendar.dateComponents([.year], from: now))!
            return (formatter.string(from: start), formatter.string(from: now))

        case .allTime:
            return (nil, nil)

        case .custom:
            return (formatter.string(from: customStartDate), formatter.string(from: customEndDate))
        }
    }

    // MARK: - Methods

    func loadAll() async {
        isLoading = true
        error = nil

        async let summaryTask: () = loadSummary()
        async let periodTask: () = loadPeriodReport()
        async let categoryTask: () = loadCategoryReport()

        _ = await (summaryTask, periodTask, categoryTask)

        isLoading = false
    }

    func loadSummary() async {
        let range = dateRange
        do {
            summary = try await repository.getSummary(
                startDate: range.startDate,
                endDate: range.endDate
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadPeriodReport() async {
        let range = dateRange
        do {
            periodReport = try await repository.getByPeriod(
                startDate: range.startDate,
                endDate: range.endDate
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadCategoryReport() async {
        let range = dateRange
        do {
            categoryReport = try await repository.getByCategory(
                startDate: range.startDate,
                endDate: range.endDate,
                transactionType: selectedType.apiValue
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    func refresh() async {
        await loadAll()
    }

    func toggleCategory(id: String) {
        if expandedCategories.contains(id) {
            expandedCategories.remove(id)
        } else {
            expandedCategories.insert(id)
        }
    }
}
