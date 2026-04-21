package com.spentyai.app.features.purchases

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.formatCurrency
import com.spentyai.app.core.models.Bill
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentySuccess
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.features.invoices.SectionCard
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private val PAYMENT_METHODS = listOf("Bank Transfer", "Cash", "Cheque", "UPI", "Card", "Other")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecordBillPaymentScreen(
    bill: Bill,
    viewModel: PurchasesViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val balanceDue = maxOf(bill.total - bill.amountPaid, 0.0)

    var amountText by remember { mutableStateOf(balanceDue.toBigDecimal().stripTrailingZeros().toPlainString()) }
    var paymentDate by remember { mutableStateOf(LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)) }
    var selectedMethod by remember { mutableStateOf("Bank Transfer") }
    var selectedAccountId by remember { mutableStateOf<String?>(null) }
    var notes by remember { mutableStateOf("") }
    var showValidation by remember { mutableStateOf(false) }
    var methodExpanded by remember { mutableStateOf(false) }
    var accountExpanded by remember { mutableStateOf(false) }

    val amount = amountText.toDoubleOrNull() ?: 0.0
    val isAmountValid = amount > 0 && amount <= balanceDue + 0.01

    fun save() {
        showValidation = true
        if (!isAmountValid) return
        val payload = buildJsonObject {
            put("amount", amount)
            put("date", paymentDate)
            put("payment_method", selectedMethod)
            selectedAccountId?.let { put("account_id", it) }
            if (notes.isNotBlank()) put("notes", notes.trim())
        }
        viewModel.recordPayment(bill.id, payload) { onNavigateBack() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Record Payment", style = SpentyType.Headline) },
                navigationIcon = { IconButton(onClick = onNavigateBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Back") } },
                actions = { TextButton(onClick = { save() }) { Text("Save", style = SpentyType.Headline, color = SpentyPrimary) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Bill Summary
            SectionCard(title = "Bill Summary") {
                SummaryRow("Bill", bill.billNumber ?: "Draft")
                SummaryRow("Vendor", bill.vendorName ?: "--")
                SummaryRow("Bill Total", formatCurrency(bill.total))
                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Amount Paid", style = SpentyType.Body, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(formatCurrency(bill.amountPaid), style = SpentyType.Body, color = SpentySuccess)
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Balance Due", style = SpentyType.Headline)
                    Text(formatCurrency(balanceDue), style = SpentyType.Title3, color = if (balanceDue > 0) SpentyError else SpentySuccess)
                }
            }

            // Payment Details
            SectionCard(title = "Payment Details") {
                OutlinedTextField(
                    value = amountText, onValueChange = { amountText = it },
                    label = { Text("Amount") }, modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors(),
                    singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    prefix = { Text("₹ ") }
                )
                if (showValidation && !isAmountValid) {
                    Text(
                        if (amount <= 0) "Amount must be greater than zero." else "Amount cannot exceed balance due.",
                        style = SpentyType.Caption1, color = SpentyError
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = try { LocalDate.parse(paymentDate).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)) } catch (_: Exception) { paymentDate },
                    onValueChange = {}, readOnly = true, label = { Text("Payment Date") },
                    modifier = Modifier.fillMaxWidth(), shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(), singleLine = true, enabled = false
                )
                Spacer(modifier = Modifier.height(8.dp))

                ExposedDropdownMenuBox(expanded = methodExpanded, onExpandedChange = { methodExpanded = it }) {
                    OutlinedTextField(
                        value = selectedMethod, onValueChange = {}, readOnly = true,
                        label = { Text("Payment Method") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(methodExpanded) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
                        shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors()
                    )
                    ExposedDropdownMenu(expanded = methodExpanded, onDismissRequest = { methodExpanded = false }) {
                        PAYMENT_METHODS.forEach { method ->
                            DropdownMenuItem(text = { Text(method) }, onClick = { selectedMethod = method; methodExpanded = false })
                        }
                    }
                }
            }

            // Account
            SectionCard(title = "Pay From Account") {
                if (state.accounts.isEmpty()) {
                    Text("No accounts loaded", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else {
                    ExposedDropdownMenuBox(expanded = accountExpanded, onExpandedChange = { accountExpanded = it }) {
                        OutlinedTextField(
                            value = state.accounts.find { it.id == selectedAccountId }?.name ?: "Select Account",
                            onValueChange = {}, readOnly = true, label = { Text("Account") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(accountExpanded) },
                            modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
                            shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors()
                        )
                        ExposedDropdownMenu(expanded = accountExpanded, onDismissRequest = { accountExpanded = false }) {
                            DropdownMenuItem(text = { Text("None") }, onClick = { selectedAccountId = null; accountExpanded = false })
                            state.accounts.forEach { account ->
                                DropdownMenuItem(text = { Text(account.name ?: "Unnamed") }, onClick = { selectedAccountId = account.id; accountExpanded = false })
                            }
                        }
                    }
                }
            }

            // Notes
            SectionCard(title = "Notes") {
                OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Payment notes (optional)") }, modifier = Modifier.fillMaxWidth(), shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors(), minLines = 2, maxLines = 4)
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = SpentyType.Body, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = SpentyType.Body)
    }
}
