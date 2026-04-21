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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Payment
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.BadgeVariant
import com.spentyai.app.core.components.ConfirmDialog
import com.spentyai.app.core.components.StatusBadge
import com.spentyai.app.core.components.formatCurrency
import com.spentyai.app.core.models.Invoice
import com.spentyai.app.core.models.InvoiceStatus
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentySuccess
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoicePreviewScreen(
    invoice: Invoice,
    viewModel: InvoicesViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Invoice) -> Unit,
    onNavigateToRecordPayment: (Invoice) -> Unit
) {
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(invoice.invoiceNumber.ifBlank { "Invoice" }, style = SpentyType.Headline) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { /* Share PDF - placeholder */ }) {
                        Icon(Icons.Filled.Share, contentDescription = "Share", tint = SpentyPrimary)
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
            // Details Card
            SectionCard(title = "Details") {
                DetailRow("Invoice #", invoice.invoiceNumber.ifBlank { "--" })
                DetailRow("Customer", invoice.customerName ?: "--")
                DetailRow("Date", formatDateDisplay(invoice.issueDate))
                DetailRow("Due Date", formatDateDisplay(invoice.dueDate))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Status", style = SpentyType.Body, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    val (badgeText, variant) = when (invoice.status) {
                        InvoiceStatus.PAID -> "Paid" to BadgeVariant.SUCCESS
                        InvoiceStatus.PARTIALLY_PAID -> "Partial" to BadgeVariant.WARNING
                        InvoiceStatus.OVERDUE -> "Overdue" to BadgeVariant.ERROR
                        InvoiceStatus.CANCELLED -> "Cancelled" to BadgeVariant.NEUTRAL
                        else -> "Unpaid" to BadgeVariant.ERROR
                    }
                    StatusBadge(text = badgeText, variant = variant)
                }
            }

            // Line Items
            if (!invoice.lineItems.isNullOrEmpty()) {
                SectionCard(title = "Line Items") {
                    invoice.lineItems.forEachIndexed { index, item ->
                        Column(modifier = Modifier.padding(vertical = 4.dp)) {
                            Text(
                                text = item.description,
                                style = SpentyType.Body
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "Qty: ${formatNumber(item.quantity)}  Rate: ${formatCurrency(item.unitPrice)}",
                                    style = SpentyType.Caption1,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = formatCurrency(item.amount),
                                    style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold)
                                )
                            }
                        }
                        if (index < invoice.lineItems.size - 1) {
                            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                        }
                    }
                }
            }

            // Totals
            SectionCard(title = "Totals") {
                DetailRow("Subtotal", formatCurrency(invoice.subtotal))
                DetailRow("Tax", formatCurrency(invoice.taxAmount))
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Grand Total", style = SpentyType.Headline)
                    Text(
                        formatCurrency(invoice.total),
                        style = SpentyType.Title3,
                        color = SpentyPrimary
                    )
                }
                if (invoice.amountPaid > 0) {
                    DetailRow("Amount Paid", formatCurrency(invoice.amountPaid))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Balance Due", style = SpentyType.Headline)
                        Text(
                            formatCurrency(invoice.amountDue),
                            style = SpentyType.AmountSmall,
                            color = if (invoice.amountDue > 0) SpentyError else SpentySuccess
                        )
                    }
                }
            }

            // Notes
            if (!invoice.notes.isNullOrBlank()) {
                SectionCard(title = "Notes") {
                    Text(invoice.notes, style = SpentyType.Body)
                }
            }

            // Actions
            SectionCard(title = "Actions") {
                if (invoice.status != InvoiceStatus.PAID) {
                    Button(
                        onClick = { viewModel.markPaid(invoice.id) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = SpentySuccess),
                        shape = SpentyStyle.primaryButtonShape
                    ) {
                        Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = Color.White)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Mark as Paid", style = SpentyType.Headline, color = Color.White)
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedButton(
                        onClick = { onNavigateToRecordPayment(invoice) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.secondaryButtonShape,
                        border = SpentyStyle.secondaryButtonBorder()
                    ) {
                        Icon(Icons.Filled.Payment, contentDescription = null, tint = SpentyPrimary)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Record Payment", style = SpentyType.Headline, color = SpentyPrimary)
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                }

                OutlinedButton(
                    onClick = { onNavigateToEdit(invoice) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.secondaryButtonShape,
                    border = SpentyStyle.secondaryButtonBorder()
                ) {
                    Icon(Icons.Filled.Edit, contentDescription = null, tint = SpentyPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Edit Invoice", style = SpentyType.Headline, color = SpentyPrimary)
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedButton(
                    onClick = { showDeleteConfirm = true },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.destructiveButtonShape,
                    border = androidx.compose.foundation.BorderStroke(1.5.dp, SpentyError)
                ) {
                    Icon(Icons.Filled.Delete, contentDescription = null, tint = SpentyError)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Delete Invoice", style = SpentyType.Headline, color = SpentyError)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    if (showDeleteConfirm) {
        ConfirmDialog(
            title = "Delete Invoice",
            message = "Are you sure you want to delete this invoice? This action cannot be undone.",
            confirmText = "Delete",
            isDestructive = true,
            onConfirm = {
                viewModel.deleteInvoice(invoice.id)
                showDeleteConfirm = false
                onNavigateBack()
            },
            onDismiss = { showDeleteConfirm = false }
        )
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = SpentyType.Body, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = SpentyType.Body)
    }
}

private fun formatDateDisplay(dateStr: String): String {
    return try {
        val date = LocalDate.parse(dateStr.take(10))
        date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))
    } catch (_: Exception) {
        dateStr.ifBlank { "--" }
    }
}

private fun formatNumber(value: Double): String {
    return if (value == value.toLong().toDouble()) {
        value.toLong().toString()
    } else {
        String.format("%.2f", value)
    }
}
