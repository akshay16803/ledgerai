package com.spentyai.app.core.network

import com.spentyai.app.core.models.*
import kotlinx.serialization.json.JsonObject
import retrofit2.Response
import retrofit2.http.*

interface ApiEndpoints {

    // --- Auth ---
    @POST("api/auth/google")
    suspend fun googleSignIn(@Body body: JsonObject): Response<JsonObject>

    @POST("api/auth/apple")
    suspend fun appleSignIn(@Body body: JsonObject): Response<JsonObject>

    @GET("api/auth/session")
    suspend fun checkSession(): Response<JsonObject>

    @POST("api/auth/logout")
    suspend fun logout(): Response<JsonObject>

    @DELETE("api/auth/account")
    suspend fun deleteAccount(): Response<JsonObject>

    // --- Auth (iOS-compatible) ---
    @POST("api/auth/google/mobile")
    suspend fun googleSignInMobile(@Body body: JsonObject): Response<JsonObject>

    @GET("api/auth/me")
    suspend fun authMe(): Response<JsonObject>

    // --- Dashboard ---
    @GET("api/dashboard/summary")
    suspend fun getDashboardSummary(): Response<DashboardSummary>

    @GET("api/cashflow/projection")
    suspend fun getCashFlowProjection(): Response<CashFlowProjection>

    // --- Transactions ---
    @GET("api/transactions")
    suspend fun getTransactions(
        @Query("skip") skip: Int = 0,
        @Query("limit") limit: Int = 30,
        @Query("transaction_type") transactionType: String? = null,
        @Query("account_id") accountId: String? = null,
        @Query("category_id") categoryId: String? = null,
        @Query("from_date") fromDate: String? = null,
        @Query("to_date") toDate: String? = null,
        @Query("status") status: String? = null
    ): Response<TransactionListResponse>

    @GET("api/transactions/search")
    suspend fun searchTransactions(
        @Query("q") query: String,
        @Query("skip") skip: Int = 0,
        @Query("limit") limit: Int = 30,
        @Query("status") status: String? = null
    ): Response<TransactionItemsResponse>

    @GET("api/transactions/pending")
    suspend fun getPendingTransactions(): Response<TransactionItemsResponse>

    @GET("api/transactions/{id}")
    suspend fun getTransaction(@Path("id") id: String): Response<Transaction>

    @POST("api/transactions")
    suspend fun createTransaction(@Body transaction: JsonObject): Response<Transaction>

    @PUT("api/transactions/{id}")
    suspend fun updateTransaction(
        @Path("id") id: String,
        @Body transaction: JsonObject
    ): Response<Transaction>

    @DELETE("api/transactions/{id}")
    suspend fun deleteTransaction(@Path("id") id: String): Response<JsonObject>

    @POST("api/transactions/{id}/approve")
    suspend fun approveTransaction(@Path("id") id: String): Response<Transaction>

    @POST("api/transactions/{id}/reject")
    suspend fun rejectTransaction(@Path("id") id: String): Response<MessageResponse>

    @POST("api/transactions/bulk-approve")
    suspend fun bulkApproveTransactions(@Body body: BulkIdsBody): Response<MessageResponse>

    @POST("api/transactions/bulk-reject")
    suspend fun bulkRejectTransactions(@Body body: BulkIdsBody): Response<MessageResponse>

    @POST("api/transactions/bulk-delete")
    suspend fun bulkDeleteTransactions(@Body body: BulkIdsBody): Response<MessageResponse>

    @POST("api/transactions/{id}/toggle-recurring")
    suspend fun toggleRecurring(
        @Path("id") id: String,
        @Body body: RecurringToggleBody
    ): Response<Transaction>

    @POST("api/transactions/{id}/categorize")
    suspend fun categorizeTransaction(
        @Path("id") id: String,
        @Body body: JsonObject
    ): Response<Transaction>

    // --- Email Sync (pending review) ---
    @GET("api/email/pending-review")
    suspend fun getEmailPendingReview(): Response<List<Transaction>>

