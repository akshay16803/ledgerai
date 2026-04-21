package com.spentyai.app.features.transactions

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.*
import com.spentyai.app.core.models.Transaction
import com.spentyai.app.core.theme.*
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionListScreen(
    viewModel: TransactionsViewModel,
    onTransactionClick: (Transaction) -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    var showDeleteConfirm by remember { mutableStateOf(false) }
    var deleteTargetId by remember { mutableStateOf<String?>(null) }
    var showDateFilter by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (state.transactions.isEmpty() && !state.isLoading) {
            viewModel.loadInitial()
        }
    }

    // Delete confirmation dialog
    if (showDeleteConfirm) {
        ConfirmDialog(
            title = "Delete Transaction",
            message = "This action cannot be undone.",
            confirmText = "Delete",
            isDestructive = true,
            onConfirm = {
                deleteTargetId?.let { viewModel.deleteTransaction(it) }
                showDeleteConfirm = false
                deleteTargetId = null
            },
            onDismiss = {
                showDeleteConfirm = false
                deleteTargetId = null
            }
        )
    }

    // Error dialog
    state.errorMessage?.let { error ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissError() },
            title = { Text("Error", style = SpentyType.Headline) },
            text = { Text(error, style = SpentyType.Body) },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissError() }) {
                    Text("OK", color = SpentyPrimary)
                }
            },
            shape = SpentyStyle.cardShape
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Transactions", style = SpentyType.Title2) },
                actions = {
                    if (state.isSelecting) {
                        TextButton(onClick = { viewModel.selectAll() }) {
                            Text("Select All", style = SpentyType.Footnote, color = SpentyPrimary)
                        }
                        TextButton(onClick = { viewModel.clearSelection() }) {
                            Text("Cancel", style = SpentyType.Footnote, color = SpentyError)
                        }
                    } else {
                        IconButton(onClick = { viewModel.beginCreate() }) {
                            Icon(
                                Icons.Filled.Add,
                                contentDescription = "Add Transaction",
                                tint = SpentyPrimary
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        floatingActionButton = {
            if (!state.isSelecting && state.transactions.isNotEmpty()) {
                FloatingActionButton(
                    onClick = { viewModel.beginCreate() },
                    containerColor = SpentyPrimary,
                    contentColor = Color.White
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Add Transaction")
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // View mode toggle
            ViewModeToggle(
                viewMode = state.viewMode,
                onModeChange = { viewModel.updateViewMode(it) }
            )

            // Search bar
            SpentySearchBar(
                query = state.searchQuery,
                onQueryChange = { viewModel.updateSearchQuery(it) },
                placeholder = "Search transactions...",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                onSearch = { viewModel.performSearch() }
            )

            // Filter section
            FilterSection(
                filterType = state.filterType,
                filterAccountId = state.filterAccountId,
                accounts = state.accounts,
                hasDateFilter = state.dateFrom != null || state.dateTo != null,
                onFilterTypeChange = { viewModel.updateFilterType(it) },
                onAccountChange = { viewModel.updateFilterAccountId(it) },
                onDateFilterClick = { showDateFilter = true },
                onClearDateFilter = { viewModel.clearDateRange() },
                accountNameResolver = { viewModel.accountName(it) }
            )

            // Bulk action bar
            AnimatedVisibility(visible = state.isSelecting) {
                BulkActionBar(
                    selectedCount = state.selectedIds.size,
                    onDelete = { viewModel.bulkDelete() }
                )
            }

            // Content
            when {
                state.isLoading && state.transactions.isEmpty() -> {
                    LoadingView(message = "Loading transactions...")
                }
                state.transactions.isEmpty() -> {
                    EmptyStateView(
                        icon = Icons.Outlined.SwapHoriz,
                        title = "No Transactions",
                        subtitle = "Add your first transaction to start tracking."
                    ) {
                        Button(
                            onClick = { viewModel.beginCreate() },
                            colors = SpentyStyle.primaryButtonColors(),
                            shape = SpentyStyle.primaryButtonShape
                        ) {
                            Text("Add Transaction", style = SpentyType.Headline)
                        }
                    }
                }
                else -> {
                    when (state.viewMode) {
                        TransactionViewMode.LIST -> {
                            TransactionList(
                                state = state,
                                onTransactionClick = { txn ->
                                    if (state.isSelecting) {
                                        viewModel.toggleSelection(txn.id)
                                    } else {
                                        onTransactionClick(txn)
                                    }
                                },
                                onLongPress = { txn ->
                                    if (!state.isSelecting) {
                                        viewModel.setSelecting(true)
                                    }
                                    viewModel.toggleSelection(txn.id)
                                },
                                onDelete = { id ->
                                    deleteTargetId = id
                                    showDeleteConfirm = true
                                },
                                onEdit = { txn -> viewModel.beginEdit(txn) },
                                onLoadMore = { viewModel.loadMore() },
                                onRefresh = { viewModel.refresh() },
                                categoryNameResolver = { viewModel.categoryName(it) },
                                accountNameResolver = { viewModel.accountName(it) }
                            )
                        }
                        TransactionViewMode.LEDGER -> {
                            TransactionLedgerScreen(
                                viewModel = viewModel
                            )
                        }
                    }
                }
            }
        }
    }

    // Date filter dialog
    if (showDateFilter) {
        DateFilterDialog(
            dateFrom = state.dateFrom,
            dateTo = state.dateTo,
            onApply = { from, to ->
                viewModel.updateDateRange(from, to)
                showDateFilter = false
            },
            onDismiss = { showDateFilter = false }
        )
    }

    // Form bottom sheet
    if (state.showForm) {
        TransactionFormScreen(
            viewModel = viewModel,
            transaction = state.editingTransaction,
            onDismiss = { viewModel.hideForm() },
            onSaved = {
                viewModel.hideForm()
                viewModel.refresh()
            }
        )
    }
}

// MARK: - View Mode Toggle

@Composable
private fun ViewModeToggle(
    viewMode: TransactionViewMode,
    onModeChange: (TransactionViewMode) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        TransactionViewMode.entries.forEach { mode ->
            val isSelected = viewMode == mode
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (isSelected) SpentyPrimary else Color.Transparent)
                    .clickable { onModeChange(mode) }
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = mode.label,
                    style = SpentyType.Subheadline,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

// MARK: - Filter Section

@Composable
private fun FilterSection(
    filterType: String,
    filterAccountId: String,
    accounts: List<com.spentyai.app.core.models.Account>,
    hasDateFilter: Boolean,
    onFilterTypeChange: (String) -> Unit,
    onAccountChange: (String) -> Unit,
    onDateFilterClick: () -> Unit,
    onClearDateFilter: () -> Unit,
    accountNameResolver: (String) -> String
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(top = 8.dp)
    ) {
        // Type chips
        FilterBar(
            options = listOf(
                FilterOption("All", "All"),
                FilterOption("Income", "Income"),
                FilterOption("Expense", "Expense"),
                FilterOption("Transfer", "Transfer")
            ),
            selectedId = filterType,
            onSelectionChange = { onFilterTypeChange(it ?: "All") },
            showAllOption = false
        )

        // Account & date row
        Row(
            modifier = Modifier.padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Account dropdown
            AccountFilterChip(
                filterAccountId = filterAccountId,
                accounts = accounts,
                onAccountChange = onAccountChange,
                accountNameResolver = accountNameResolver
            )

            // Date range button
            DateRangeChip(
                hasDateFilter = hasDateFilter,
                onClick = onDateFilterClick,
                onClear = onClearDateFilter
            )
        }
    }
}

@Composable
private fun AccountFilterChip(
    filterAccountId: String,
    accounts: List<com.spentyai.app.core.models.Account>,
    onAccountChange: (String) -> Unit,
    accountNameResolver: (String) -> String
) {
    var expanded by remember { mutableStateOf(false) }
    val isActive = filterAccountId.isNotEmpty()
    val label = if (isActive) accountNameResolver(filterAccountId) else "Account"

    Box {
        Surface(
            onClick = { expanded = true },
            shape = RoundedCornerShape(20.dp),
            color = if (isActive) SpentyPrimary.copy(alpha = 0.1f) else MaterialTheme.colorScheme.background,
            border = androidx.compose.foundation.BorderStroke(
                1.dp,
                if (isActive) SpentyPrimary.copy(alpha = 0.3f) else MaterialTheme.colorScheme.outline
            )
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Outlined.AccountBalance,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = if (isActive) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = label,
                    style = SpentyType.Footnote,
                    color = if (isActive) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Icon(
                    Icons.Filled.ArrowDropDown,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = if (isActive) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("All Accounts", style = SpentyType.Body) },
                onClick = {
                    onAccountChange("")
                    expanded = false
                }
            )
            accounts.forEach { account ->
                DropdownMenuItem(
                    text = { Text(account.name ?: "Unnamed", style = SpentyType.Body) },
                    onClick = {
                        onAccountChange(account.id)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun DateRangeChip(
    hasDateFilter: Boolean,
    onClick: () -> Unit,
    onClear: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        color = if (hasDateFilter) SpentyPrimary.copy(alpha = 0.1f) else MaterialTheme.colorScheme.background,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (hasDateFilter) SpentyPrimary.copy(alpha = 0.3f) else MaterialTheme.colorScheme.outline
        )
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Outlined.DateRange,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = if (hasDateFilter) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = if (hasDateFilter) "Date Set" else "Date Range",
                style = SpentyType.Footnote,
                color = if (hasDateFilter) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (hasDateFilter) {
                Icon(
                    Icons.Filled.Close,
                    contentDescription = "Clear date filter",
                    modifier = Modifier
                        .size(14.dp)
                        .clickable { onClear() },
                    tint = SpentyPrimary
                )
            }
        }
    }
}

// MARK: - Bulk Action Bar

@Composable
private fun BulkActionBar(
    selectedCount: Int,
    onDelete: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "$selectedCount selected",
            style = SpentyType.Footnote,
            color = MaterialTheme.colorScheme.onSurface
        )

        TextButton(
            onClick = onDelete,
            colors = ButtonDefaults.textButtonColors(contentColor = SpentyError)
        ) {
            Icon(Icons.Filled.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text("Delete", style = SpentyType.Footnote)
        }
    }
}

// MARK: - Transaction List

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TransactionList(
    state: TransactionsUiState,
    onTransactionClick: (Transaction) -> Unit,
    onLongPress: (Transaction) -> Unit,
    onDelete: (String) -> Unit,
    onEdit: (Transaction) -> Unit,
    onLoadMore: () -> Unit,
    onRefresh: () -> Unit,
    categoryNameResolver: (String?) -> String,
    accountNameResolver: (String?) -> String
) {
    val listState = rememberLazyListState()
    var isRefreshing by remember { mutableStateOf(false) }

    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = {
            isRefreshing = true
            onRefresh()
            isRefreshing = false
        },
        modifier = Modifier.fillMaxSize()
    ) {
        LazyColumn(
            state = listState,
            contentPadding = PaddingValues(bottom = 80.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(
                items = state.transactions,
                key = { it.id }
            ) { txn ->
                TransactionRow(
                    transaction = txn,
                    isSelecting = state.isSelecting,
                    isSelected = state.selectedIds.contains(txn.id),
                    categoryName = txn.categoryName ?: categoryNameResolver(txn.categoryId),
                    accountName = txn.accountName ?: accountNameResolver(txn.accountId),
                    onClick = { onTransactionClick(txn) },
                    onLongClick = { onLongPress(txn) }
                )

                HorizontalDivider(
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                    modifier = Modifier.padding(horizontal = 16.dp)
                )

                // Infinite scroll trigger
                LaunchedEffect(txn.id) {
                    if (txn.id == state.transactions.lastOrNull()?.id) {
                        onLoadMore()
                    }
                }
            }

            if (state.isLoadingMore) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(32.dp),
                            color = SpentyPrimary,
                            strokeWidth = 3.dp
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Transaction Row

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TransactionRow(
    transaction: Transaction,
    isSelecting: Boolean,
    isSelected: Boolean,
    categoryName: String,
    accountName: String,
    onClick: () -> Unit,
    onLongClick: () -> Unit
) {
    val dateFormatter = remember { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            )
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Selection checkbox
        if (isSelecting) {
            Icon(
                imageVector = if (isSelected) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = if (isSelected) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // Type icon
        TransactionTypeIcon(type = transaction.transactionType)

        // Description and details
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = transaction.description ?: "No description",
                style = SpentyType.Subheadline,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = categoryName,
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "\u00B7",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = accountName,
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            transaction.date?.let { dateStr ->
                Text(
                    text = dateStr.take(10), // yyyy-MM-dd from ISO string
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
            }
        }

        // Amount
        Text(
            text = formatCurrency(transaction.amount ?: 0.0),
            style = SpentyType.AmountSmall,
            color = amountColor(transaction.transactionType)
        )
    }
}

// MARK: - Transaction Type Icon

@Composable
private fun TransactionTypeIcon(type: String?) {
    val (icon, color) = when (type?.lowercase()) {
        "income" -> Icons.Filled.ArrowDownward to SpentySuccess
        "expense" -> Icons.Filled.ArrowUpward to SpentyError
        "transfer" -> Icons.Filled.SwapHoriz to SpentyInfo
        else -> Icons.Filled.Circle to MaterialTheme.colorScheme.onSurfaceVariant
    }

    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(color.copy(alpha = 0.12f)),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = type,
            modifier = Modifier.size(20.dp),
            tint = color
        )
    }
}

// MARK: - Date Filter Dialog

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateFilterDialog(
    dateFrom: String?,
    dateTo: String?,
    onApply: (String?, String?) -> Unit,
    onDismiss: () -> Unit
) {
    var fromText by remember { mutableStateOf(dateFrom ?: "") }
    var toText by remember { mutableStateOf(dateTo ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Date Range", style = SpentyType.Headline)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = fromText,
                    onValueChange = { fromText = it },
                    label = { Text("From (yyyy-MM-dd)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors()
                )
                OutlinedTextField(
                    value = toText,
                    onValueChange = { toText = it },
                    label = { Text("To (yyyy-MM-dd)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onApply(
                        fromText.ifEmpty { null },
                        toText.ifEmpty { null }
                    )
                },
                colors = SpentyStyle.primaryButtonColors(),
                shape = SpentyStyle.primaryButtonShape
            ) {
                Text("Apply", style = SpentyType.Headline)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        shape = SpentyStyle.cardShape
    )
}

// MARK: - Helpers

private fun amountColor(type: String?): Color {
    return when (type?.lowercase()) {
        "income" -> SpentySuccess
        "expense" -> SpentyError
        "transfer" -> SpentyInfo
        else -> Color.Unspecified
    }
}

private fun formatCurrency(amount: Double): String {
    val formatter = java.text.NumberFormat.getCurrencyInstance(java.util.Locale("en", "IN"))
    formatter.maximumFractionDigits = 2
    formatter.minimumFractionDigits = 2
    return formatter.format(amount)
}
