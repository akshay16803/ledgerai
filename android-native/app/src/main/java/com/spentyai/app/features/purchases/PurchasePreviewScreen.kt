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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Payment
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import com.spentyai.app.core.models.Bill
import com.spentyai.app.core.models.BillStatus
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentySuccess
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.features.invoices.SectionCard
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PurchasePreviewScreen(
    bill: Bill,
    viewModel: PurchasesViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Bill) -> Unit,
    onNavigateToRecordPayment: (Bill) -> Unit
) {
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(bill.billNumber ?: "Bill", style = SpentyType.Headline) },
                navigationIcon = { IconButton(onClick = onNavigateBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Back") } },
                actions = {
                    IconButton(onClick = { /* Share PDF */ }) { Icon(Icons.Filled.Share, contentDescription = "Share", tint = SpentyPrimary) }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Details
            SectionCard(title = "Details") {
                DetailRow("Bill #", bill.billNumber ?: "--")
                DetailRow("Vendor", bill.vendorName ?: "--")
                DetailRow("Date", formatDateDisplay(bill.issueDate))
                DetailRow("Due Date", formatDateDisplay(bill.dueDate))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Status", style = SpentyType.Body, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    val (badgeText, variant) = when (bill.status) {
                        BillStatus.PAID -> "Paid" to BadgeVariant.SUCCESS
                        BillStatus.PARTIALLY_PAID -> "Partial" to BadgeVariant.WARNING
                        BillStatus.OVERDUE -> "Overdue" to BadgeVariant.ERROR
                        BillStatus.CANCELLED -> "Cancelled" to BadgeVariant.NEUTRAL
                        BillStatus.UNPAID -> "Unpaid" to BadgeVariant.ERROR
                    }
                    StatusBadge(text = badgeText, variant = variant)
                }
            }

            // Line Items
            if (!bill.lineItems.isNullOrEmpty()) {
                SectionCard(title = "Line Items") {
                    bill.lineItems.forEachIndexed { index, item ->
                        Column(modifier = Modifier.padding(vertical = 4.dp)) {
                            Text(item.description, style = SpentyType.Body)
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Qty: ${formatNumber(item.quantity)}  Rate: ${formatCurrency(item.unitPrice)}", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(formatCurrency(item.amount), style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold))
                            }
                        }
                        if (index < bill.lineItems.size - 1) HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                    }
                }
            }

            // Totals
            SectionCard(title = "Totals") {
                DetailRow("Subtotal", formatCurrency(bill.subtotal))
                DetailRow("Tax", formatCurrency(bill.taxAmount))
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Grand Total", style = SpentyType.Headline)
                    Text(formatCurrency(bill.total), style = SpentyType.Title3, color = SpentyPrimary)
                }
                if (bill.amountPaid > 0) {
                    DetailRow("Amount Paid", formatCurrency(bill.amountPaid))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Balance Due", style = SpentyType.Headline)
                        Text(formatCurrency(bill.amountDue), style = SpentyType.AmountSmall, color = if (bill.amountDue > 0) SpentyError else SpentySuccess)
                    }
                }
            }

            if (!bill.notes.isNullOrBlank()) {
                SectionCard(title = "Notes") { Text(bill.notes, style = SpentyType.Body) }
            }

            // Actions
            SectionCard(title = "Actions") {
                if (bill.status != BillStatus.PAID) {
                    Button(onClick = { viewModel.markPaid(bill.id) }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = SpentySuccess), shape = SpentyStyle.primaryButtonShape) {
                        Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = Color.White)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Mark as Paid", style = SpentyType.Headline, color = Color.White)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(onClick = { onNavigateToRecordPayment(bill) }, modifier = Modifier.fillMaxWidth(), shape = SpentyStyle.secondaryButtonShape, border = SpentyStyle.secondaryButtonBorder()) {
                        Icon(Icons.Filled.Payment, contentDescription = null, tint = SpentyPrimary)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Record Payment", style = SpentyType.Headline, color = SpentyPrimary)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }
                OutlinedButton(onClick = { onNavigateToEdit(bill) }, modifier = Modifier.fillMaxWidth(), shape = SpentyStyle.secondaryButtonShape, border = SpentyStyle.secondaryButtonBorder()) {
                    Icon(Icons.Filled.Edit, contentDescription = null, tint = SpentyPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Edit Bill", style = SpentyType.Headline, color = SpentyPrimary)
                }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(onClick = { showDeleteConfirm = true }, modifier = Modifier.fillMaxWidth(), shape = SpentyStyle.destructiveButtonShape, border = androidx.compose.foundation.BorderStroke(1.5.dp, SpentyError)) {
                    Icon(Icons.Filled.Delete, contentDescription = null, tint = SpentyError)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Delete Bill", style = SpentyType.Headline, color = SpentyError)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    if (showDeleteConfirm) {
        ConfirmDialog(
            title = "Delete Bill",
            message = "Are you sure you want to delete this bill? This action cannot be undone.",
            confirmText = "Delete",
            isDestructive = true,
            onConfirm = { viewModel.deleteBill(bill.id); showDeleteConfirm = false; onNavigateBack() },
            onDismiss = { showDeleteConfirm = false }
        )
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = SpentyType.Body, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = SpentyType.Body)
    }
}

private fun formatDateDisplay(dateStr: String): String = try { LocalDate.parse(dateStr.take(10)).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)) } catch (_: Exception) { dateStr.ifBlank { "--" } }
private fun formatNumber(value: Double): String = if (value == value.toLong().toDouble()) value.toLong().toString() else String.format("%.2f", value)
