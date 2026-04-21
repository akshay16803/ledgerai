package com.spentyai.app.features.invoices

import com.spentyai.app.core.models.Account
import com.spentyai.app.core.models.Customer
import com.spentyai.app.core.models.Invoice
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

// ---------- Response / Payload models ----------

@Serializable
data class InvoiceStats(
    @SerialName("total_invoiced") val totalInvoiced: Double = 0.0,
    @SerialName("total_paid") val totalPaid: Double = 0.0,
    @SerialName("total_outstanding") val totalOutstanding: Double = 0.0,
    @SerialName("total_overdue") val totalOverdue: Double = 0.0
)

@Serializable
data class InvoiceDebtor(
    @SerialName("customer_id") val customerId: String? = null,
    @SerialName("customer_name") val customerName: String? = null,
    @SerialName("total_outstanding") val totalOutstanding: Double = 0.0,
    @SerialName("invoice_count") val invoiceCount: Int = 0
)

@Serializable
data class InvoiceAgingBucket(
    val label: String? = null,
    val amount: Double = 0.0,
    val count: Int = 0
)

@Serializable
data class InvoiceSalesByCustomer(
    @SerialName("customer_id") val customerId: String? = null,
    @SerialName("customer_name") val customerName: String? = null,
    @SerialName("total_sales") val totalSales: Double = 0.0,
    @SerialName("invoice_count") val invoiceCount: Int = 0
)

@Serializable
data class InvoiceNextNumber(
    @SerialName("next_number") val nextNumber: String? = null
)

class InvoiceRepository(private val apiClient: ApiClient) {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
        encodeDefaults = true
    }

    // CRUD

    suspend fun fetchAll(): ApiResult<List<Invoice>> =
        apiClient.safeApiCall { apiClient.endpoints.getInvoices() }

    suspend fun fetch(id: String): ApiResult<Invoice> =
        apiClient.safeApiCall { apiClient.endpoints.getInvoice(id) }

    suspend fun create(payload: JsonObject): ApiResult<Invoice> =
        apiClient.safeApiCall { apiClient.endpoints.createInvoice(payload) }

    suspend fun update(id: String, payload: JsonObject): ApiResult<Invoice> =
        apiClient.safeApiCall { apiClient.endpoints.updateInvoice(id, payload) }

    suspend fun delete(id: String): ApiResult<JsonObject> =
        apiClient.safeApiCall { apiClient.endpoints.deleteInvoice(id) }

    // Actions

    suspend fun recordPayment(id: String, payload: JsonObject): ApiResult<Invoice> =
        apiClient.safeApiCall { apiClient.endpoints.markInvoicePaid(id, payload) }

    suspend fun markPaid(id: String): ApiResult<Invoice> =
        apiClient.safeApiCall {
            apiClient.endpoints.markInvoicePaid(id, buildJsonObject { put("mark_fully_paid", true) })
        }

    // Stats & Aggregates (these use the base invoices endpoint with query params, or dedicated endpoints)
    // For now, we compute stats client-side from the invoice list since the Android API doesn't have
    // dedicated stats endpoints yet. The iOS app uses custom endpoints.

    suspend fun fetchCustomers(): ApiResult<List<Customer>> =
        apiClient.safeApiCall { apiClient.endpoints.getCustomers() }

    suspend fun fetchAccounts(): ApiResult<List<Account>> =
        apiClient.safeApiCall { apiClient.endpoints.getAccounts() }

    // Build payload

    fun buildInvoicePayload(
        invoiceNumber: String,
        customerId: String?,
        customerName: String?,
        issueDate: String,
        dueDate: String,
        lineItems: List<InvoiceFormLineItem>,
        subtotal: Double,
        taxAmount: Double,
        totalCgst: Double,
        totalSgst: Double,
        totalIgst: Double,
        grandTotal: Double,
        notes: String?,
        terms: String?
    ): JsonObject = buildJsonObject {
        put("invoice_number", invoiceNumber)
        customerId?.let { put("customer_id", it) }
        customerName?.let { put("customer_name", it) }
        put("issue_date", issueDate)
        put("due_date", dueDate)
        put("subtotal", subtotal)
        put("tax_amount", taxAmount)
        put("total_cgst", totalCgst)
        put("total_sgst", totalSgst)
        put("total_igst", totalIgst)
        put("total", grandTotal)
        notes?.let { put("notes", it) }
        terms?.let { put("terms", it) }
        putJsonArray("line_items") {
            lineItems.forEach { item ->
                add(buildJsonObject {
                    put("description", item.description)
                    if (item.hsnSac.isNotBlank()) put("hsn_sac", item.hsnSac)
                    put("quantity", item.quantity)
                    put("unit_price", item.rate)
                    put("tax_rate", item.taxPercent)
                    put("amount", item.taxableAmount)
                })
            }
        }
    }

    fun buildRecordPaymentPayload(
        amount: Double,
        date: String,
        method: String,
        accountId: String?,
        note: String?
    ): JsonObject = buildJsonObject {
        put("amount", amount)
        put("date", date)
        put("payment_method", method)
        accountId?.let { put("account_id", it) }
        note?.let { put("note", it) }
    }
}

// Form line item used locally in the form
data class InvoiceFormLineItem(
    val id: String = java.util.UUID.randomUUID().toString(),
    var description: String = "",
    var hsnSac: String = "",
    var quantity: Double = 1.0,
    var rate: Double = 0.0,
    var taxPercent: Double = 18.0
) {
    val taxableAmount: Double get() = quantity * rate
    val taxAmount: Double get() = taxableAmount * taxPercent / 100.0
    val lineTotal: Double get() = taxableAmount + taxAmount
}
