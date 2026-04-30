package com.spentyai.app.core.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Label
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.models.Account
import com.spentyai.app.core.models.Category
import com.spentyai.app.core.models.CategoryType
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.features.accounts.AccountRepository
import com.spentyai.app.features.categories.CategoryRepository
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Mirror of iOS UnifiedTransactionForm inline-create alerts. Used by
 * TransactionFormScreen (P0 #12) and PendingReviewScreen's EditTransactionSheet
 * (P0 #15). Each dialog hits the same backend endpoints used elsewhere.
 *
 * On success, [onCreated] receives the freshly-created entity so the caller
 * can append it to its local list and select it as the form value.
 */
@Composable
fun CreateAccountDialog(
    apiClient: ApiClient,
    onDismiss: () -> Unit,
    onCreated: (Account) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var subType by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val repository = remember(apiClient) { AccountRepository(apiClient) }

    AlertDialog(
        onDismissRequest = { if (!isSaving) onDismiss() },
        icon = { Icon(Icons.Filled.AccountBalance, contentDescription = null, tint = SpentyPrimary) },
        title = { Text("New Account", style = SpentyType.Headline) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; error = null },
                    label = { Text("Account Name") },
                    placeholder = { Text("e.g. ICICI Savings") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words)
                )
                OutlinedTextField(
                    value = subType,
                    onValueChange = { subType = it },
                    label = { Text("Sub-type (optional)") },
                    placeholder = { Text("e.g. Savings, Credit Card") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words)
                )
                error?.let {
                    Text(it, style = SpentyType.Footnote, color = SpentyError)
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !isSaving && name.isNotBlank(),
                onClick = {
                    isSaving = true
                    error = null
                    val payload = JsonObject(
                        buildMap {
                            put("name", JsonPrimitive(name.trim()))
                            // Default to "asset" — server fills in further fields
                            put("accountType", JsonPrimitive("asset"))
                            if (subType.isNotBlank()) {
                                put("subType", JsonPrimitive(subType.trim()))
                            }
                        }
                    )
                    scope.launch {
                        when (val r = repository.createAccount(payload)) {
                            is ApiResult.Success -> {
                                isSaving = false
                                onCreated(r.data)
                            }
                            is ApiResult.Failure -> {
                                isSaving = false
                                error = r.error.message ?: "Failed to create account"
                            }
                        }
                    }
                }
            ) {
                Text(if (isSaving) "Creating..." else "Create", color = SpentyPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = { if (!isSaving) onDismiss() }) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun CreateCategoryDialog(
    apiClient: ApiClient,
    transactionType: String,
    onDismiss: () -> Unit,
    onCreated: (Category) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val repository = remember(apiClient) { CategoryRepository(apiClient) }
    // Transfer txns can use either income or expense categories — default to expense.
    val categoryType = remember(transactionType) {
        when (transactionType.lowercase()) {
            "income" -> CategoryType.INCOME
            else -> CategoryType.EXPENSE
        }
    }

    AlertDialog(
        onDismissRequest = { if (!isSaving) onDismiss() },
        icon = { Icon(Icons.Filled.Label, contentDescription = null, tint = SpentyPrimary) },
        title = { Text("New Category", style = SpentyType.Headline) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; error = null },
                    label = { Text("Category Name") },
                    placeholder = { Text("e.g. Groceries, Salary") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words)
                )
                Text(
                    "Will be created as ${categoryType.value.replaceFirstChar { it.uppercase() }} category",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                error?.let {
                    Text(it, style = SpentyType.Footnote, color = SpentyError)
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !isSaving && name.isNotBlank(),
                onClick = {
                    isSaving = true
                    error = null
                    scope.launch {
                        when (val r = repository.createCategory(name.trim(), categoryType, null)) {
                            is ApiResult.Success -> {
                                isSaving = false
                                onCreated(r.data)
                            }
                            is ApiResult.Failure -> {
                                isSaving = false
                                error = r.error.message ?: "Failed to create category"
                            }
                        }
                    }
                }
            ) {
                Text(if (isSaving) "Creating..." else "Create", color = SpentyPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = { if (!isSaving) onDismiss() }) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun CreateSubcategoryDialog(
    apiClient: ApiClient,
    parentCategoryId: String,
    parentCategoryName: String,
    transactionType: String,
    onDismiss: () -> Unit,
    onCreated: (Category) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val repository = remember(apiClient) { CategoryRepository(apiClient) }
    val categoryType = remember(transactionType) {
        when (transactionType.lowercase()) {
            "income" -> CategoryType.INCOME
            else -> CategoryType.EXPENSE
        }
    }

    AlertDialog(
        onDismissRequest = { if (!isSaving) onDismiss() },
        icon = { Icon(Icons.Filled.Sell, contentDescription = null, tint = SpentyPrimary) },
        title = { Text("New Subcategory", style = SpentyType.Headline) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; error = null },
                    label = { Text("Subcategory Name") },
                    placeholder = { Text("e.g. Vegetables") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words)
                )
                Text(
                    "Under: $parentCategoryName",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                error?.let {
                    Text(it, style = SpentyType.Footnote, color = SpentyError)
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !isSaving && name.isNotBlank(),
                onClick = {
                    isSaving = true
                    error = null
                    scope.launch {
                        when (val r = repository.createCategory(name.trim(), categoryType, parentCategoryId)) {
                            is ApiResult.Success -> {
                                isSaving = false
                                onCreated(r.data)
                            }
                            is ApiResult.Failure -> {
                                isSaving = false
                                error = r.error.message ?: "Failed to create subcategory"
                            }
                        }
                    }
                }
            ) {
                Text(if (isSaving) "Creating..." else "Create", color = SpentyPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = { if (!isSaving) onDismiss() }) {
                Text("Cancel")
            }
        }
    )
}
