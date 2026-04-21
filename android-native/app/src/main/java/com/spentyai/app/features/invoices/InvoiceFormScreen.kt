package com.spentyai.app.features.invoices

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
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
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
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.formatCurrency
import com.spentyai.app.core.models.Customer
import com.spentyai.app.core.models.Invoice
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoiceFormScreen(
    viewModel: InvoicesViewModel,
    editingInvoice: Invoice? = null,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val isEditing = editingInvoice != null

    var invoiceNumber by remember { mutableStateOf(editingInvoice?.invoiceNumber ?: "") }
    var selectedCustomerId by remember { mutableStateOf(editingInvoice?.customerId) }
    var customerName by remember { mutableStateOf(editingInvoice?.customerName ?: "") }
    var issueDate by remember {
        mutableStateOf(
            editingInvoice?.issueDate?.take(10)
                ?: LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        )
    }
    var dueDate by remember {
        mutableStateOf(
            editingInvoice?.dueDate?.take(10)
                ?: LocalDate.now().plusDays(30).format(DateTimeFormatter.ISO_LOCAL_DATE)
        )
    }
    val lineItems = remember {
        mutableStateListOf<InvoiceFormLineItem>().apply {
            if (editingInvoice?.lineItems != null && editingInvoice.lineItems.isNotEmpty()) {
                addAll(editingInvoice.lineItems.map { item ->
                    InvoiceFormLineItem(
                        description = item.description,
                        hsnSac = "",
                        quantity = item.quantity,
                        rate = item.unitPrice,
                        taxPercent = item.taxRate ?: 18.0
                    )
                })
            } else {
                add(InvoiceFormLineItem())
            }
        }
    }
    var notes by remember { mutableStateOf(editingInvoice?.notes ?: "") }
    var terms by remember { mutableStateOf(editingInvoice?.terms ?: "") }
    var showValidation by remember { mutableStateOf(false) }
    var showCustomerPicker by remember { mutableStateOf(false) }
    var showIssueDatePicker by remember { mutableStateOf(false) }
    var showDueDatePicker by remember { mutableStateOf(false) }

    // Auto-populate invoice number if creating new
    LaunchedEffect(isEditing) {
        if (!isEditing && invoiceNumber.isBlank()) {
            // Use a simple generated number
            invoiceNumber = "INV-${(state.invoices.size + 1).toString().padStart(3, '0')}"
        }
    }

    val subtotal = lineItems.sumOf { it.taxableAmount }
    val totalTax = lineItems.sumOf { it.taxAmount }
    val cgst = totalTax / 2.0
    val sgst = totalTax / 2.0
    val igst = 0.0
    val grandTotal = subtotal + totalTax

    val isValid = invoiceNumber.isNotBlank() &&
        (selectedCustomerId != null || customerName.isNotBlank()) &&
        lineItems.isNotEmpty() &&
        lineItems.all { it.description.isNotBlank() && it.quantity > 0 && it.rate > 0 }

    fun save() {
        showValidation = true
        if (!isValid) return

        val repo = InvoiceRepository(
            apiClient = com.spentyai.app.core.network.ApiClient(
                com.spentyai.app.core.auth.TokenStore(android.app.Application())
            )
        )
        // Build the payload using the repository helper
        val payload = buildInvoicePayload(
            invoiceNumber = invoiceNumber.trim(),
            customerId = selectedCustomerId,
            customerName = customerName.trim().ifBlank { null },
            issueDate = issueDate,
            dueDate = dueDate,
            lineItems = lineItems.toList(),
            subtotal = subtotal,
            taxAmount = totalTax,
            totalCgst = cgst,
            totalSgst = sgst,
            totalIgst = igst,
            grandTotal = grandTotal,
            notes = notes.trim().ifBlank { null },
            terms = terms.trim().ifBlank { null }
        )

        if (isEditing) {
            viewModel.updateInvoice(editingInvoice!!.id, payload) { onNavigateBack() }
        } else {
            viewModel.createInvoice(payload) { onNavigateBack() }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (isEditing) "Edit Invoice" else "New Invoice",
                        style = SpentyType.Headline
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    TextButton(
                        onClick = { save() },
                        enabled = !state.isLoading
                    ) {
                        Text(
                            "Save",
                            style = SpentyType.Headline,
                            color = SpentyPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
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
            // Invoice Number
            SectionCard(title = "Invoice") {
                OutlinedTextField(
                    value = invoiceNumber,
                    onValueChange = { invoiceNumber = it },
                    label = { Text("Invoice #") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    singleLine = true
                )
                if (showValidation && invoiceNumber.isBlank()) {
                    Text(
                        "Invoice number is required.",
                        style = SpentyType.Caption1,
                        color = SpentyError
                    )
                }
            }

            // Customer
            SectionCard(title = "Customer") {
                CustomerPickerField(
                    customers = state.customers,
                    selectedId = selectedCustomerId,
                    customerName = customerName,
                    onSelect = { customer ->
                        selectedCustomerId = customer.id
                        customerName = customer.name
                    },
                    onNameChange = { customerName = it }
                )
                if (showValidation && selectedCustomerId == null && customerName.isBlank()) {
                    Text(
                        "Customer is required.",
                        style = SpentyType.Caption1,
                        color = SpentyError
                    )
                }
            }

            // Dates
            SectionCard(title = "Dates") {
                DatePickerField(
                    label = "Invoice Date",
                    dateString = issueDate,
                    onClick = { showIssueDatePicker = true }
                )
                Spacer(modifier = Modifier.height(8.dp))
                DatePickerField(
                    label = "Due Date",
                    dateString = dueDate,
                    onClick = { showDueDatePicker = true }
                )
            }

            // Line Items
            SectionCard(title = "Line Items") {
                lineItems.forEachIndexed { index, item ->
                    LineItemRow(
                        item = item,
                        onUpdate = { updated -> lineItems[index] = updated },
                        onDelete = if (lineItems.size > 1) {
                            { lineItems.removeAt(index) }
                        } else null,
                        showValidation = showValidation
                    )
                    if (index < lineItems.size - 1) {
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedButton(
                    onClick = { lineItems.add(InvoiceFormLineItem()) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.secondaryButtonShape
                ) {
                    Icon(Icons.Filled.Add, contentDescription = null, tint = SpentyPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Add Line Item", color = SpentyPrimary, style = SpentyType.Subheadline)
                }

                if (showValidation && lineItems.isEmpty()) {
                    Text(
                        "At least one line item is required.",
                        style = SpentyType.Caption1,
                        color = SpentyError
                    )
                }
            }

            // GST Summary / Totals
            SectionCard(title = "GST Summary") {
                TotalsRow("Subtotal", subtotal)
                TotalsRow("CGST", cgst)
                TotalsRow("SGST", sgst)
                TotalsRow("Total Tax", totalTax)
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Grand Total", style = SpentyType.Headline)
                    Text(
                        formatCurrency(grandTotal),
                        style = SpentyType.Title3,
                        color = SpentyPrimary
                    )
                }
            }

            // Notes
            SectionCard(title = "Terms & Notes") {
                OutlinedTextField(
                    value = terms,
                    onValueChange = { terms = it },
                    label = { Text("Payment Terms") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    minLines = 2,
                    maxLines = 4
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes") },
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

    // Date picker dialogs
    if (showIssueDatePicker) {
        SpentyDatePickerDialog(
            initialDate = issueDate,
            onDateSelected = { issueDate = it; showIssueDatePicker = false },
            onDismiss = { showIssueDatePicker = false }
        )
    }
    if (showDueDatePicker) {
        SpentyDatePickerDialog(
            initialDate = dueDate,
            onDateSelected = { dueDate = it; showDueDatePicker = false },
            onDismiss = { showDueDatePicker = false }
        )
    }
}

@Composable
fun SectionCard(
    title: String,
    content: @Composable () -> Unit
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = SpentyType.Headline,
                color = SpentyPrimary,
                modifier = Modifier.padding(bottom = 12.dp)
            )
            content()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CustomerPickerField(
    customers: List<Customer>,
    selectedId: String?,
    customerName: String,
    onSelect: (Customer) -> Unit,
    onNameChange: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it }
    ) {
        OutlinedTextField(
            value = customerName.ifBlank { "Select Customer" },
            onValueChange = { onNameChange(it) },
            readOnly = customers.isNotEmpty(),
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
            label = { Text("Customer") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            shape = SpentyStyle.inputShape,
            colors = SpentyStyle.inputColors()
        )

        if (customers.isNotEmpty()) {
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                customers.forEach { customer ->
                    DropdownMenuItem(
                        text = {
                            Column {
                                Text(customer.name, style = SpentyType.Body)
                                if (!customer.email.isNullOrBlank()) {
                                    Text(
                                        customer.email,
                                        style = SpentyType.Caption1,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        },
                        onClick = {
                            onSelect(customer)
                            expanded = false
                        },
                        trailingIcon = {
                            if (customer.id == selectedId) {
                                Icon(
                                    Icons.Filled.Add, // checkmark equivalent
                                    contentDescription = "Selected",
                                    tint = SpentyPrimary
                                )
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun DatePickerField(
    label: String,
    dateString: String,
    onClick: () -> Unit
) {
    OutlinedTextField(
        value = formatDateDisplay(dateString),
        onValueChange = {},
        readOnly = true,
        label = { Text(label) },
        modifier = Modifier
            .fillMaxWidth()
            .clickableNoRipple { onClick() },
        shape = SpentyStyle.inputShape,
        colors = SpentyStyle.inputColors(),
        singleLine = true,
        enabled = false
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SpentyDatePickerDialog(
    initialDate: String,
    onDateSelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val initialMillis = try {
        LocalDate.parse(initialDate.take(10))
            .atStartOfDay(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()
    } catch (_: Exception) {
        System.currentTimeMillis()
    }

    val datePickerState = rememberDatePickerState(initialSelectedDateMillis = initialMillis)

    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                datePickerState.selectedDateMillis?.let { millis ->
                    val date = Instant.ofEpochMilli(millis)
                        .atZone(ZoneId.systemDefault())
                        .toLocalDate()
                    onDateSelected(date.format(DateTimeFormatter.ISO_LOCAL_DATE))
                }
            }) {
                Text("OK", color = SpentyPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    ) {
        DatePicker(state = datePickerState)
    }
}

@Composable
private fun LineItemRow(
    item: InvoiceFormLineItem,
    onUpdate: (InvoiceFormLineItem) -> Unit,
    onDelete: (() -> Unit)?,
    showValidation: Boolean
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = item.description,
                onValueChange = { onUpdate(item.copy(description = it)) },
                label = { Text("Description *") },
                modifier = Modifier.weight(1f),
                shape = SpentyStyle.inputShape,
                colors = SpentyStyle.inputColors(),
                singleLine = true
            )
            if (onDelete != null) {
                IconButton(onClick = onDelete) {
                    Icon(Icons.Filled.Delete, contentDescription = "Remove", tint = SpentyError)
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = item.hsnSac,
            onValueChange = { onUpdate(item.copy(hsnSac = it)) },
            label = { Text("HSN/SAC Code") },
            modifier = Modifier.fillMaxWidth(),
            shape = SpentyStyle.inputShape,
            colors = SpentyStyle.inputColors(),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(8.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = if (item.quantity == 0.0) "" else item.quantity.toBigDecimal().stripTrailingZeros().toPlainString(),
                onValueChange = { text ->
                    val qty = text.toDoubleOrNull() ?: 0.0
                    onUpdate(item.copy(quantity = qty))
                },
                label = { Text("Qty") },
                modifier = Modifier.weight(1f),
                shape = SpentyStyle.inputShape,
                colors = SpentyStyle.inputColors(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
            )
            OutlinedTextField(
                value = if (item.rate == 0.0) "" else item.rate.toBigDecimal().stripTrailingZeros().toPlainString(),
                onValueChange = { text ->
                    val rate = text.toDoubleOrNull() ?: 0.0
                    onUpdate(item.copy(rate = rate))
                },
                label = { Text("Rate") },
                modifier = Modifier.weight(1.5f),
                shape = SpentyStyle.inputShape,
                colors = SpentyStyle.inputColors(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
            )
            OutlinedTextField(
                value = if (item.taxPercent == 0.0) "" else item.taxPercent.toBigDecimal().stripTrailingZeros().toPlainString(),
                onValueChange = { text ->
                    val tax = text.toDoubleOrNull() ?: 0.0
                    onUpdate(item.copy(taxPercent = tax))
                },
                label = { Text("GST %") },
                modifier = Modifier.weight(1f),
                shape = SpentyStyle.inputShape,
                colors = SpentyStyle.inputColors(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            Text(
                text = "Amount: ${formatCurrency(item.lineTotal)}",
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold),
                color = SpentyPrimary
            )
        }

        if (showValidation && item.description.isBlank()) {
            Text("Description is required.", style = SpentyType.Caption1, color = SpentyError)
        }
    }
}

@Composable
private fun TotalsRow(label: String, amount: Double) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = SpentyType.Body, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(formatCurrency(amount), style = SpentyType.Body)
    }
}

private fun formatDateDisplay(dateStr: String): String {
    return try {
        val date = LocalDate.parse(dateStr.take(10))
        date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))
    } catch (_: Exception) {
        dateStr
    }
}

private fun buildInvoicePayload(
    invoiceNumber: String,
    customerId: String?,
    customerName: String?,
    issueDate: String,
    dueDate: String,
    lineItems: List<InvoiceFormLineItem>,
    subtotal: Double,
    taxAmount: Double,
    totalCgst: Double,
    totalSgst: Double,
    totalIgst: Double,
    grandTotal: Double,
    notes: String?,
    terms: String?
): kotlinx.serialization.json.JsonObject = kotlinx.serialization.json.buildJsonObject {
    put("invoice_number", kotlinx.serialization.json.JsonPrimitive(invoiceNumber))
    customerId?.let { put("customer_id", kotlinx.serialization.json.JsonPrimitive(it)) }
    customerName?.let { put("customer_name", kotlinx.serialization.json.JsonPrimitive(it)) }
    put("issue_date", kotlinx.serialization.json.JsonPrimitive(issueDate))
    put("due_date", kotlinx.serialization.json.JsonPrimitive(dueDate))
    put("subtotal", kotlinx.serialization.json.JsonPrimitive(subtotal))
    put("tax_amount", kotlinx.serialization.json.JsonPrimitive(taxAmount))
    put("total_cgst", kotlinx.serialization.json.JsonPrimitive(totalCgst))
    put("total_sgst", kotlinx.serialization.json.JsonPrimitive(totalSgst))
    put("total_igst", kotlinx.serialization.json.JsonPrimitive(totalIgst))
    put("total", kotlinx.serialization.json.JsonPrimitive(grandTotal))
    notes?.let { put("notes", kotlinx.serialization.json.JsonPrimitive(it)) }
    terms?.let { put("terms", kotlinx.serialization.json.JsonPrimitive(it)) }
    put("line_items", kotlinx.serialization.json.buildJsonArray {
        lineItems.forEach { item ->
            add(kotlinx.serialization.json.buildJsonObject {
                put("description", kotlinx.serialization.json.JsonPrimitive(item.description))
                if (item.hsnSac.isNotBlank()) put("hsn_sac", kotlinx.serialization.json.JsonPrimitive(item.hsnSac))
                put("quantity", kotlinx.serialization.json.JsonPrimitive(item.quantity))
                put("unit_price", kotlinx.serialization.json.JsonPrimitive(item.rate))
                put("tax_rate", kotlinx.serialization.json.JsonPrimitive(item.taxPercent))
                put("amount", kotlinx.serialization.json.JsonPrimitive(item.taxableAmount))
            })
        }
    })
}

// Extension to make OutlinedTextField clickable when disabled
@Composable
private fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier {
    return this.then(
        Modifier.clickable(
            indication = null,
            interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
            onClick = onClick
        )
    )
}

private fun Modifier.clickable(
    indication: androidx.compose.foundation.Indication?,
    interactionSource: androidx.compose.foundation.interaction.MutableInteractionSource,
    onClick: () -> Unit
): Modifier = androidx.compose.foundation.clickable(
    interactionSource = interactionSource,
    indication = indication,
    onClick = onClick
).let { this.then(it) }
