package com.spentyai.app.features.customers

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.models.Customer
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.features.invoices.SectionCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerFormScreen(
    viewModel: CustomersViewModel,
    editingCustomer: Customer? = null,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val isEditing = editingCustomer != null

    var name by remember { mutableStateOf(editingCustomer?.name ?: "") }
    var email by remember { mutableStateOf(editingCustomer?.email ?: "") }
    var phone by remember { mutableStateOf(editingCustomer?.phone ?: "") }
    var gstin by remember { mutableStateOf(editingCustomer?.taxId ?: "") }
    var billingAddress by remember {
        mutableStateOf(
            editingCustomer?.billingAddress?.let {
                listOfNotNull(it.street, it.city, it.state, it.postalCode, it.country)
                    .filter { s -> s.isNotBlank() }.joinToString(", ")
            } ?: ""
        )
    }
    var shippingAddress by remember {
        mutableStateOf(
            editingCustomer?.shippingAddress?.let {
                listOfNotNull(it.street, it.city, it.state, it.postalCode, it.country)
                    .filter { s -> s.isNotBlank() }.joinToString(", ")
            } ?: ""
        )
    }
    var showValidation by remember { mutableStateOf(false) }

    val isNameValid = name.isNotBlank()

    fun save() {
        showValidation = true
        if (!isNameValid) return

        val payload = buildCustomerPayload(
            name = name.trim(),
            email = email.trim().ifBlank { null },
            phone = phone.trim().ifBlank { null },
            gstin = gstin.trim().ifBlank { null },
            billingAddress = billingAddress.trim().ifBlank { null },
            shippingAddress = shippingAddress.trim().ifBlank { null }
        )

        if (isEditing) {
            viewModel.updateCustomer(editingCustomer!!.id, payload) { onNavigateBack() }
        } else {
            viewModel.createCustomer(payload) { onNavigateBack() }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isEditing) "Edit Customer" else "New Customer", style = SpentyType.Headline) },
                navigationIcon = { IconButton(onClick = onNavigateBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Back") } },
                actions = {
                    TextButton(onClick = { save() }, enabled = !state.isLoading) {
                        Text("Save", style = SpentyType.Headline, color = SpentyPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Required
            SectionCard(title = "Required") {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Customer Name *") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words)
                )
                if (showValidation && !isNameValid) {
                    Text("Name is required.", style = SpentyType.Caption1, color = SpentyError)
                }
            }

            // Contact
            SectionCard(title = "Contact") {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Phone") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = gstin,
                    onValueChange = { gstin = it },
                    label = { Text("GSTIN") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters)
                )
            }

            // Addresses
            SectionCard(title = "Addresses") {
                OutlinedTextField(
                    value = billingAddress,
                    onValueChange = { billingAddress = it },
                    label = { Text("Billing Address") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    minLines = 2,
                    maxLines = 4
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = shippingAddress,
                    onValueChange = { shippingAddress = it },
                    label = { Text("Shipping Address") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    minLines = 2,
                    maxLines = 4
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
