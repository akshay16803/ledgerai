import Foundation

@Observable
final class SMSSyncViewModel {

    // MARK: - Input

    var smsText = ""

    // MARK: - State

    var syncStats: SMSSyncStats?
    var isUploading = false
    var isParsing = false
    var isRetrying = false
    var isDetectingMandates = false
    var isLoadingStats = false
    var errorMessage = ""
    var showError = false
    var showResults = false

    // MARK: - Last Action Results

    var lastUploadResult: SMSUploadResponse?
    var lastParseResult: SMSParseResponse?
    var lastRetryResult: SMSRetryResponse?
    var lastMandateResult: SMSMandateResponse?

    // MARK: - Dependencies

    private let repository: SMSSyncRepository

    // MARK: - Init

    init(repository: SMSSyncRepository = .shared) {
        self.repository = repository
    }

    // MARK: - Upload & Parse

    @MainActor
    func uploadAndParse() async {
        let messages = smsText
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        guard !messages.isEmpty else {
            errorMessage = "Please paste at least one SMS message."
            showError = true
            return
        }

        isUploading = true
        showError = false
        showResults = false

        do {
            lastUploadResult = try await repository.uploadMessages(messages)

            isParsing = true
            isUploading = false

            lastParseResult = try await repository.bulkParse()

            isParsing = false
            showResults = true
            smsText = ""

            await loadStats()
        } catch {
            isUploading = false
            isParsing = false
            handleError(error)
        }
    }

    // MARK: - Retry Pending

    @MainActor
    func retryPending() async {
        isRetrying = true
        showError = false

        do {
            lastRetryResult = try await repository.retryPending()
            await loadStats()
        } catch {
            handleError(error)
        }

        isRetrying = false
    }

    // MARK: - Detect Mandates

    @MainActor
    func detectMandates() async {
        isDetectingMandates = true
        showError = false

        do {
            lastMandateResult = try await repository.detectMandates()
            await loadStats()
        } catch {
            handleError(error)
        }

        isDetectingMandates = false
    }

    // MARK: - Load Stats

    @MainActor
    func loadStats() async {
        isLoadingStats = true

        do {
            syncStats = try await repository.getStats()
        } catch {
            handleError(error)
        }

        isLoadingStats = false
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

    // MARK: - Computed

    var messageCount: Int {
        smsText
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .count
    }

    var isProcessing: Bool {
        isUploading || isParsing
    }

    var canUpload: Bool {
        !smsText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isProcessing
    }

    var hasStats: Bool {
        syncStats != nil
    }
}