    // --- Accounts ---
    @GET("api/accounts")
    suspend fun getAccounts(): Response<AccountListResponse>

    @GET("api/accounts/{id}")
    suspend fun getAccount(@Path("id") id: String): Response<AccountResponse>

    @POST("api/accounts")
    suspend fun createAccount(@Body account: JsonObject): Response<Account>

    @PUT("api/accounts/{id}")
    suspend fun updateAccount(
        @Path("id") id: String,
        @Body account: JsonObject
    ): Response<Account>

    @DELETE("api/accounts/{id}")
    suspend fun deleteAccount(@Path("id") id: String): Response<JsonObject>

    @POST("api/accounts/{id}/recalculate")
    suspend fun recalculateAccount(@Path("id") id: String): Response<Account>

    @GET("api/accounts/{id}/amortization")
    suspend fun getAccountAmortization(@Path("id") id: String): Response<AmortizationResponse>

    @GET("api/accounts/{id}/transactions")
    suspend fun getAccountTransactions(
        @Path("id") id: String,
        @Query("status") status: String? = null,
        @Query("limit") limit: Int? = null,
        @Query("transaction_type") transactionType: String? = null,
        @Query("category_id") categoryId: String? = null,
        @Query("from_date") fromDate: String? = null,
        @Query("to_date") toDate: String? = null,
        @Query("min_amount") minAmount: Double? = null,
        @Query("max_amount") maxAmount: Double? = null,
        @Query("search") search: String? = null
    ): Response<AccountTransactionsResponse>

    @GET("api/accounts/{id}/od-interest")
    suspend fun getAccountODInterest(
        @Path("id") id: String,
        @Query("month") month: String
    ): Response<ODInterestResponse>

    // --- Account Sub-Types ---
    @GET("api/account-sub-types")
    suspend fun getAccountSubTypes(): Response<SubTypeListResponse>

    @POST("api/account-sub-types")
    suspend fun createAccountSubType(@Body body: JsonObject): Response<SubTypeResponse>

    @PUT("api/account-sub-types/{id}")
    suspend fun updateAccountSubType(
        @Path("id") id: String,
        @Body body: JsonObject
    ): Response<SubTypeResponse>

    @DELETE("api/account-sub-types/{id}")
    suspend fun deleteAccountSubType(@Path("id") id: String): Response<JsonObject>

    // --- Demat ---
    @POST("api/demat/upload-statement")
    suspend fun uploadDematStatement(@Body body: JsonObject): Response<DematUploadResponse>

    @GET("api/demat/statements/{accountId}")
    suspend fun getDematStatements(@Path("accountId") accountId: String): Response<DematStatementsResponse>

    @POST("api/demat/approve-statement/{id}")
    suspend fun approveDematStatement(@Path("id") id: String): Response<DematActionResponse>

    @POST("api/demat/reject-statement/{id}")
    suspend fun rejectDematStatement(@Path("id") id: String): Response<DematActionResponse>

    // --- Categories ---
    @GET("api/categories")
    suspend fun getCategories(): Response<List<Category>>

    @POST("api/categories")
    suspend fun createCategory(@Body category: CreateCategoryRequest): Response<Category>

    @PUT("api/categories/{id}")
    suspend fun updateCategory(
        @Path("id") id: String,
        @Body category: UpdateCategoryRequest
    ): Response<Category>

    @DELETE("api/categories/{id}")
    suspend fun deleteCategory(@Path("id") id: String): Response<JsonObject>

    @GET("api/categories/defaults")
    suspend fun getCategoryDefaults(): Response<List<Category>>

    @POST("api/categories/merge")
    suspend fun mergeCategories(@Body body: MergeCategoriesRequest): Response<MergeCategoriesResponse>

    // --- Invoices ---
    @GET("api/invoices")
    suspend fun getInvoices(
        @Query("status") status: String? = null,
        @Query("customer_id") customerId: String? = null
    ): Response<List<Invoice>>

    @GET("api/invoices/{id}")
    suspend fun getInvoice(@Path("id") id: String): Response<Invoice>

