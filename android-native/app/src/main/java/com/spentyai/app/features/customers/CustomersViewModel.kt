package com.spentyai.app.features.customers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.Customer
import com.spentyai.app.core.models.Invoice
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

data class CustomersUiState(
    val customers: List<Customer> = emptyList(),
    val searchText: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val customerInvoices: List<Invoice> = emptyList(),
    val isLoadingInvoices: Boolean = false
)

class CustomersViewModel(apiClient: ApiClient) : ViewModel() {

    private val repository = CustomerRepository(apiClient)

    private val _uiState = MutableStateFlow(CustomersUiState())
    val uiState: StateFlow<CustomersUiState> = _uiState.asStateFlow()

    val filteredCustomers: StateFlow<List<Customer>> = combine(
        _uiState
    ) { states ->
        val state = states[0]
        if (state.searchText.isBlank()) {
            state.customers
        } else {
            val query = state.searchText.lowercase()
            state.customers.filter { customer ->
                customer.name.lowercase().contains(query) ||
                (customer.email?.lowercase()?.contains(query) == true)
            }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun updateSearch(text: String) {
        _uiState.value = _uiState.value.copy(searchText = text)
    }

    fun loadCustomers() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.fetchAll()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(customers = result.data, isLoading = false)
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = result.error.message, isLoading = false)
                }
            }
        }
    }

    fun createCustomer(payload: JsonObject, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.create(payload)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.customers + result.data
                    _uiState.value = _uiState.value.copy(customers = updated, isLoading = false)
                    onSuccess()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = result.error.message, isLoading = false)
                }
            }
        }
    }

    fun updateCustomer(id: String, payload: JsonObject, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.update(id, payload)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.customers.map { if (it.id == id) result.data else it }
                    _uiState.value = _uiState.value.copy(customers = updated, isLoading = false)
                    onSuccess()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = result.error.message, isLoading = false)
                }
            }
        }
    }

    fun deleteCustomer(id: String) {
        viewModelScope.launch {
            when (repository.delete(id)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.customers.filter { it.id != id }
                    _uiState.value = _uiState.value.copy(customers = updated)
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = "Failed to delete customer")
                }
            }
        }
    }

    fun loadCustomerInvoices(customerId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingInvoices = true, customerInvoices = emptyList())
            when (val result = repository.fetchCustomerInvoices(customerId)) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(customerInvoices = result.data, isLoadingInvoices = false)
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(isLoadingInvoices = false)
                }
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }
}
