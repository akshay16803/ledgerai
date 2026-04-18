import Foundation
import SwiftUI

enum PeriodPreset: String, CaseIterable, Identifiable {
    case thisMonth = "This Month"
    case last3Months = "Last 3 Months"
    case last6Months = "Last 6 Months"
    case thisYear = "This Year"
    case allTime = "All Time"
    case custom = "Custom"

    var id: String { rawValue }
}

enum CategoryType: String, CaseIterable, Identifiable {
    case expense = "Expense"
    case income = "Income"

    var id: String { rawValue }
}

@Observable
final class ReportsViewModel {

    // MARK: - State

    var summary: ReportSummary?
    var periods: [ReportPeriod] = []
    var categories: [ReportCategory] = []

    var activePreset: PeriodPreset = .thisMonth
    var startDate: Date = Date()
    var endDate: Date = Date()
    var catType: CategoryType = .expense

    var isLoading = false
    var errorMessage = ""
    var showError = false

    var exportedFileURL: URL?
    var showShareSheet = false
    var isExporting = false

    // MARK: - Dependencies

    private let repository: ReportsRepository

    // MARK: - Init

    init(repository: ReportsRepository = .shared) {
        self.repository = repository
        applyPreset(.thisMonth)
    }

    // MARK: - Preset Calculation

    func applyPreset(_ preset: PeriodPreset) {
        activePreset = preset
        let calendar = Calendar.current
        let now = Date()

        switch preset {
        case .thisMonth:
            startDate = calendar.date(from: calendar.dateComponents([.year, .month], from: now))!
            endDate = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startDate)!

        case .last3Months:
            endDate = now
            startDate = calendar.date(byAdding: .month, value: -3, to: now)!

        case .last6Months:
            endDate = now
            startDate = calendar.date(byAdding: .month, value: -6, to: now)!

        case .thisYear:
            startDate = calendar.date(from: calendar.dateComponents([.year], from: now))!
            endDate = calendar.date(byAdding: DateComponents(year: 1, day: -1), to: startDate)!

        case .allTime:
            startDate = calendar.date(from: DateComponents(year: 2000, month: 1, day: 1))!
            endDate = now

        case .custom:
            break
        }
    }

    // MARK: - Load Data

    @MainActor
    func loadData() async {
        isLoading = true
        showError = false

        do {
            async let summaryTask = repository.getSummary(from: startDate, to: endDate)
            async let periodsTask = repository.getPeriods(from: startDate, to: endDate)
            async let categoriesTask = repository.getCategories(
                from: startDate, to: endDate, type: catType.rawValue.lowercased()
            )

            let (s, p, c) = try await (summaryTask, periodsTask, categoriesTask)
            summary = s
            periods = p
            categories = c
        } catch {
            handleError(error)
        }

        isLoading = false
    }

    // MARK: - Reload Categories Only

    @MainActor
    func reloadCategories() async {
        do {
            categories = try await repository.getCategories(
                from: startDate, to: endDate, type: catType.rawValue.lowercased()
            )
        } catch {
            handleError(error)
        }
    }

    // MARK: - Export

    @MainActor
    func exportCSV() async {
        isExporting = true
        do {
            let data = try await repository.exportCSV(from: startDate, to: endDate)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("SpentyAI_Report.csv")
            try data.write(to: url)
            exportedFileURL = url
            showShareSheet = true
        } catch {
            handleError(error)
        }
        isExporting = false
    }

    @MainActor
    func exportPDF() async {
        isExporting = true
        do {
            let data = try await repository.exportPDF(from: startDate, to: endDate)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("SpentyAI_Report.pdf")
            try data.write(to: url)
            exportedFileURL = url
            showShareSheet = true
        } catch {
            handleError(error)
        }
        isExporting = false
    }

    // MARK: - Computed

    var totalIncome: Double { summary?.totalIncome ?? 0 }
    var totalExpense: Double { summary?.totalExpense ?? 0 }
    var net: Double { summary?.net ?? 0 }
    var transactionCount: Int { summary?.transactionCount ?? 0 }
    var hasData: Bool { summary != nil }

    var totalCategoryAmount: Double {
        categories.reduce(0) { $0 + abs($1.amount ?? 0) }
    }

    // MARK: - Helpers

    @MainActor
    private func handleError(_ error: Error) {
        if let apiError = error as? APIError {
            errorMessage = apiError.localizedDescription
        } else {
            errorMessage = error.localizedDescription
        }
        showError = true
    }
}