    @POST("api/invoices")
    suspend fun createInvoice(@Body invoice: JsonObject): Response<Invoice>

    @PUT("api/invoices/{id}")
    suspend fun updateInvoice(
        @Path("id") id: String,
        @Body invoice: JsonObject
    ): Response<Invoice>

    @DELETE("api/invoices/{id}")
    suspend fun deleteInvoice(@Path("id") id: String): Response<JsonObject>

    @POST("api/invoices/{id}/send")
    suspend fun sendInvoice(@Path("id") id: String): Response<JsonObject>

    @POST("api/invoices/{id}/mark-paid")
    suspend fun markInvoicePaid(
        @Path("id") id: String,
        @Body body: JsonObject
    ): Response<Invoice>

    // --- Bills ---
    @GET("api/bills")
    suspend fun getBills(
        @Query("status") status: String? = null,
        @Query("vendor_id") vendorId: String? = null
    ): Response<List<Bill>>

    @GET("api/bills/{id}")
    suspend fun getBill(@Path("id") id: String): Response<Bill>

    @POST("api/bills")
    suspend fun createBill(@Body bill: JsonObject): Response<Bill>

    @PUT("api/bills/{id}")
    suspend fun updateBill(
        @Path("id") id: String,
        @Body bill: JsonObject
    ): Response<Bill>

    @DELETE("api/bills/{id}")
    suspend fun deleteBill(@Path("id") id: String): Response<JsonObject>

    @POST("api/bills/{id}/mark-paid")
    suspend fun markBillPaid(
        @Path("id") id: String,
        @Body body: JsonObject
    ): Response<Bill>

    // --- Customers ---
    @GET("api/customers")
    suspend fun getCustomers(): Response<List<Customer>>

    @GET("api/customers/{id}")
    suspend fun getCustomer(@Path("id") id: String): Response<Customer>

    @POST("api/customers")
    suspend fun createCustomer(@Body customer: JsonObject): Response<Customer>

    @PUT("api/customers/{id}")
    suspend fun updateCustomer(
        @Path("id") id: String,
        @Body customer: JsonObject
    ): Response<Customer>

    @DELETE("api/customers/{id}")
    suspend fun deleteCustomer(@Path("id") id: String): Response<JsonObject>

    // --- Vendors ---
    @GET("api/vendors")
    suspend fun getVendors(): Response<List<Vendor>>

    @GET("api/vendors/{id}")
    suspend fun getVendor(@Path("id") id: String): Response<Vendor>

    @POST("api/vendors")
    suspend fun createVendor(@Body vendor: JsonObject): Response<Vendor>

    @PUT("api/vendors/{id}")
    suspend fun updateVendor(
        @Path("id") id: String,
        @Body vendor: JsonObject
    ): Response<Vendor>

    @DELETE("api/vendors/{id}")
    suspend fun deleteVendor(@Path("id") id: String): Response<JsonObject>

    // --- Reports ---
    @GET("api/reports/summary")
    suspend fun getReportsSummary(
        @Query("start_date") startDate: String,
        @Query("end_date") endDate: String
    ): Response<ReportSummary>

    @GET("api/reports/by-period")
    suspend fun getReportsByPeriod(
        @Query("start_date") startDate: String,
        @Query("end_date") endDate: String
    ): Response<PeriodsResponse>

    @GET("api/reports/by-category")
    suspend fun getReportsByCategory(
        @Query("start_date") startDate: String,
        @Query("end_date") endDate: String,
        @Query("transaction_type") transactionType: String = "expense"
    ): Response<CategoriesReportResponse>

    @GET("api/reports/income-expense")
    suspend fun getReportsIncomeExpense(
        @Query("start_date") startDate: String,
        @Query("end_date") endDate: String
    ): Response<IncomeExpenseResponse>

    @GET("api/reports/export/csv")
    suspend fun exportReportCSV(
        @Query("start_date") startDate: String,
        @Query("end_date") endDate: String
    ): Response<okhttp3.ResponseBody>

