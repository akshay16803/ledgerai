package com.spentyai.app.features.purchases

import com.spentyai.app.core.models.Account
import com.spentyai.app.core.models.Bill
import com.spentyai.app.core.models.Vendor
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.JsonPrimitive

// ---------- Response / Payload models ----------

@Serializable
data class BillStats(
    @SerialName("total_billed") val totalBilled: Double = 0.0,
    @SerialName("total_paid") val totalPaid: Double = 0.0,
    @SerialName("total_outstanding") val totalOutstanding: Double = 0.0,
    @SerialName("total_overdue") val totalOverdue: Double = 0.0
)

@Serializable
data class CreditorSummary(
    @SerialName("vendor_id") val vendorId: String? = null,
    @SerialName("vendor_name") val vendorName: String? = null,
    @SerialName("total_outstanding") val totalOutstanding: Double = 0.0,
    @SerialName("bill_count") val billCount: Int = 0
)

@Serializable
data class BillAgingBucket(
    val label: String? = null,
    val bucket: String? = null,
    val amount: Double = 0.0,
    val count: Int = 0
) {
    val displayLabel: String get() = label ?: bucket ?: "--"
}

// Form line item model
data class PurchaseFormLineItem(
    val id: String = java.util.UUID.randomUUID().toString(),
    var description: String = "",
    var hsnSac: String = "",
    var quantity: Double = 1.0,
    var rate: Double = 0.0,
    var taxRate: Double = 0.0
) {
    val computedAmount: Double get() = quantity * rate
    val taxAmount: Double get() = computedAmount * taxRate / 100.0
    val lineTotal: Double get() = computedAmount + taxAmount
}

class PurchaseRepository(private val apiClient: ApiClient) {

    // CRUD

    suspend fun fetchAll(): ApiResult<List<Bill>> =
        apiClient.safeApiCall { apiClient.endpoints.getBills() }

    suspend fun fetch(id: String): ApiResult<Bill> =
        apiClient.safeApiCall { apiClient.endpoints.getBill(id) }

    suspend fun create(payload: JsonObject): ApiResult<Bill> =
        apiClient.safeApiCall { apiClient.endpoints.createBill(payload) }

    suspend fun update(id: String, payload: JsonObject): ApiResult<Bill> =
        apiClient.safeApiCall { apiClient.endpoints.updateBill(id, payload) }

    suspend fun delete(id: String): ApiResult<JsonObject> =
        apiClient.safeApiCall { apiClient.endpoints.deleteBill(id) }

    // Actions

    suspend fun recordPayment(id: String, payload: JsonObject): ApiResult<Bill> =
        apiClient.safeApiCall { apiClient.endpoints.markBillPaid(id, payload) }

    suspend fun markPaid(id: String): ApiResult<Bill> =
        apiClient.safeApiCall {
            apiClient.endpoints.markBillPaid(id, buildJsonObject { put("mark_fully_paid", true) })
        }

    // Supporting data

    suspend fun fetchVendors(): ApiResult<List<Vendor>> =
        apiClient.safeApiCall { apiClient.endpoints.getVendors() }

    suspend fun fetchAccounts(): ApiResult<List<Account>> =
        apiClient.safeApiCall { apiClient.endpoints.getAccounts() }
}

fun buildBillPayload(
    billNumber: String?,
    vendorId: String?,
    vendorName: String?,
    issueDate: String,
    dueDate: String,
    lineItems: List<PurchaseFormLineItem>,
    subtotal: Double,
    taxAmount: Double,
    grandTotal: Double,
    notes: String?
): JsonObject = buildJsonObject {
    billNumber?.let { put("bill_number", it) }
    vendorId?.let { put("vendor_id", it) }
    vendorName?.let { put("vendor_name", it) }
    put("issue_date", issueDate)
    put("due_date", dueDate)
    put("subtotal", subtotal)
    put("tax_amount", taxAmount)
    put("total", grandTotal)
    notes?.let { put("notes", it) }
    put("line_items", buildJsonArray {
        lineItems.filter { it.description.isNotBlank() }.forEach { item ->
            add(buildJsonObject {
                put("description", item.description)
                if (item.hsnSac.isNotBlank()) put("hsn_sac", item.hsnSac)
                put("quantity", item.quantity)
                put("unit_price", item.rate)
                put("tax_rate", item.taxRate)
                put("amount", item.computedAmount)
            })
        }
    })
}
