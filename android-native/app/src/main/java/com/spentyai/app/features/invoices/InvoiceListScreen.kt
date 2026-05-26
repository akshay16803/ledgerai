package com.spentyai.app.features.invoices

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CurrencyRupee
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Payment
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.BadgeVariant
import com.spentyai.app.core.components.EmptyStateView
import com.spentyai.app.core.components.LoadingView
import com.spentyai.app.core.components.SpentySearchBar
import com.spentyai.app.core.components.StatCard
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
import com.spentyai.app.features.billing.BillingRepository
import com.spentyai.app.features.billing.BillingViewModel
import com.spentyai.app.features.billing.PremiumFeatureSheet
import android.app.Activity
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.ui.platform.LocalContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoiceListScreen(
    viewModel: InvoicesViewModel,
    billingViewModel: BillingViewModel,
    onNavigateToForm: (Invoice?) -> Unit,
    onNavigateToPreview: (Invoice) -> Unit,
    onNavigateToRecordPayment: (Invoice) -> Unit,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val filtered by viewModel.filteredInvoices.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var debtorsExpanded by remember { mutableStateOf(false) }
    var agingExpanded by remember { mutableStateOf(false) }

    // ── Premium gate (Invoices is the paid Premium tier) ─────────────────
    val billingState by billingViewModel.uiState.collectAsState()
    val hasPremium = billingState.currentStatus?.isActive == true
    val statusLoaded = billingState.currentStatus != null
    var showPremiumSheet by remember { mutableStateOf(false) }
    var initialGateChecked by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val activity = context as? Activity

    LaunchedEffect(statusLoaded) {
        if (!statusLoaded || initialGateChecked) return@LaunchedEffect
        initialGateChecked = true
        if (!hasPremium) showPremiumSheet = true
    }

    LaunchedEffect(hasPremium) {
        if (hasPremium && showPremiumSheet) showPremiumSheet = false
    }

    if (showPremiumSheet) {
        val closeSheet: () -> Unit = {
            showPremiumSheet = false
            if (!hasPremium) onBack()
        }
        ModalBottomSheet(
            onDismissRequest = closeSheet,
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            PremiumFeatureSheet.Bundle(
                monthlyPriceDisplay = billingViewModel.displayPrice(BillingRepository.PRODUCT_MONTHLY) ?: "₹199",
                lifetimePriceDisplay = billingViewModel.displayPrice(BillingRepository.PRODUCT_LIFETIME_OFFER) ?: "₹4,999",
                isPurchasing = billingState.isPurchasing,
                onSubscribe = onSub@{
                    val act = activity ?: return@onSub
                    val details = billingState.productDetailsList
                        .firstOrNull { it.productId == BillingRepository.PRODUCT_MONTHLY }
                        ?: return@onSub
                    billingViewModel.purchaseSubscription(details, act)
                },
                onSubscribeLifetime = onLife@{
                    val act = activity ?: return@onLife
                    billingViewModel.purchaseLifetimeOffer(act)
                },
                onClose = closeSheet
            )
        }
    }

    // Gate the data-loading LaunchedEffect behind hasPremium — backend 402s
    // these endpoints for free users now, and the resulting error toast
    // races / clobbers the premium sheet.
    LaunchedEffect(hasPremium) {
        if (hasPremium) viewModel.loadAll()
    }

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Invoices", style = SpentyType.Title2) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onNavigateToForm(null) },
                containerColor = SpentyPrimary,
                contentColor = Color.White
            ) {
                Icon(Icons.Filled.Add, contentDescription = "New Invoice")
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (state.isLoading && state.invoices.isEmpty()) {
                LoadingView(message = "Loading invoices...")
            } else if (state.invoices.isEmpty()) {
                EmptyStateView(
                    icon = Icons.Filled.Description,
                    title = "No Invoices Yet",
                    subtitle = "Tap the + button to create your first invoice."
                ) {
                    TextButton(onClick = { onNavigateToForm(null) }) {
                        Text("Create Invoice", color = SpentyPrimary, style = SpentyType.Headline)
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(bottom = 80.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    // Search bar
                    item {
                        SpentySearchBar(
                            query = state.searchText,
                            onQueryChange = { viewModel.updateSearch(it) },
                            placeholder = "Search by number or customer",
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }

                    // Stats cards
                    item {
                        StatsCardsSection(stats = state.stats)
                    }

                    // Status filter chips
                    item {
                        StatusFilterChips(
                            selected = state.statusFilter,
                            onSelect = { viewModel.updateStatusFilter(it) }
                        )
                    }

                    // Invoice list header
                    item {
                        Text(
                            text = "Invoices (${filtered.size})",
                            style = SpentyType.Headline,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }

                    if (filtered.isEmpty()) {
                        item {
                            Text(
                                text = "No invoices match your filters.",
                                style = SpentyType.Body,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp)
                            )
                        }
                    } else {
                        items(filtered, key = { it.id }) { invoice ->
                            InvoiceRow(
                                invoice = invoice,
                                onClick = { onNavigateToPreview(invoice) },
                                onRecordPayment = { onNavigateToRecordPayment(invoice) }
                            )
                        }
                    }

                    // Debtors section
                    if (state.debtors.isNotEmpty()) {
                        item {
                            DebtorsSection(
                                debtors = state.debtors,
                                expanded = debtorsExpanded,
                                onToggle = { debtorsExpanded = !debtorsExpanded }
                            )
                        }
                    }

                    // Aging section
                    if (state.aging.isNotEmpty()) {
                        item {
                            AgingSection(
                                aging = state.aging,
                                expanded = agingExpanded,
                                onToggle = { agingExpanded = !agingExpanded }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatsCardsSection(stats: InvoiceStats) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                title = "Total Invoiced",
                value = formatCurrency(stats.totalInvoiced),
                icon = Icons.Filled.Description,
                iconColor = SpentyPrimary,
                modifier = Modifier.weight(1f)
            )
            StatCard(
                title = "Paid",
                value = formatCurrency(stats.totalPaid),
                icon = Icons.Filled.Payment,
                iconColor = SpentySuccess,
                modifier = Modifier.weight(1f)
            )
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                title = "Outstanding",
                value = formatCurrency(stats.totalOutstanding),
                icon = Icons.Filled.Schedule,
                iconColor = SpentyWarning,
                modifier = Modifier.weight(1f)
            )
            StatCard(
                title = "Overdue",
                value = formatCurrency(stats.totalOverdue),
                icon = Icons.Filled.Warning,
                iconColor = SpentyError,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun StatusFilterChips(selected: String, onSelect: (String) -> Unit) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(vertical = 4.dp)
    ) {
        items(InvoicesViewModel.STATUS_FILTERS) { filter ->
            FilterChip(
                selected = selected == filter,
                onClick = { onSelect(filter) },
                label = {
                    Text(
                        text = filter.replaceFirstChar { it.uppercase() },
                        style = SpentyType.Subheadline
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SpentyPrimary,
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}

@Composable
private fun InvoiceRow(
    invoice: Invoice,
    onClick: () -> Unit,
    onRecordPayment: () -> Unit
) {
    ElevatedCard(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = invoice.invoiceNumber.ifBlank { "--" },
                    style = SpentyType.Headline
                )
                InvoiceStatusBadge(invoice.status)
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = invoice.customerName ?: "Unknown Customer",
                style = SpentyType.Subheadline,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Filled.CalendarMonth,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = formatDateDisplay(invoice.issueDate),
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.weight(1f))

                if (invoice.dueDate.isNotBlank()) {
                    Icon(
                        Icons.Filled.Schedule,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = if (isOverdue(invoice)) SpentyError
                               else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Due: ${formatDateDisplay(invoice.dueDate)}",
                        style = SpentyType.Caption1,
                        color = if (isOverdue(invoice)) SpentyError
                               else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = formatCurrency(invoice.total),
                    style = SpentyType.AmountSmall,
                    color = SpentyPrimary
                )

                Spacer(modifier = Modifier.weight(1f))

                if (invoice.amountPaid > 0 && invoice.amountPaid < invoice.total) {
                    Text(
                        text = "Paid: ${formatCurrency(invoice.amountPaid)}",
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(end = 8.dp)
                    )
                }

                if (invoice.status != InvoiceStatus.PAID) {
                    TextButton(onClick = onRecordPayment) {
                        Icon(
                            Icons.Filled.CurrencyRupee,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = SpentyPrimary
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Record Payment",
                            style = SpentyType.Caption1.copy(fontWeight = FontWeight.Medium),
                            color = SpentyPrimary
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InvoiceStatusBadge(status: InvoiceStatus) {
    val (text, variant) = when (status) {
        InvoiceStatus.PAID -> "Paid" to BadgeVariant.SUCCESS
        InvoiceStatus.PARTIALLY_PAID -> "Partial" to BadgeVariant.WARNING
        InvoiceStatus.OVERDUE -> "Overdue" to BadgeVariant.ERROR
        InvoiceStatus.CANCELLED -> "Cancelled" to BadgeVariant.NEUTRAL
        InvoiceStatus.SENT -> "Sent" to BadgeVariant.INFO
        InvoiceStatus.VIEWED -> "Viewed" to BadgeVariant.INFO
        InvoiceStatus.DRAFT -> "Unpaid" to BadgeVariant.ERROR
    }
    StatusBadge(text = text, variant = variant)
}

@Composable
private fun DebtorsSection(
    debtors: List<InvoiceDebtor>,
    expanded: Boolean,
    onToggle: () -> Unit
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onToggle() },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Debtors Summary",
                style = SpentyType.Headline,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Icon(
                if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                contentDescription = if (expanded) "Collapse" else "Expand",
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(),
            exit = shrinkVertically()
        ) {
            ElevatedCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    debtors.forEachIndexed { index, debtor ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(
                                    text = debtor.customerName ?: "--",
                                    style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium)
                                )
                                Text(
                                    text = "${debtor.invoiceCount} invoices",
                                    style = SpentyType.Caption1,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = formatCurrency(debtor.totalOutstanding),
                                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold),
                                color = SpentyError
                            )
                        }
                        if (index < debtors.size - 1) {
                            HorizontalDivider()
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AgingSection(
    aging: List<InvoiceAgingBucket>,
    expanded: Boolean,
    onToggle: () -> Unit
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onToggle() },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Aging Analysis",
                style = SpentyType.Headline,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Icon(
                if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                contentDescription = if (expanded) "Collapse" else "Expand",
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(),
            exit = shrinkVertically()
        ) {
            ElevatedCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    aging.forEachIndexed { index, bucket ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(
                                    text = bucket.label ?: "--",
                                    style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium)
                                )
                                Text(
                                    text = "${bucket.count} invoices",
                                    style = SpentyType.Caption1,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Text(
                                text = formatCurrency(bucket.amount),
                                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold),
                                color = SpentyWarning
                            )
                        }
                        if (index < aging.size - 1) {
                            HorizontalDivider()
                        }
                    }
                }
            }
        }
    }
}

private fun isOverdue(invoice: Invoice): Boolean {
    if (invoice.status == InvoiceStatus.PAID) return false
    return try {
        val due = LocalDate.parse(invoice.dueDate.take(10))
        due.isBefore(LocalDate.now())
    } catch (_: Exception) { false }
}

private fun formatDateDisplay(dateStr: String): String {
    return try {
        val date = LocalDate.parse(dateStr.take(10))
        date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))
    } catch (_: Exception) {
        dateStr
    }
}