    @GET("api/reports/export/pdf")
    suspend fun exportReportPDF(
        @Query("start_date") startDate: String,
        @Query("end_date") endDate: String
    ): Response<okhttp3.ResponseBody>

    @GET("api/reports/tax-summary")
    suspend fun getTaxSummary(
        @Query("year") year: Int
    ): Response<TaxSummary>

    // --- Cash Flow ---
    @GET("api/cashflow/projection")
    suspend fun getCashFlowProjectionFull(): Response<CashFlowProjection>

    @GET("api/cashflow/history")
    suspend fun getCashFlowHistory(): Response<CashFlowProjection>

    @GET("api/recurring/list")
    suspend fun getRecurringList(): Response<RecurringListResponse>

    @POST("api/transactions/{id}/toggle-recurring")
    suspend fun toggleRecurring(
        @Path("id") id: String,
        @Body body: ToggleRecurringBody
    ): Response<Transaction>

    // --- Mandates (full) ---
    @GET("api/mandates/list")
    suspend fun getMandatesList(): Response<MandateListResponse>

    @GET("api/mandates/upcoming")
    suspend fun getUpcomingMandates(): Response<UpcomingMandatesResponse>

    @POST("api/mandates/detect")
    suspend fun detectMandates(): Response<DetectMandatesResponse>

    @POST("api/mandates/create")
    suspend fun createMandateFull(@Body body: MandateCreateBody): Response<Mandate>

    @PATCH("api/mandates/{id}")
    suspend fun patchMandate(
        @Path("id") id: String,
        @Body body: MandateUpdateBody
    ): Response<Mandate>

    @DELETE("api/mandates/{id}/delete")
    suspend fun deleteMandateFull(@Path("id") id: String): Response<MessageResponse>

    // --- Statements (full) ---
    @GET("api/statements/list")
    suspend fun getStatementsList(): Response<StatementListResponse>

    @GET("api/statements/{id}/detail")
    suspend fun getStatementDetail(@Path("id") id: String): Response<Statement>

    @DELETE("api/statements/{id}/delete")
    suspend fun deleteStatementFull(@Path("id") id: String): Response<MessageResponse>

    @GET("api/statements/{id}/entries")
    suspend fun getStatementEntries(@Path("id") id: String): Response<EntriesResponse>

    @PATCH("api/statements/{statementId}/entries/{index}")
    suspend fun updateStatementEntry(
        @Path("statementId") statementId: String,
        @Path("index") index: Int,
        @Body body: EntryUpdateBody
    ): Response<EntryUpdateResponse>

    @POST("api/statements/{id}/bulk-categorize")
    suspend fun bulkCategorize(
        @Path("id") id: String,
        @Body body: BulkCategorizeBody
    ): Response<BulkCategorizeResponse>

    @POST("api/statements/{id}/reconcile")
    suspend fun reconcileStatement(@Path("id") id: String): Response<ReconcileResponse>

    @POST("api/statements/{id}/add-missing")
    suspend fun addMissingToLedger(
        @Path("id") id: String,
        @Body body: AddMissingBody
    ): Response<AddMissingResponse>

    @POST("api/statements/{id}/reaudit")
    suspend fun reauditStatement(@Path("id") id: String): Response<ReauditResponse>

    @POST("api/statements/{id}/unlock")
    suspend fun unlockStatement(
        @Path("id") id: String,
        @Body body: UnlockBody
    ): Response<ReauditResponse>

    @POST("api/statements/{id}/approve")
    suspend fun approveStatement(@Path("id") id: String): Response<ApproveResponse>

    @POST("api/statements/{id}/reject")
    suspend fun rejectStatement(@Path("id") id: String): Response<MessageResponse>

    @GET("api/accounts/sub-types")
    suspend fun getAccountSubTypes(): Response<List<AccountSubType>>

    // --- Email Sync (full) ---
    @GET("api/email/gmail/connect")
    suspend fun connectGmail(): Response<OAuthConnectResponse>

    @GET("api/email/gmail/status")
    suspend fun getGmailStatus(): Response<EmailProviderStatus>

