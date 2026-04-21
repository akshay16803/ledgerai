package com.spentyai.app.features.vendors

import com.spentyai.app.core.models.Bill
import com.spentyai.app.core.models.Vendor
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class VendorRepository(private val apiClient: ApiClient) {

    // CRUD

    suspend fun fetchAll(): ApiResult<List<Vendor>> =
        apiClient.safeApiCall { apiClient.endpoints.getVendors() }

    suspend fun fetch(id: String): ApiResult<Vendor> =
        apiClient.safeApiCall { apiClient.endpoints.getVendor(id) }

    suspend fun create(payload: JsonObject): ApiResult<Vendor> =
        apiClient.safeApiCall { apiClient.endpoints.createVendor(payload) }

    suspend fun update(id: String, payload: JsonObject): ApiResult<Vendor> =
        apiClient.safeApiCall { apiClient.endpoints.updateVendor(id, payload) }

    suspend fun delete(id: String): ApiResult<JsonObject> =
        apiClient.safeApiCall { apiClient.endpoints.deleteVendor(id) }

    // Bills for a vendor
    suspend fun fetchVendorBills(vendorId: String): ApiResult<List<Bill>> =
        apiClient.safeApiCall { apiClient.endpoints.getBills(vendorId = vendorId) }
}

fun buildVendorPayload(
    name: String,
    email: String?,
    phone: String?,
    gstin: String?,
    address: String?,
    notes: String?
): JsonObject = buildJsonObject {
    put("name", name)
    email?.let { put("email", it) }
    phone?.let { put("phone", it) }
    gstin?.let { put("tax_id", it) }
    address?.let {
        put("address", buildJsonObject {
            put("street", it)
        })
    }
    notes?.let { put("notes", it) }
}
