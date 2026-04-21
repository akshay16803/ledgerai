package com.spentyai.app.features.vendors

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spentyai.app.core.models.Bill
import com.spentyai.app.core.models.Vendor
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

data class VendorsUiState(
    val vendors: List<Vendor> = emptyList(),
    val searchText: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val vendorBills: List<Bill> = emptyList(),
    val isLoadingBills: Boolean = false
)

class VendorsViewModel(apiClient: ApiClient) : ViewModel() {

    private val repository = VendorRepository(apiClient)

    private val _uiState = MutableStateFlow(VendorsUiState())
    val uiState: StateFlow<VendorsUiState> = _uiState.asStateFlow()

    val filteredVendors: StateFlow<List<Vendor>> = combine(
        _uiState
    ) { states ->
        val state = states[0]
        if (state.searchText.isBlank()) {
            state.vendors
        } else {
            val query = state.searchText.lowercase()
            state.vendors.filter { vendor ->
                vendor.name.lowercase().contains(query) ||
                (vendor.email?.lowercase()?.contains(query) == true)
            }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun updateSearch(text: String) {
        _uiState.value = _uiState.value.copy(searchText = text)
    }

    fun loadVendors() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.fetchAll()) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(vendors = result.data, isLoading = false)
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = result.error.message, isLoading = false)
                }
            }
        }
    }

    fun createVendor(payload: JsonObject, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.create(payload)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.vendors + result.data
                    _uiState.value = _uiState.value.copy(vendors = updated, isLoading = false)
                    onSuccess()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = result.error.message, isLoading = false)
                }
            }
        }
    }

    fun updateVendor(id: String, payload: JsonObject, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            when (val result = repository.update(id, payload)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.vendors.map { if (it.id == id) result.data else it }
                    _uiState.value = _uiState.value.copy(vendors = updated, isLoading = false)
                    onSuccess()
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = result.error.message, isLoading = false)
                }
            }
        }
    }

    fun deleteVendor(id: String) {
        viewModelScope.launch {
            when (repository.delete(id)) {
                is ApiResult.Success -> {
                    val updated = _uiState.value.vendors.filter { it.id != id }
                    _uiState.value = _uiState.value.copy(vendors = updated)
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(errorMessage = "Failed to delete vendor")
                }
            }
        }
    }

    fun loadVendorBills(vendorId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingBills = true, vendorBills = emptyList())
            when (val result = repository.fetchVendorBills(vendorId)) {
                is ApiResult.Success -> {
                    _uiState.value = _uiState.value.copy(vendorBills = result.data, isLoadingBills = false)
                }
                is ApiResult.Failure -> {
                    _uiState.value = _uiState.value.copy(isLoadingBills = false)
                }
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }
}