    @POST("api/email/gmail/disconnect")
    suspend fun disconnectGmail(@Body body: DisconnectRequest): Response<GenericMessageResponse>

    @GET("api/email/outlook/connect")
    suspend fun connectOutlook(): Response<OAuthConnectResponse>

    @GET("api/email/outlook/status")
    suspend fun getOutlookStatus(): Response<EmailProviderStatus>

    @POST("api/email/outlook/disconnect")
    suspend fun disconnectOutlook(@Body body: DisconnectRequest): Response<GenericMessageResponse>

    @POST("api/email/start-sync")
    suspend fun startEmailSync(@Body body: StartSyncRequest): Response<EmailSyncResponse>

    @POST("api/email/retry-pending")
    suspend fun retryPendingEmails(@Body body: RetryPendingRequest): Response<EmailRetryResponse>

    @GET("api/email/sync-stats")
    suspend fun getEmailSyncStats(): Response<EmailSyncStatsResponse>

    @GET("api/email/pending-review")
    suspend fun getPendingReview(): Response<PendingReviewResponse>

    @POST("api/transactions/{id}/approve")
    suspend fun approveTransaction(@Path("id") id: String): Response<GenericMessageResponse>

    @POST("api/transactions/{id}/reject")
    suspend fun rejectTransaction(@Path("id") id: String): Response<GenericMessageResponse>

    @POST("api/transactions/bulk-approve")
    suspend fun bulkApproveTransactions(@Body body: BulkTransactionRequest): Response<GenericMessageResponse>

    @POST("api/transactions/bulk-reject")
    suspend fun bulkRejectTransactions(@Body body: BulkTransactionRequest): Response<GenericMessageResponse>

    @PATCH("api/transactions/{id}")
    suspend fun patchTransaction(
        @Path("id") id: String,
        @Body body: PendingTransactionUpdate
    ): Response<Transaction>

    @GET("api/email/source/{id}")
    suspend fun getSourceContent(@Path("id") id: String): Response<SourceContent>

    @GET("api/sms/stats")
    suspend fun getSmsStats(): Response<SMSSyncStats>

    // --- Records (full) ---
    @GET("api/records/list")
    suspend fun getRecordsList(
        @Query("skip") skip: Int = 0,
        @Query("limit") limit: Int = 30,
        @Query("date_from") dateFrom: String? = null,
        @Query("date_to") dateTo: String? = null,
        @Query("amount_min") amountMin: Double? = null,
        @Query("amount_max") amountMax: Double? = null
    ): Response<RecordListResponse>

    @GET("api/records/search")
    suspend fun searchRecords(
        @Query("q") query: String,
        @Query("skip") skip: Int = 0,
        @Query("limit") limit: Int = 30
    ): Response<RecordSearchResponse>

    @GET("api/records/{id}/preview")
    suspend fun getRecordPreview(@Path("id") id: String): Response<RecordPreviewResponse>

    @GET("api/records/by-transaction/{transactionId}")
    suspend fun getRecordByTransaction(@Path("transactionId") transactionId: String): Response<RecordPreviewResponse>

    @DELETE("api/records/{id}")
    suspend fun deleteRecordFull(@Path("id") id: String): Response<MessageResponse>

    @GET("api/records/{id}/download-eml")
    suspend fun downloadEml(@Path("id") id: String): Response<okhttp3.ResponseBody>

    @GET("api/records/{id}/attachment/{index}")
    suspend fun downloadAttachment(
        @Path("id") id: String,
        @Path("index") index: Int
    ): Response<okhttp3.ResponseBody>

    @POST("api/records/download-zip")
    suspend fun downloadZip(@Body body: DownloadZipBody): Response<okhttp3.ResponseBody>

    // --- Receipts ---
    @GET("api/receipts")
    suspend fun getReceipts(
        @Query("skip") skip: Int = 0,
        @Query("limit") limit: Int = 30
    ): Response<ReceiptListResponse>

    @GET("api/receipts/{id}")
    suspend fun getReceipt(@Path("id") id: String): Response<Receipt>

