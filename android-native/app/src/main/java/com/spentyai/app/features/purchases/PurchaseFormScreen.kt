package com.spentyai.app.features.purchases

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.formatCurrency
import com.spentyai.app.core.models.Bill
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.features.invoices.SectionCard
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PurchaseFormScreen(
    viewModel: PurchasesViewModel,
    editingBill: Bill? = null,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val isEditing = editingBill != null

    var billNumber by remember { mutableStateOf(editingBill?.billNumber ?: "") }
    var selectedVendorId by remember { mutableStateOf(editingBill?.vendorId) }
    var vendorName by remember { mutableStateOf(editingBill?.vendorName ?: "") }
    var issueDate by remember { mutableStateOf(editingBill?.issueDate?.take(10) ?: LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)) }
    var dueDate by remember { mutableStateOf(editingBill?.dueDate?.take(10) ?: LocalDate.now().plusDays(30).format(DateTimeFormatter.ISO_LOCAL_DATE)) }
    val lineItems = remember {
        mutableStateListOf<PurchaseFormLineItem>().apply {
            if (editingBill?.lineItems != null && editingBill.lineItems.isNotEmpty()) {
                addAll(editingBill.lineItems.map { item ->
                    PurchaseFormLineItem(
                        description = item.description,
                        quantity = item.quantity,
                        rate = item.unitPrice,
                        taxRate = item.taxRate ?: 0.0
                    )
                })
            } else {
                add(PurchaseFormLineItem())
            }
        }
    }
    var notes by remember { mutableStateOf(editingBill?.notes ?: "") }
    var showValidation by remember { mutableStateOf(false) }
    var vendorExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(isEditing) {
        if (!isEditing && billNumber.isBlank()) {
            billNumber = "BILL-${(state.bills.size + 1).toString().padStart(3, '0')}"
        }
    }

    val subtotal = lineItems.sumOf { it.computedAmount }
    val taxAmount = lineItems.sumOf { it.taxAmount }
    val grandTotal = subtotal + taxAmount
    val isValid = vendorName.isNotBlank() && lineItems.any { it.description.isNotBlank() }

    fun save() {
        showValidation = true
        if (!isValid) return
        val payload = buildBillPayload(
            billNumber = billNumber.ifBlank { null },
            vendorId = selectedVendorId,
            vendorName = vendorName.trim(),
            issueDate = issueDate,
            dueDate = dueDate,
            lineItems = lineItems.toList(),
            subtotal = subtotal,
            taxAmount = taxAmount,
            grandTotal = grandTotal,
            notes = notes.trim().ifBlank { null }
        )
        if (isEditing) {
            viewModel.updateBill(editingBill!!.id, payload) { onNavigateBack() }
        } else {
            viewModel.createBill(payload) { onNavigateBack() }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isEditing) "Edit Bill" else "New Bill", style = SpentyType.Headline) },
                navigationIcon = { IconButton(onClick = onNavigateBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Back") } },
                actions = { TextButton(onClick = { save() }, enabled = !state.isLoading) { Text("Save", style = SpentyType.Headline, color = SpentyPrimary) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Bill Details
            SectionCard(title = "Bill Details") {
                OutlinedTextField(
                    value = billNumber,
                    onValueChange = { billNumber = it },
                    label = { Text("Bill Number") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    singleLine = true
                )
            }

            // Vendor
            SectionCard(title = "Vendor") {
                if (state.vendors.isNotEmpty()) {
                    ExposedDropdownMenuBox(expanded = vendorExpanded, onExpandedChange = { vendorExpanded = it }) {
                        OutlinedTextField(
                            value = vendorName.ifBlank { "Select Vendor" },
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
                            label = { Text("Vendor") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(vendorExpanded) },
                            shape = SpentyStyle.inputShape,
                            colors = SpentyStyle.inputColors()
                        )
                        ExposedDropdownMenu(expanded = vendorExpanded, onDismissRequest = { vendorExpanded = false }) {
                            state.vendors.forEach { vendor ->
                                DropdownMenuItem(
                                    text = { Text(vendor.name) },
                                    onClick = {
                                        selectedVendorId = vendor.id
                                        vendorName = vendor.name
                                        vendorExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = vendorName,
                    onValueChange = { vendorName = it },
                    label = { Text("Vendor Name *") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    singleLine = true
                )
                if (showValidation && vendorName.isBlank()) {
                    Text("Vendor name is required.", style = SpentyType.Caption1, color = SpentyError)
                }
            }

            // Dates
            SectionCard(title = "Dates") {
                OutlinedTextField(value = issueDate, onValueChange = { issueDate = it }, label = { Text("Bill Date") }, modifier = Modifier.fillMaxWidth(), shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors(), singleLine = true)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = dueDate, onValueChange = { dueDate = it }, label = { Text("Due Date") }, modifier = Modifier.fillMaxWidth(), shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors(), singleLine = true)
            }

            // Line Items
            SectionCard(title = "Line Items") {
                lineItems.forEachIndexed { index, item ->
                    PurchaseLineItemRow(
                        item = item,
                        onUpdate = { lineItems[index] = it },
                        onDelete = if (lineItems.size > 1) {{ lineItems.removeAt(index) }} else null
                    )
                    if (index < lineItems.size - 1) HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(onClick = { lineItems.add(PurchaseFormLineItem()) }, modifier = Modifier.fillMaxWidth(), shape = SpentyStyle.secondaryButtonShape) {
                    Icon(Icons.Filled.Add, contentDescription = null, tint = SpentyPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Add Line Item", color = SpentyPrimary, style = SpentyType.Subheadline)
                }
                if (showValidation && !lineItems.any { it.description.isNotBlank() }) {
                    Text("At least one line item is required.", style = SpentyType.Caption1, color = SpentyError)
                }
            }

            // Totals
            SectionCard(title = "Totals") {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Subtotal", style = SpentyType.Body, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(formatCurrency(subtotal), style = SpentyType.Body)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Tax", style = SpentyType.Body, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(formatCurrency(taxAmount), style = SpentyType.Body)
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Grand Total", style = SpentyType.Headline)
                    Text(formatCurrency(grandTotal), style = SpentyType.Title3, color = SpentyPrimary)
                }
            }

            // Notes
            SectionCard(title = "Notes") {
                OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes (optional)") }, modifier = Modifier.fillMaxWidth(), shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors(), minLines = 2, maxLines = 4)
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun PurchaseLineItemRow(
    item: PurchaseFormLineItem,
    onUpdate: (PurchaseFormLineItem) -> Unit,
    onDelete: (() -> Unit)?
) {
    Column {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(value = item.description, onValueChange = { onUpdate(item.copy(description = it)) }, label = { Text("Description") }, modifier = Modifier.weight(1f), shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors(), singleLine = true)
            if (onDelete != null) {
                IconButton(onClick = onDelete) { Icon(Icons.Filled.Delete, contentDescription = "Remove", tint = SpentyError) }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = item.hsnSac, onValueChange = { onUpdate(item.copy(hsnSac = it)) }, label = { Text("HSN/SAC Code") }, modifier = Modifier.fillMaxWidth(), shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors(), singleLine = true)
        Spacer(modifier = Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(value = if (item.quantity == 0.0) "" else item.quantity.toBigDecimal().stripTrailingZeros().toPlainString(), onValueChange = { onUpdate(item.copy(quantity = it.toDoubleOrNull() ?: 0.0)) }, label = { Text("Qty") }, modifier = Modifier.weight(1f), shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
            OutlinedTextField(value = if (item.rate == 0.0) "" else item.rate.toBigDecimal().stripTrailingZeros().toPlainString(), onValueChange = { onUpdate(item.copy(rate = it.toDoubleOrNull() ?: 0.0)) }, label = { Text("Rate") }, modifier = Modifier.weight(1.5f), shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
            OutlinedTextField(value = if (item.taxRate == 0.0) "" else item.taxRate.toBigDecimal().stripTrailingZeros().toPlainString(), onValueChange = { onUpdate(item.copy(taxRate = it.toDoubleOrNull() ?: 0.0)) }, label = { Text("Tax %") }, modifier = Modifier.weight(1f), shape = SpentyStyle.inputShape, colors = SpentyStyle.inputColors(), singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
        }
        Spacer(modifier = Modifier.height(4.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Text("Amount: ${formatCurrency(item.lineTotal)}", style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold), color = SpentyPrimary)
        }
    }
}
