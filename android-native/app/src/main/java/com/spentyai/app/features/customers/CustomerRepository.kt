package com.spentyai.app.features.customers

import com.spentyai.app.core.models.Customer
import com.spentyai.app.core.models.Invoice
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class CustomerRepository(private val apiClient: ApiClient) {

    // CRUD

    suspend fun fetchAll(): ApiResult<List<Customer>> =
        apiClient.safeApiCall { apiClient.endpoints.getCustomers() }

    suspend fun fetch(id: String): ApiResult<Customer> =
        apiClient.safeApiCall { apiClient.endpoints.getCustomer(id) }

    suspend fun create(payload: JsonObject): ApiResult<Customer> =
        apiClient.safeApiCall { apiClient.endpoints.createCustomer(payload) }

    suspend fun update(id: String, payload: JsonObject): ApiResult<Customer> =
        apiClient.safeApiCall { apiClient.endpoints.updateCustomer(id, payload) }

    suspend fun delete(id: String): ApiResult<JsonObject> =
        apiClient.safeApiCall { apiClient.endpoints.deleteCustomer(id) }

    // Invoices for a customer
    suspend fun fetchCustomerInvoices(customerId: String): ApiResult<List<Invoice>> =
        apiClient.safeApiCall { apiClient.endpoints.getInvoices(customerId = customerId) }
}

fun buildCustomerPayload(
    name: String,
    email: String?,
    phone: String?,
    gstin: String?,
    billingAddress: String?,
    shippingAddress: String?
): JsonObject = buildJsonObject {
    put("name", name)
    email?.let { put("email", it) }
    phone?.let { put("phone", it) }
    gstin?.let { put("tax_id", it) }
    billingAddress?.let {
        put("billing_address", buildJsonObject {
            put("street", it)
        })
    }
    shippingAddress?.let {
        put("shipping_address", buildJsonObject {
            put("street", it)
        })
    }
}
