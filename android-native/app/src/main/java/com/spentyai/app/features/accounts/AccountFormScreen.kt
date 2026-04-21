package com.spentyai.app.features.accounts

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.models.Account
import com.spentyai.app.core.theme.*
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountFormScreen(
    viewModel: AccountsViewModel,
    account: Account?,
    onDismiss: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val isEditing = account != null

    var name by remember { mutableStateOf(account?.name ?: "") }
    var accountType by remember { mutableStateOf(account?.accountType?.lowercase() ?: "asset") }
    var subType by remember { mutableStateOf(account?.subType ?: "") }
    var accountNumber by remember { mutableStateOf(account?.accountNumber ?: "") }
    var openingBalance by remember { mutableStateOf(account?.openingBalance?.toString() ?: "") }
    var balanceAsOfDate by remember { mutableStateOf(
        account?.balanceAsOfDate ?: SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    ) }
    var currency by remember { mutableStateOf(account?.currency ?: "INR") }
    var descriptionText by remember { mutableStateOf(account?.description ?: "") }

    // Loan fields
    var loanInterestRate by remember { mutableStateOf(account?.loanInterestRate?.toString() ?: "") }
    var loanTenureMonths by remember { mutableStateOf(account?.loanTenureMonths?.toString() ?: "") }
    var loanEmiAmount by remember { mutableStateOf(account?.loanEmiAmount?.toString() ?: "") }
    var loanEmiDay by remember { mutableStateOf(account?.loanEmiDay?.toString() ?: "") }
    var loanSanctionedAmount by remember { mutableStateOf(account?.loanSanctionedAmount?.toString() ?: "") }

    // Demat
    var brokerName by remember { mutableStateOf(account?.brokerName ?: "") }

    val isLiability = accountType.lowercase() == "liability"
    val isInvestment = accountType.lowercase() == "investment"
    val isDematSubType = subType.lowercase().let { it.contains("demat") || it.contains("dmat") }
    val isFormValid = name.trim().isNotEmpty()

    val filteredSubTypes = viewModel.subTypesForType(accountType)
    val currencies = listOf("INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY")

    var expandedType by remember { mutableStateOf(false) }
    var expandedSubType by remember { mutableStateOf(false) }
    var expandedCurrency by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.background,
        sheetMaxWidth = BottomSheetDefaults.SheetMaxWidth,
        dragHandle = null
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            if (isEditing) "Edit Account" else "New Account",
                            style = SpentyType.Headline
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Filled.Close, contentDescription = "Cancel")
                        }
                    },
                    actions = {
                        TextButton(
                            onClick = {
                                val payload = mutableMapOf<String, Any?>(
                                    "name" to name.trim(),
                                    "accountType" to accountType,
                                    "currency" to currency
                                )
                                if (subType.isNotEmpty()) payload["subType"] = subType
                                if (accountNumber.isNotEmpty()) payload["accountNumber"] = accountNumber
                                openingBalance.toDoubleOrNull()?.let { payload["openingBalance"] = it }
                                payload["balanceAsOfDate"] = balanceAsOfDate
                                if (descriptionText.isNotEmpty()) payload["description"] = descriptionText

                                if (isLiability) {
                                    loanInterestRate.toDoubleOrNull()?.let { payload["loanInterestRate"] = it }
                                    loanTenureMonths.toIntOrNull()?.let { payload["loanTenureMonths"] = it }
                                    loanEmiAmount.toDoubleOrNull()?.let { payload["loanEmiAmount"] = it }
                                    loanEmiDay.toIntOrNull()?.let { payload["loanEmiDay"] = it }
                                    loanSanctionedAmount.toDoubleOrNull()?.let { payload["loanSanctionedAmount"] = it }
                                }

                                if (isInvestment && isDematSubType && brokerName.isNotEmpty()) {
                                    payload["brokerName"] = brokerName
                                }

                                viewModel.saveAccount(payload, account?.id)
                            },
                            enabled = isFormValid && !state.isSaving
                        ) {
                            Text(
                                if (isEditing) "Save" else "Add",
                                style = SpentyType.Headline.copy(fontWeight = FontWeight.SemiBold),
                                color = if (isFormValid) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
                )
            },
            containerColor = MaterialTheme.colorScheme.background
        ) { innerPadding ->
            Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Basic Information Section
                    Text("Basic Information", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.onSurfaceVariant)

                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Account Name") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors(),
                        textStyle = SpentyType.Body
                    )

                    // Account Type picker
                    ExposedDropdownMenuBox(
                        expanded = expandedType,
                        onExpandedChange = { expandedType = !expandedType }
                    ) {
                        OutlinedTextField(
                            value = accountType.replaceFirstChar { it.uppercase() },
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Account Type") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedType) },
                            modifier = Modifier.fillMaxWidth().menuAnchor(),
                            shape = SpentyStyle.inputShape,
                            colors = SpentyStyle.inputColors()
                        )
                        ExposedDropdownMenu(expanded = expandedType, onDismissRequest = { expandedType = false }) {
                            AccountsViewModel.ACCOUNT_TYPES.forEach { type ->
                                DropdownMenuItem(
                                    text = { Text(type.replaceFirstChar { it.uppercase() }) },
                                    onClick = {
                                        accountType = type
                                        subType = ""
                                        expandedType = false
                                    }
                                )
                            }
                        }
                    }

                    // Sub-type picker or text field
                    if (filteredSubTypes.isEmpty()) {
                        OutlinedTextField(
                            value = subType,
                            onValueChange = { subType = it },
                            label = { Text("Sub-Type") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = SpentyStyle.inputShape,
                            colors = SpentyStyle.inputColors(),
                            textStyle = SpentyType.Body
                        )
                    } else {
                        ExposedDropdownMenuBox(
                            expanded = expandedSubType,
                            onExpandedChange = { expandedSubType = !expandedSubType }
                        ) {
                            OutlinedTextField(
                                value = if (subType.isEmpty()) "None" else subType,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Sub-Type") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedSubType) },
                                modifier = Modifier.fillMaxWidth().menuAnchor(),
                                shape = SpentyStyle.inputShape,
                                colors = SpentyStyle.inputColors()
                            )
                            ExposedDropdownMenu(expanded = expandedSubType, onDismissRequest = { expandedSubType = false }) {
                                DropdownMenuItem(
                                    text = { Text("None") },
                                    onClick = { subType = ""; expandedSubType = false }
                                )
                                filteredSubTypes.forEach { st ->
                                    DropdownMenuItem(
                                        text = { Text(st.name ?: "") },
                                        onClick = { subType = st.name ?: ""; expandedSubType = false }
                                    )
                                }
                            }
                        }
                    }

                    OutlinedTextField(
                        value = accountNumber,
                        onValueChange = { accountNumber = it },
                        label = { Text("Account Number") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors(),
                        textStyle = SpentyType.Body
                    )

                    // Currency picker
                    ExposedDropdownMenuBox(
                        expanded = expandedCurrency,
                        onExpandedChange = { expandedCurrency = !expandedCurrency }
                    ) {
                        OutlinedTextField(
                            value = currency,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Currency") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedCurrency) },
                            modifier = Modifier.fillMaxWidth().menuAnchor(),
                            shape = SpentyStyle.inputShape,
                            colors = SpentyStyle.inputColors()
                        )
                        ExposedDropdownMenu(expanded = expandedCurrency, onDismissRequest = { expandedCurrency = false }) {
                            currencies.forEach { code ->
                                DropdownMenuItem(
                                    text = { Text(code) },
                                    onClick = { currency = code; expandedCurrency = false }
                                )
                            }
                        }
                    }

                    // Balance Section
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                    Text("Balance", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.onSurfaceVariant)

                    OutlinedTextField(
                        value = openingBalance,
                        onValueChange = { openingBalance = it },
                        label = { Text("Opening Balance") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors(),
                        textStyle = SpentyType.AmountSmall
                    )

                    OutlinedTextField(
                        value = balanceAsOfDate,
                        onValueChange = { balanceAsOfDate = it },
                        label = { Text("Balance As-of Date (YYYY-MM-DD)") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors(),
                        textStyle = SpentyType.Body
                    )

                    // Loan Section (conditional)
                    if (isLiability) {
                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        Text("Loan Details", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = SpentyError)

                        FormNumberField("Interest Rate (%)", loanInterestRate) { loanInterestRate = it }
                        FormNumberField("Tenure (Months)", loanTenureMonths, isDecimal = false) { loanTenureMonths = it }
                        FormNumberField("EMI Amount", loanEmiAmount) { loanEmiAmount = it }
                        FormNumberField("EMI Day (1-31)", loanEmiDay, isDecimal = false) { loanEmiDay = it }
                        FormNumberField("Sanctioned Amount", loanSanctionedAmount) { loanSanctionedAmount = it }
                    }

                    // Demat Section (conditional)
                    if (isInvestment && isDematSubType) {
                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        Text("Demat Details", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = SpentyWarning)

                        OutlinedTextField(
                            value = brokerName,
                            onValueChange = { brokerName = it },
                            label = { Text("Broker Name") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = SpentyStyle.inputShape,
                            colors = SpentyStyle.inputColors(),
                            textStyle = SpentyType.Body
                        )
                    }

                    // Notes Section
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                    Text("Notes", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.onSurfaceVariant)

                    OutlinedTextField(
                        value = descriptionText,
                        onValueChange = { descriptionText = it },
                        label = { Text("Description / Notes") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors(),
                        textStyle = SpentyType.Body,
                        minLines = 3,
                        maxLines = 6
                    )

                    Spacer(modifier = Modifier.height(32.dp))
                }

                // Saving overlay
                if (state.isSaving) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = SpentyPrimary)
                    }
                }
            }
        }
    }
}

@Composable
private fun FormNumberField(
    label: String,
    value: String,
    isDecimal: Boolean = true,
    onValueChange: (String) -> Unit
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        keyboardOptions = KeyboardOptions(
            keyboardType = if (isDecimal) KeyboardType.Decimal else KeyboardType.Number
        ),
        modifier = Modifier.fillMaxWidth(),
        shape = SpentyStyle.inputShape,
        colors = SpentyStyle.inputColors(),
        textStyle = SpentyType.AmountSmall
    )
}
