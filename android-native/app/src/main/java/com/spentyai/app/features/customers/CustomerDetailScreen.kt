package com.spentyai.app.features.customers

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.BadgeVariant
import com.spentyai.app.core.components.StatusBadge
import com.spentyai.app.core.components.formatCurrency
import com.spentyai.app.core.models.Customer
import com.spentyai.app.core.models.Invoice
import com.spentyai.app.core.models.InvoiceStatus
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
fun CustomerDetailScreen(
    customer: Customer,
    viewModel: CustomersViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Customer) -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    // Find the potentially updated customer from the list
    val displayCustomer = state.customers.find { it.id == customer.id } ?: customer

    LaunchedEffect(customer.id) {
        viewModel.loadCustomerInvoices(customer.id)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(displayCustomer.name, style = SpentyType.Headline) },
                navigationIcon = { IconButton(onClick = onNavigateBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Back") } },
                actions = {
                    TextButton(onClick = { onNavigateToEdit(displayCustomer) }) {
                        Text("Edit", style = SpentyType.Headline, color = SpentyPrimary)
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
            // Info Card
            SectionCard(title = "Customer Details") {
                InfoRow("Name", displayCustomer.name)
                if (!displayCustomer.email.isNullOrBlank()) InfoRow("Email", displayCustomer.email)
                if (!displayCustomer.phone.isNullOrBlank()) InfoRow("Phone", displayCustomer.phone)
                if (!displayCustomer.taxId.isNullOrBlank()) InfoRow("GSTIN", displayCustomer.taxId)
                displayCustomer.billingAddress?.let { addr ->
                    val addressStr = listOfNotNull(addr.street, addr.city, addr.state, addr.postalCode, addr.country)
                        .filter { it.isNotBlank() }.joinToString(", ")
                    if (addressStr.isNotBlank()) InfoRow("Billing Address", addressStr)
                }
                displayCustomer.shippingAddress?.let { addr ->
                    val addressStr = listOfNotNull(addr.street, addr.city, addr.state, addr.postalCode, addr.country)
                        .filter { it.isNotBlank() }.joinToString(", ")
                    if (addressStr.isNotBlank()) InfoRow("Shipping Address", addressStr)
                }
            }

            // Financial Summary
            SectionCard(title = "Financial Summary") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    SummaryTile("Invoiced", displayCustomer.totalInvoiced, SpentyPrimary)
                    SummaryTile("Paid", displayCustomer.totalPaid, SpentySuccess)
                    SummaryTile("Outstanding", displayCustomer.outstandingBalance, SpentyError)
                }
            }

            // Invoices
            SectionCard(title = "Invoices") {
                if (state.isLoadingInvoices) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(color = SpentyPrimary)
                    }
                } else if (state.customerInvoices.isEmpty()) {
                    Text(
                        "No invoices found for this customer.",
                        style = SpentyType.Subheadline,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp)
                    )
                } else {
                    state.customerInvoices.forEachIndexed { index, invoice ->
                        InvoiceRow(invoice)
                        if (index < state.customerInvoices.size - 1) {
                            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Column(modifier = Modifier.padding(vertical = 4.dp)) {
        Text(label, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = SpentyType.Subheadline)
    }
}

@Composable
private fun SummaryTile(title: String, amount: Double, color: androidx.compose.ui.graphics.Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            formatCurrency(amount),
            style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Bold),
            color = color
        )
        Text(title, style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun InvoiceRow(invoice: Invoice) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Text(
                invoice.invoiceNumber.ifBlank { "Invoice" },
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold)
            )
            if (invoice.issueDate.isNotBlank()) {
                Text(
                    formatDateDisplay(invoice.issueDate),
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                formatCurrency(invoice.total),
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold)
            )
            val (badgeText, variant) = when (invoice.status) {
                InvoiceStatus.PAID -> "Paid" to BadgeVariant.SUCCESS
                InvoiceStatus.OVERDUE -> "Overdue" to BadgeVariant.ERROR
                InvoiceStatus.PARTIALLY_PAID -> "Partial" to BadgeVariant.WARNING
                InvoiceStatus.SENT -> "Sent" to BadgeVariant.INFO
                else -> "Unpaid" to BadgeVariant.NEUTRAL
            }
            StatusBadge(text = badgeText, variant = variant)
        }
    }
}

private fun formatDateDisplay(dateStr: String): String = try {
    LocalDate.parse(dateStr.take(10)).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))
} catch (_: Exception) { dateStr }
