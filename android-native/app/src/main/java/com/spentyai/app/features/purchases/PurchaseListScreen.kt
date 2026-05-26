package com.spentyai.app.features.purchases

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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.CameraAlt
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
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.BadgeVariant
import com.spentyai.app.core.components.EmptyStateView
import com.spentyai.app.core.components.LoadingView
import com.spentyai.app.core.components.SpentySearchBar
import com.spentyai.app.core.components.StatCard
import com.spentyai.app.core.components.StatusBadge
import com.spentyai.app.core.components.formatCurrency
import com.spentyai.app.core.models.Bill
import com.spentyai.app.core.models.BillStatus
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
fun PurchaseListScreen(
    viewModel: PurchasesViewModel,
    billingViewModel: BillingViewModel,
    onNavigateToForm: (Bill?) -> Unit,
    onNavigateToPreview: (Bill) -> Unit,
    onNavigateToRecordPayment: (Bill) -> Unit,
    onNavigateToUpload: () -> Unit,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val filtered by viewModel.filteredBills.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var creditorsExpanded by remember { mutableStateOf(false) }
    var agingExpanded by remember { mutableStateOf(false) }

    // ── Premium gate (Purchases is the paid Premium tier) ────────────────
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

    // Gate data load behind hasPremium — backend 402s for free users.
    LaunchedEffect(hasPremium) { if (hasPremium) viewModel.loadAll() }

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Purchases", style = SpentyType.Title2) },
                actions = {
                    IconButton(onClick = onNavigateToUpload) {
                        Icon(Icons.Filled.CameraAlt, contentDescription = "Upload Bill", tint = SpentyPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onNavigateToForm(null) },
                containerColor = SpentyPrimary,
                contentColor = Color.White
            ) {
                Icon(Icons.Filled.Add, contentDescription = "New Bill")
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Box(
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            if (state.isLoading && state.bills.isEmpty()) {
                LoadingView(message = "Loading bills...")
            } else if (state.bills.isEmpty()) {
                EmptyStateView(
                    icon = Icons.Filled.Description,
                    title = "No Bills Yet",
                    subtitle = "Tap + to create your first purchase bill, or upload one to parse."
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        TextButton(onClick = { onNavigateToForm(null) }) {
                            Text("New Bill", color = SpentyPrimary, style = SpentyType.Headline)
                        }
                        TextButton(onClick = onNavigateToUpload) {
                            Text("Upload", color = SpentyPrimary, style = SpentyType.Headline)
                        }
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(bottom = 80.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    item {
                        SpentySearchBar(
                            query = state.searchText,
                            onQueryChange = { viewModel.updateSearch(it) },
                            placeholder = "Search bills...",
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }

                    // Stats
                    item { BillStatsSection(stats = state.stats) }

                    // Filter chips
                    item {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(vertical = 4.dp)
                        ) {
                            items(PurchasesViewModel.STATUS_FILTERS) { filter ->
                                FilterChip(
                                    selected = state.statusFilter == filter,
                                    onClick = { viewModel.updateStatusFilter(filter) },
                                    label = {
                                        Text(filter.replaceFirstChar { it.uppercase() }, style = SpentyType.Subheadline)
                                    },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = SpentyPrimary,
                                        selectedLabelColor = Color.White
                                    )
                                )
                            }
                        }
                    }

                    // Bills header
                    item {
                        Text(
                            text = "Bills (${filtered.size})",
                            style = SpentyType.Headline,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }

                    if (filtered.isEmpty()) {
                        item {
                            Text(
                                text = "No bills match your filters.",
                                style = SpentyType.Body,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp)
                            )
                        }
                    } else {
                        items(filtered, key = { it.id }) { bill ->
                            BillRow(
                                bill = bill,
                                onClick = { onNavigateToPreview(bill) }
                            )
                        }
                    }

                    // Creditors
                    if (state.creditors.isNotEmpty()) {
                        item {
                            CreditorsSection(
                                creditors = state.creditors,
                                expanded = creditorsExpanded,
                                onToggle = { creditorsExpanded = !creditorsExpanded }
                            )
                        }
                    }

                    // Aging
                    if (state.aging.isNotEmpty()) {
                        item {
                            BillAgingSection(
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
private fun BillStatsSection(stats: BillStats) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(title = "Total Billed", value = formatCurrency(stats.totalBilled), icon = Icons.Filled.Description, iconColor = SpentyPrimary, modifier = Modifier.weight(1f))
            StatCard(title = "Paid", value = formatCurrency(stats.totalPaid), icon = Icons.Filled.CheckCircle, iconColor = SpentySuccess, modifier = Modifier.weight(1f))
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(title = "Outstanding", value = formatCurrency(stats.totalOutstanding), icon = Icons.Filled.Schedule, iconColor = SpentyWarning, modifier = Modifier.weight(1f))
            StatCard(title = "Overdue", value = formatCurrency(stats.totalOverdue), icon = Icons.Filled.Warning, iconColor = SpentyError, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun BillRow(bill: Bill, onClick: () -> Unit) {
    ElevatedCard(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text(text = bill.billNumber ?: "Draft", style = SpentyType.Headline)
                    Text(text = bill.vendorName ?: "Unknown Vendor", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(text = formatCurrency(bill.total), style = SpentyType.AmountSmall)
                    Spacer(modifier = Modifier.height(4.dp))
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
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.CalendarMonth, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = formatDateDisplay(bill.issueDate), style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (bill.dueDate.isNotBlank()) {
                    val isOverdue = try { LocalDate.parse(bill.dueDate.take(10)).isBefore(LocalDate.now()) } catch (_: Exception) { false }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Schedule, contentDescription = null, modifier = Modifier.size(14.dp), tint = if (isOverdue) SpentyError else MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = "Due: ${formatDateDisplay(bill.dueDate)}", style = SpentyType.Caption1, color = if (isOverdue) SpentyError else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun CreditorsSection(creditors: List<CreditorSummary>, expanded: Boolean, onToggle: () -> Unit) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(modifier = Modifier.fillMaxWidth().clickable { onToggle() }, horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Creditors", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Icon(if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        AnimatedVisibility(visible = expanded, enter = expandVertically(), exit = shrinkVertically()) {
            ElevatedCard(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), shape = SpentyStyle.cardShape, colors = SpentyStyle.cardColors()) {
                Column(modifier = Modifier.padding(12.dp)) {
                    creditors.forEachIndexed { index, creditor ->
                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(creditor.vendorName ?: "--", style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium))
                                Text("${creditor.billCount} bill(s)", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text(formatCurrency(creditor.totalOutstanding), style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold), color = SpentyError)
                        }
                        if (index < creditors.size - 1) HorizontalDivider()
                    }
                }
            }
        }
    }
}

@Composable
private fun BillAgingSection(aging: List<BillAgingBucket>, expanded: Boolean, onToggle: () -> Unit) {
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(modifier = Modifier.fillMaxWidth().clickable { onToggle() }, horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Aging Analysis", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Icon(if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        AnimatedVisibility(visible = expanded, enter = expandVertically(), exit = shrinkVertically()) {
            ElevatedCard(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), shape = SpentyStyle.cardShape, colors = SpentyStyle.cardColors()) {
                Column(modifier = Modifier.padding(12.dp)) {
                    aging.forEachIndexed { index, bucket ->
                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(bucket.displayLabel, style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium))
                                Text("${bucket.count} bills", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text(formatCurrency(bucket.amount), style = SpentyType.AmountSmall)
                        }
                        if (index < aging.size - 1) HorizontalDivider()
                    }
                }
            }
        }
    }
}

private fun formatDateDisplay(dateStr: String): String {
    return try {
        val date = LocalDate.parse(dateStr.take(10))
        date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))
    } catch (_: Exception) { dateStr }
}