    @DELETE("api/receipts/{id}")
    suspend fun deleteReceipt(@Path("id") id: String): Response<MessageResponse>

    @GET("api/receipts/{id}/download")
    suspend fun downloadReceipt(@Path("id") id: String): Response<okhttp3.ResponseBody>

    @POST("api/receipts/{id}/parse")
    suspend fun parseReceipt(@Path("id") id: String): Response<ReceiptParseResponse>

    @POST("api/receipts/{id}/link")
    suspend fun linkReceipt(
        @Path("id") id: String,
        @Body body: ReceiptLinkBody
    ): Response<ReceiptLinkResponse>

    @GET("api/receipts/by-transaction/{transactionId}")
    suspend fun getReceiptByTransaction(@Path("transactionId") transactionId: String): Response<Receipt>

    // --- Chat / AI ---
    @POST("api/chat")
    suspend fun sendChatMessage(@Body body: JsonObject): Response<ChatMessage>

    @GET("api/chat/history")
    suspend fun getChatHistory(): Response<List<ChatMessage>>

    // --- Settings ---
    @GET("api/settings")
    suspend fun getSettings(): Response<Settings>

    @PUT("api/settings")
    suspend fun updateSettings(@Body settings: JsonObject): Response<Settings>

    // --- User / Profile ---
    @GET("api/user/profile")
    suspend fun getUserProfile(): Response<User>

    @PUT("api/user/profile")
    suspend fun updateUserProfile(@Body profile: JsonObject): Response<User>

    // --- Subscription ---
    @GET("api/subscription/status")
    suspend fun getSubscriptionStatus(): Response<JsonObject>

    @POST("api/subscription/verify")
    suspend fun verifySubscription(@Body body: JsonObject): Response<JsonObject>

    // --- Feature Requests ---
    @GET("api/feature-requests")
    suspend fun getFeatureRequests(): Response<List<FeatureRequest>>

    @POST("api/feature-requests")
    suspend fun createFeatureRequest(@Body request: JsonObject): Response<FeatureRequest>

    @POST("api/feature-requests/{id}/vote")
    suspend fun voteFeatureRequest(@Path("id") id: String): Response<FeatureRequest>

    // --- Support ---
    @GET("api/support/tickets")
    suspend fun getSupportTickets(): Response<List<SupportTicket>>

    @POST("api/support/tickets")
    suspend fun createSupportTicket(@Body ticket: JsonObject): Response<SupportTicket>

    // --- Mandates ---
    @GET("api/mandates")
    suspend fun getMandates(): Response<List<Mandate>>

    @POST("api/mandates")
    suspend fun createMandate(@Body mandate: JsonObject): Response<Mandate>

    @PUT("api/mandates/{id}")
    suspend fun updateMandate(
        @Path("id") id: String,
        @Body mandate: JsonObject
    ): Response<Mandate>

    @DELETE("api/mandates/{id}")
    suspend fun deleteMandate(@Path("id") id: String): Response<JsonObject>

    // --- Payment Plans ---
    @GET("api/payment-plans")
    suspend fun getPaymentPlans(): Response<List<PaymentPlan>>

    @POST("api/payment-plans")
    suspend fun createPaymentPlan(@Body plan: JsonObject): Response<PaymentPlan>

    @PUT("api/payment-plans/{id}")
    suspend fun updatePaymentPlan(
        @Path("id") id: String,
        @Body plan: JsonObject
    ): Response<PaymentPlan>

    @DELETE("api/payment-plans/{id}")
    suspend fun deletePaymentPlan(@Path("id") id: String): Response<JsonObject>

    // --- Statements ---
    @GET("api/statements")
    suspend fun getStatements(
        @Query("account_id") accountId: String? = null
    ): Response<List<Statement>>

    @GET("api/statements/{id}")
    suspend fun getStatement(@Path("id") id: String): Response<Statement>

    @POST("api/statements/upload")
    suspend fun uploadStatement(@Body body: JsonObject): Response<Statement>
}
