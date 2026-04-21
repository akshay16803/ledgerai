package com.spentyai.app.features.transactions

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spentyai.app.core.models.Account
import com.spentyai.app.core.models.Category
import com.spentyai.app.core.models.Transaction
import com.spentyai.app.core.theme.*
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionFormScreen(
    viewModel: TransactionsViewModel,
    transaction: Transaction?,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val isEditing = transaction != null

    // Form state
    var transactionType by remember { mutableStateOf(transaction?.transactionType ?: "expense") }
    var amount by remember { mutableStateOf(transaction?.amount?.let { String.format("%.2f", it) } ?: "") }
    var accountId by remember { mutableStateOf(transaction?.accountId ?: "") }
    var toAccountId by remember { mutableStateOf(transaction?.toAccountId ?: "") }
    var categoryId by remember { mutableStateOf(transaction?.categoryId ?: "") }
    var subcategoryId by remember { mutableStateOf(transaction?.subcategoryId ?: "") }
    var dateText by remember { mutableStateOf(transaction?.date?.take(10) ?: "") }
    var descriptionText by remember { mutableStateOf(transaction?.description ?: "") }
    var paymentMethod by remember { mutableStateOf(normalizePaymentMethod(transaction?.paymentMethod ?: "")) }
    var isRecurring by remember { mutableStateOf(transaction?.isRecurring ?: false) }
    var recurringFrequency by remember { mutableStateOf(transaction?.recurringFrequency ?: "monthly") }
    var recurrenceDate by remember { mutableStateOf(transaction?.recurrenceDate?.toString() ?: "") }

    var isSaving by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val isTransfer = transactionType == "transfer"

    val transactionTypes = listOf("income", "expense", "transfer")
    val paymentMethods = listOf("Cash", "UPI", "Bank Transfer", "Credit Card", "Debit Card", "Cheque", "Net Banking", "Wallet", "Other")
    val frequencies = listOf("daily", "weekly", "monthly", "quarterly", "yearly")
    val frequencyLabels = mapOf(
        "daily" to "Daily", "weekly" to "Weekly", "monthly" to "Monthly",
        "quarterly" to "Quarterly", "yearly" to "Yearly"
    )

    val filteredCategories = state.categories.filter { cat ->
        val catType = cat.categoryType?.lowercase() ?: return@filter true
        if (transactionType == "transfer") true
        else catType == transactionType
    }

    val subcategories = viewModel.subcategories(categoryId.ifEmpty { null })

    val typeAccentColor = when (transactionType) {
        "income" -> SpentySuccess
        "expense" -> SpentyError
        "transfer" -> SpentyInfo
        else -> SpentyPrimary
    }

    val canSave = !isSaving && amount.isNotEmpty() && accountId.isNotEmpty() && (isTransfer || categoryId.isNotEmpty())

    fun doSave() {
        val parsedAmount = amount.toDoubleOrNull()
        if (parsedAmount == null || parsedAmount <= 0) {
            errorMessage = "Please enter a valid amount."
            return
        }
        if (accountId.isEmpty()) {
            errorMessage = "Please select an account."
            return
        }
        if (!isTransfer && categoryId.isEmpty()) {
            errorMessage = "Please select a category."
            return
        }
        if (isTransfer && toAccountId.isEmpty()) {
            errorMessage = "Please select a destination account."
            return
        }

        isSaving = true
        errorMessage = null

        val fields = mutableMapOf<String, kotlinx.serialization.json.JsonElement>(
            "transactionType" to JsonPrimitive(transactionType),
            "amount" to JsonPrimitive(parsedAmount),
            "accountId" to JsonPrimitive(accountId),
            "status" to JsonPrimitive(transaction?.status ?: "approved"),
            "isRecurring" to JsonPrimitive(isRecurring),
            "source" to JsonPrimitive(transaction?.source ?: "manual")
        )

        if (isTransfer && toAccountId.isNotEmpty()) {
            fields["toAccountId"] = JsonPrimitive(toAccountId)
        }
        if (categoryId.isNotEmpty()) {
            fields["categoryId"] = JsonPrimitive(categoryId)
        }
        if (subcategoryId.isNotEmpty()) {
            fields["subcategoryId"] = JsonPrimitive(subcategoryId)
        }
        if (dateText.isNotEmpty()) {
            fields["date"] = JsonPrimitive(dateText)
        }
        if (descriptionText.isNotEmpty()) {
            fields["description"] = JsonPrimitive(descriptionText)
        }
        if (paymentMethod.isNotEmpty()) {
            fields["paymentMethod"] = JsonPrimitive(paymentMethod)
        }
        if (isRecurring) {
            fields["recurringFrequency"] = JsonPrimitive(recurringFrequency)
            recurrenceDate.toIntOrNull()?.let {
                fields["recurrenceDate"] = JsonPrimitive(it)
            }
        }

        val payload = JsonObject(fields)
        viewModel.saveTransaction(
            payload = payload,
            editId = transaction?.id,
            onSuccess = {
                isSaving = false
                onSaved()
            },
            onError = { msg ->
                isSaving = false
                errorMessage = msg
            }
        )
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.background,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancel", style = SpentyType.Body, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(
                    text = if (isEditing) "Edit Transaction" else "New Transaction",
                    style = SpentyType.Headline
                )
                TextButton(onClick = { doSave() }, enabled = canSave) {
                    Text(
                        text = if (isEditing) "Save" else "Create",
                        style = SpentyType.Headline,
                        fontWeight = FontWeight.SemiBold,
                        color = if (canSave) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Type selector (segmented control)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(3.dp)
            ) {
                transactionTypes.forEach { type ->
                    val isSelected = transactionType == type
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (isSelected) typeAccentColor else Color.Transparent)
                            .clickable {
                                transactionType = type
                                categoryId = ""
                                subcategoryId = ""
                            }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = type.replaceFirstChar { it.uppercase() },
                            style = SpentyType.Subheadline.copy(
                                fontSize = 14.sp,
                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                            ),
                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Amount hero
            ElevatedCard(
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation(),
                shape = SpentyStyle.cardShape
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "\u20B9",
                            style = SpentyType.AmountMedium,
                            color = typeAccentColor
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        OutlinedTextField(
                            value = amount,
                            onValueChange = { newValue ->
                                if (newValue.isEmpty() || newValue.matches(Regex("^\\d*\\.?\\d{0,2}$"))) {
                                    amount = newValue
                                }
                            },
                            placeholder = { Text("0.00", style = SpentyType.AmountLarge) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            textStyle = SpentyType.AmountLarge.copy(textAlign = TextAlign.Center),
                            modifier = Modifier.widthIn(max = 200.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color.Transparent,
                                unfocusedBorderColor = Color.Transparent
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = when (transactionType) {
                            "transfer" -> "Transfer amount"
                            "income" -> "Money received"
                            else -> "Money spent"
                        },
                        style = SpentyType.Footnote,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Details section
            FormSectionLabel("DETAILS")
            Spacer(modifier = Modifier.height(8.dp))

            ElevatedCard(
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation(),
                shape = SpentyStyle.cardShape
            ) {
                Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                    // Date
                    FormRow(icon = Icons.Outlined.DateRange, label = "Date") {
                        OutlinedTextField(
                            value = dateText,
                            onValueChange = { dateText = it },
                            placeholder = { Text("yyyy-MM-dd", style = SpentyType.Body) },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                            textStyle = SpentyType.Body.copy(textAlign = TextAlign.End),
                            shape = RoundedCornerShape(8.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color.Transparent,
                                unfocusedBorderColor = Color.Transparent
                            )
                        )
                    }

                    FormDivider()

                    // Account
                    FormRow(icon = Icons.Outlined.AccountBalance, label = if (isTransfer) "From" else "Account") {
                        DropdownPicker(
                            selectedId = accountId,
                            items = state.accounts.map { it.id to (it.name ?: "Unnamed") },
                            placeholder = "Select",
                            onSelect = { accountId = it }
                        )
                        IconButton(
                            onClick = { /* Inline account creation -- refresh after */ },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(Icons.Filled.AddCircle, contentDescription = "Add Account", tint = SpentyPrimary.copy(alpha = 0.7f))
                        }
                    }

                    if (isTransfer) {
                        FormDivider()
                        FormRow(icon = Icons.Outlined.ArrowForward, label = "To") {
                            DropdownPicker(
                                selectedId = toAccountId,
                                items = state.accounts.filter { it.id != accountId }.map { it.id to (it.name ?: "Unnamed") },
                                placeholder = "Select",
                                onSelect = { toAccountId = it }
                            )
                        }
                    }

                    FormDivider()

                    // Payment method
                    FormRow(icon = Icons.Outlined.CreditCard, label = "Payment") {
                        DropdownPicker(
                            selectedId = paymentMethod,
                            items = paymentMethods.map { it to it },
                            placeholder = "Select",
                            onSelect = { paymentMethod = it }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Category section
            FormSectionLabel("CATEGORY")
            Spacer(modifier = Modifier.height(8.dp))

            ElevatedCard(
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation(),
                shape = SpentyStyle.cardShape
            ) {
                Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                    // Category
                    FormRow(icon = Icons.Outlined.Label, label = "Category") {
                        DropdownPicker(
                            selectedId = categoryId,
                            items = filteredCategories.map { it.id to (it.name ?: "Unnamed") },
                            placeholder = "Select",
                            onSelect = { newCatId ->
                                if (categoryId.isNotEmpty() && categoryId != newCatId) {
                                    subcategoryId = ""
                                }
                                categoryId = newCatId
                            }
                        )
                        IconButton(
                            onClick = { /* Inline category creation -- refresh after */ },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(Icons.Filled.AddCircle, contentDescription = "Add Category", tint = SpentyPrimary.copy(alpha = 0.7f))
                        }
                    }

                    if (subcategories.isNotEmpty() || categoryId.isNotEmpty()) {
                        FormDivider()
                        FormRow(icon = Icons.Outlined.Sell, label = "Subcategory") {
                            DropdownPicker(
                                selectedId = subcategoryId,
                                items = subcategories.map { it.id to (it.name ?: "Unnamed") },
                                placeholder = "None",
                                onSelect = { subcategoryId = it }
                            )
                            if (categoryId.isNotEmpty()) {
                                IconButton(
                                    onClick = { /* Inline subcategory creation -- refresh after */ },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Filled.AddCircle, contentDescription = "Add Subcategory", tint = SpentyPrimary.copy(alpha = 0.7f))
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Note section
            FormSectionLabel("NOTE")
            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = descriptionText,
                onValueChange = { descriptionText = it },
                placeholder = { Text("Add a note...", style = SpentyType.Body) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = {
                    Icon(Icons.Outlined.Notes, contentDescription = null, tint = SpentyPrimary)
                },
                shape = SpentyStyle.inputShape,
                colors = SpentyStyle.inputColors()
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Recurring section
            FormSectionLabel("RECURRING")
            Spacer(modifier = Modifier.height(8.dp))

            ElevatedCard(
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation(),
                shape = SpentyStyle.cardShape
            ) {
                Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                    // Toggle
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Outlined.Repeat,
                                contentDescription = null,
                                tint = SpentyPrimary,
                                modifier = Modifier.size(20.dp)
                            )
                            Text("Repeat", style = SpentyType.Body)
                        }
                        Switch(
                            checked = isRecurring,
                            onCheckedChange = { isRecurring = it },
                            colors = SwitchDefaults.colors(checkedTrackColor = SpentyPrimary)
                        )
                    }

                    if (isRecurring) {
                        FormDivider()

                        // Frequency chips
                        Column(modifier = Modifier.padding(vertical = 12.dp)) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Outlined.Schedule,
                                    contentDescription = null,
                                    tint = SpentyPrimary.copy(alpha = 0.6f),
                                    modifier = Modifier.size(20.dp)
                                )
                                Text("Frequency", style = SpentyType.Body)
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant)
                                    .padding(3.dp)
                            ) {
                                frequencies.forEach { freq ->
                                    val isSelected = recurringFrequency == freq
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (isSelected) SpentyPrimary else Color.Transparent)
                                            .clickable { recurringFrequency = freq }
                                            .padding(vertical = 9.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = frequencyLabels[freq] ?: freq.replaceFirstChar { it.uppercase() },
                                            style = SpentyType.Caption1.copy(
                                                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                                            ),
                                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }
                        }

                        FormDivider()

                        // Recurrence day
                        FormRow(icon = Icons.Outlined.Tag, label = "Day") {
                            OutlinedTextField(
                                value = recurrenceDate,
                                onValueChange = { recurrenceDate = it },
                                placeholder = { Text("1-31") },
                                singleLine = true,
                                modifier = Modifier.width(80.dp),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                textStyle = SpentyType.Body.copy(textAlign = TextAlign.End),
                                shape = RoundedCornerShape(8.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = Color.Transparent,
                                    unfocusedBorderColor = Color.Transparent
                                )
                            )
                        }
                    }
                }
            }

            // Error message
            errorMessage?.let { msg ->
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = msg,
                    style = SpentyType.Footnote,
                    color = SpentyError,
                    modifier = Modifier.padding(horizontal = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Save button
            Button(
                onClick = { doSave() },
                modifier = SpentyStyle.primaryButtonModifier,
                colors = SpentyStyle.primaryButtonColors(),
                shape = SpentyStyle.primaryButtonShape,
                enabled = canSave
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = if (isEditing) "Save Changes" else "Create Transaction",
                        style = SpentyType.Headline
                    )
                }
            }
        }
    }
}

// MARK: - Form Components

@Composable
private fun FormSectionLabel(text: String) {
    Text(
        text = text,
        style = SpentyType.Caption1.copy(
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.8.sp
        ),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 4.dp)
    )
}

@Composable
private fun FormRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    content: @Composable RowScope.() -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = SpentyPrimary
        )
        Text(
            text = label,
            style = SpentyType.Body,
            modifier = Modifier.widthIn(min = 60.dp)
        )
        Spacer(modifier = Modifier.weight(1f))
        content()
    }
}

@Composable
private fun FormDivider() {
    HorizontalDivider(
        modifier = Modifier.padding(start = 36.dp),
        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
    )
}

@Composable
private fun DropdownPicker(
    selectedId: String,
    items: List<Pair<String, String>>,
    placeholder: String,
    onSelect: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = items.firstOrNull { it.first == selectedId }?.second ?: placeholder

    Box {
        TextButton(onClick = { expanded = true }) {
            Text(
                text = selectedLabel,
                style = SpentyType.Body,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1
            )
            Icon(Icons.Filled.ArrowDropDown, contentDescription = null, modifier = Modifier.size(20.dp))
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text(placeholder, style = SpentyType.Body) },
                onClick = {
                    onSelect("")
                    expanded = false
                }
            )
            items.forEach { (id, label) ->
                DropdownMenuItem(
                    text = { Text(label, style = SpentyType.Body) },
                    onClick = {
                        onSelect(id)
                        expanded = false
                    }
                )
            }
        }
    }
}

// MARK: - Helpers

private fun normalizePaymentMethod(raw: String): String {
    if (raw.isEmpty()) return ""
    val displayValues = listOf("Cash", "UPI", "Bank Transfer", "Credit Card", "Debit Card", "Cheque", "Net Banking", "Wallet", "Other")
    if (raw in displayValues) return raw
    val map = mapOf(
        "cash" to "Cash", "upi" to "UPI", "bank_transfer" to "Bank Transfer",
        "credit_card" to "Credit Card", "debit_card" to "Debit Card",
        "cheque" to "Cheque", "net_banking" to "Net Banking",
        "wallet" to "Wallet", "neft" to "Bank Transfer", "rtgs" to "Bank Transfer",
        "imps" to "Bank Transfer", "other" to "Other"
    )
    return map[raw.lowercase()] ?: raw
}
