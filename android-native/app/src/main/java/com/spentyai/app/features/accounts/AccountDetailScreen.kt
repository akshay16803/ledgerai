package com.spentyai.app.features.accounts

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.*
import com.spentyai.app.core.models.*
import com.spentyai.app.core.theme.*
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountDetailScreen(
    accountId: String,
    viewModel: AccountsViewModel,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val account = state.selectedAccount
    var selectedTab by remember { mutableIntStateOf(0) }
    var isEditingOpeningBalance by remember { mutableStateOf(false) }
    var editOpeningBalance by remember { mutableStateOf("") }
    var editAsOfDate by remember { mutableStateOf("") }

    val isLoan = account?.accountType?.lowercase() == "liability"
    val isOD = account?.subType?.lowercase()?.let { it.contains("od") || it.contains("overdraft") } == true
    val isDemat = account?.accountType?.lowercase() == "investment" &&
        (account.subType?.lowercase()?.contains("demat") == true)

    LaunchedEffect(accountId) {
        viewModel.loadAccountDetail(accountId)
        viewModel.loadFilterCategories()
    }

    LaunchedEffect(isLoan) {
        if (isLoan) viewModel.loadAmortization(accountId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(account?.name ?: "Account", style = SpentyType.Headline) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.showForm(account) }) {
                        Icon(Icons.Filled.Edit, contentDescription = "Edit", tint = SpentyPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (state.isDetailLoading && account == null) {
                LoadingView(message = "Loading account...")
            } else if (account != null) {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    // Info card
                    item { AccountInfoCard(account, isEditingOpeningBalance, editOpeningBalance, editAsOfDate,
                        onEditBalance = {
                            editOpeningBalance = account.openingBalance?.let { String.format("%.2f", it) } ?: ""
                            editAsOfDate = account.balanceAsOfDate ?: SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                            isEditingOpeningBalance = true
                        },
                        onCancelEdit = { isEditingOpeningBalance = false },
                        onSaveBalance = {
                            val amount = editOpeningBalance.toDoubleOrNull() ?: return@AccountInfoCard
                            viewModel.updateOpeningBalance(accountId, amount, editAsOfDate)
                            isEditingOpeningBalance = false
                        },
                        onBalanceChange = { editOpeningBalance = it },
                        onDateChange = { editAsOfDate = it },
                        isSaving = state.isSaving
                    ) }

                    // Tab selector
                    item {
                        val tabs = buildList {
                            add("Transactions")
                            if (isLoan) add("Amortization")
                            if (isOD) add("OD Interest")
                            if (isDemat) add("Demat")
                        }
                        TabRow(tabs, selectedTab) { selectedTab = it }
                    }

                    // Tab content
                    item {
                        val tabLabels = buildList {
                            add("Transactions")
                            if (isLoan) add("Amortization")
                            if (isOD) add("OD Interest")
                            if (isDemat) add("Demat")
                        }
                        val label = tabLabels.getOrElse(selectedTab) { "Transactions" }
                        when (label) {
                            "Transactions" -> TransactionsSection(
                                viewModel = viewModel,
                                accountId = accountId,
                                state = state
                            )
                            "Amortization" -> AmortizationSection(state)
                            "OD Interest" -> ODInterestSection(viewModel, accountId, state, account)
                            "Demat" -> DematUploadSection(viewModel, accountId, state)
                        }
                    }

                    item { Spacer(modifier = Modifier.height(32.dp)) }
                }
            }

            // Error banner
            ErrorBanner(
                message = state.errorMessage ?: "",
                isVisible = state.errorMessage != null,
                onDismiss = { viewModel.dismissError() },
                modifier = Modifier.align(Alignment.TopCenter).padding(horizontal = 16.dp, vertical = 8.dp)
            )
        }
    }

    if (state.showingForm) {
        AccountFormScreen(
            viewModel = viewModel,
            account = state.editingAccount,
            onDismiss = { viewModel.hideForm() }
        )
    }
}

@Composable
private fun AccountInfoCard(
    account: Account,
    isEditingBalance: Boolean,
    editBalance: String,
    editDate: String,
    onEditBalance: () -> Unit,
    onCancelEdit: () -> Unit,
    onSaveBalance: () -> Unit,
    onBalanceChange: (String) -> Unit,
    onDateChange: (String) -> Unit,
    isSaving: Boolean
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Icon and type
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(AccountsViewModel.colorForAccountType(account.accountType ?: "").copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = iconForAccountType(account.accountType ?: ""),
                        contentDescription = null,
                        modifier = Modifier.size(22.dp),
                        tint = AccountsViewModel.colorForAccountType(account.accountType ?: "")
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Text(
                        text = account.name ?: "Unnamed",
                        style = SpentyType.Title3,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = account.accountType?.replaceFirstChar { it.uppercase() } ?: "",
                            style = SpentyType.Caption1,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (!account.subType.isNullOrEmpty()) {
                            StatusBadge(
                                text = AccountsViewModel.friendlySubType(account.subType),
                                variant = BadgeVariant.INFO
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Balance
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Current Balance",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                CurrencyText(
                    amount = account.balance ?: 0.0,
                    currencyCode = account.currency ?: "INR",
                    size = CurrencySize.LARGE,
                    colorBySign = true
                )
            }

            Spacer(modifier = Modifier.height(16.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            Spacer(modifier = Modifier.height(12.dp))

            // Opening balance section
            if (isEditingBalance) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Set Opening Balance", style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold))
                        Spacer(modifier = Modifier.weight(1f))
                        IconButton(onClick = onCancelEdit, modifier = Modifier.size(24.dp)) {
                            Icon(Icons.Filled.Close, contentDescription = "Cancel", modifier = Modifier.size(20.dp))
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = editBalance,
                        onValueChange = onBalanceChange,
                        label = { Text("Amount") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = editDate,
                        onValueChange = onDateChange,
                        label = { Text("As-of Date (YYYY-MM-DD)") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Balance will be recalculated from this date onward.",
                        style = SpentyType.Caption2,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = onSaveBalance,
                        modifier = SpentyStyle.primaryButtonModifier,
                        colors = SpentyStyle.primaryButtonColors(),
                        shape = SpentyStyle.primaryButtonShape,
                        enabled = !isSaving && editBalance.isNotEmpty()
                    ) {
                        if (isSaving) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(if (isSaving) "Saving..." else "Save & Recalculate", style = SpentyType.Headline)
                    }
                }
            } else {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onEditBalance() }
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.Payments, contentDescription = null, modifier = Modifier.size(18.dp), tint = SpentyPrimary)
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Opening Balance", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (account.openingBalance != null) {
                            Text(
                                text = formatCurrency(account.openingBalance, account.currency ?: "INR"),
                                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        } else {
                            Text("Not set - tap to add", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    if (account.balanceAsOfDate != null) {
                        Text("as-of ${account.balanceAsOfDate}", style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.size(18.dp), tint = SpentyPrimary)
                }
            }

            // Detail grid
            Spacer(modifier = Modifier.height(12.dp))
            DetailGrid(account)
        }
    }
}

@Composable
private fun DetailGrid(account: Account) {
    val items = buildList {
        if (!account.accountNumber.isNullOrEmpty()) add("Account No." to account.accountNumber!!)
        account.currency?.let { add("Currency" to it) }
        if (account.accountType?.lowercase() == "liability") {
            account.loanInterestRate?.let { add("Interest Rate" to "${it}%") }
            account.loanTenureMonths?.let { add("Tenure" to "$it months") }
            account.loanEmiAmount?.let { add("EMI" to formatCurrency(it, account.currency ?: "INR")) }
            account.loanEmiDay?.let { add("EMI Day" to "$it") }
            account.loanSanctionedAmount?.let { add("Sanctioned" to formatCurrency(it, account.currency ?: "INR")) }
        }
        if (!account.brokerName.isNullOrEmpty()) add("Broker" to account.brokerName!!)
    }

    if (items.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items.chunked(2).forEach { row ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    row.forEach { (label, value) ->
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = label, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(text = value, style = SpentyType.Callout.copy(fontWeight = FontWeight.Medium), color = MaterialTheme.colorScheme.onSurface, maxLines = 1)
                        }
                    }
                    if (row.size == 1) Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun TabRow(tabs: List<String>, selectedTab: Int, onTabSelected: (Int) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        itemsIndexed(tabs) { index, tab ->
            val isSelected = selectedTab == index
            FilterChip(
                selected = isSelected,
                onClick = { onTabSelected(index) },
                label = { Text(tab, style = SpentyType.Footnote.copy(fontWeight = FontWeight.Medium)) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SpentyPrimary,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                    containerColor = MaterialTheme.colorScheme.surface,
                    labelColor = MaterialTheme.colorScheme.onSurface
                ),
                shape = RoundedCornerShape(20.dp)
            )
        }
    }
}

@Composable
private fun TransactionsSection(
    viewModel: AccountsViewModel,
    accountId: String,
    state: AccountsUiState
) {
    var showDateFilters by remember { mutableStateOf(false) }
    val hasActiveFilters = state.filterTransactionType.isNotEmpty() ||
        state.filterCategoryId.isNotEmpty() ||
        state.filterStartDate != null || state.filterEndDate != null ||
        state.filterMinAmount.isNotEmpty() || state.filterMaxAmount.isNotEmpty() ||
        state.filterSearch.isNotEmpty()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Header
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Transactions", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.weight(1f))
            if (hasActiveFilters) {
                TextButton(onClick = { viewModel.resetFilters(); viewModel.loadFilteredTransactions(accountId) }) {
                    Text("Clear Filters", style = SpentyType.Caption1, color = SpentyError)
                }
            }
            Text("${state.filteredTransactionTotal} results", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        // Search
        SpentySearchBar(
            query = state.filterSearch,
            onQueryChange = { viewModel.updateFilterSearch(it) },
            placeholder = "Search transactions...",
            onSearch = { viewModel.loadFilteredTransactions(accountId) }
        )

        // Type filter chips
        Row(horizontalArrangement = Arrangement.spacedBy(0.dp), modifier = Modifier.fillMaxWidth()) {
            listOf("All" to "", "Income" to "income", "Expense" to "expense", "Transfer" to "transfer").forEach { (label, value) ->
                val isSelected = state.filterTransactionType == value
                FilterChip(
                    selected = isSelected,
                    onClick = {
                        viewModel.updateFilterTransactionType(value)
                        viewModel.loadFilteredTransactions(accountId)
                    },
                    label = { Text(label, style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold)) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = SpentyPrimary,
                        selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                    ),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Advanced filters toggle
        TextButton(onClick = { showDateFilters = !showDateFilters }) {
            Icon(Icons.Filled.FilterList, contentDescription = null, modifier = Modifier.size(14.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                "More Filters",
                style = SpentyType.Caption1.copy(fontWeight = FontWeight.Medium),
                color = if (hasActiveFilters) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (showDateFilters) {
            ElevatedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = state.filterStartDate ?: "",
                            onValueChange = { viewModel.updateFilterStartDate(it.ifEmpty { null }) },
                            label = { Text("From (YYYY-MM-DD)") },
                            modifier = Modifier.weight(1f),
                            shape = SpentyStyle.inputShape,
                            colors = SpentyStyle.inputColors(),
                            textStyle = SpentyType.Caption1
                        )
                        OutlinedTextField(
                            value = state.filterEndDate ?: "",
                            onValueChange = { viewModel.updateFilterEndDate(it.ifEmpty { null }) },
                            label = { Text("To (YYYY-MM-DD)") },
                            modifier = Modifier.weight(1f),
                            shape = SpentyStyle.inputShape,
                            colors = SpentyStyle.inputColors(),
                            textStyle = SpentyType.Caption1
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = state.filterMinAmount,
                            onValueChange = { viewModel.updateFilterMinAmount(it) },
                            label = { Text("Min Amount") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f),
                            shape = SpentyStyle.inputShape,
                            colors = SpentyStyle.inputColors(),
                            textStyle = SpentyType.Caption1
                        )
                        OutlinedTextField(
                            value = state.filterMaxAmount,
                            onValueChange = { viewModel.updateFilterMaxAmount(it) },
                            label = { Text("Max Amount") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.weight(1f),
                            shape = SpentyStyle.inputShape,
                            colors = SpentyStyle.inputColors(),
                            textStyle = SpentyType.Caption1
                        )
                    }

                    Button(
                        onClick = { viewModel.loadFilteredTransactions(accountId) },
                        modifier = SpentyStyle.primaryButtonModifier,
                        colors = SpentyStyle.primaryButtonColors(),
                        shape = SpentyStyle.primaryButtonShape
                    ) {
                        Text("Apply Filters", style = SpentyType.Headline)
                    }
                }
            }
        }

        // Transaction list
        if (state.isLoadingFilteredTransactions) {
            Box(modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = SpentyPrimary)
            }
        } else if (state.accountTransactions.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(Icons.Filled.Inbox, contentDescription = null, modifier = Modifier.size(32.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f))
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = if (hasActiveFilters) "No transactions match your filters" else "No transactions found",
                    style = SpentyType.Subheadline,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            ElevatedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation()
            ) {
                Column {
                    state.accountTransactions.forEachIndexed { index, txn ->
                        TransactionRow(txn)
                        if (index < state.accountTransactions.size - 1) {
                            HorizontalDivider(
                                modifier = Modifier.padding(start = 60.dp),
                                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TransactionRow(txn: Transaction) {
    val isIncome = txn.transactionType?.lowercase() == "income"

    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(if (isIncome) SpentySuccess.copy(alpha = 0.12f) else SpentyError.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (isIncome) Icons.Filled.ArrowDownward else Icons.Filled.ArrowUpward,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = if (isIncome) SpentySuccess else SpentyError
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = txn.description ?: "--",
                style = SpentyType.Callout,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1
            )
            Text(
                text = txn.date?.take(10) ?: "--",
                style = SpentyType.Caption1,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        CurrencyText(
            amount = if (isIncome) (txn.amount ?: 0.0) else -(txn.amount ?: 0.0),
            currencyCode = txn.originalCurrency ?: "INR",
            size = CurrencySize.SMALL,
            colorBySign = true
        )
    }
}

@Composable
private fun AmortizationSection(state: AccountsUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Amortization Schedule", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurface)

        if (state.amortizationSchedule.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = SpentyPrimary)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Loading schedule...", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else {
            // Summary cards
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                AmortizationStatCard("Total Payment", state.amortizationTotalPayment, SpentyPrimary, Modifier.weight(1f))
                AmortizationStatCard("Total Interest", state.amortizationTotalInterest, SpentyError, Modifier.weight(1f))
            }

            // Table
            AmortizationTable(state.amortizationSchedule)
        }
    }
}

@Composable
private fun AmortizationStatCard(title: String, value: Double, color: androidx.compose.ui.graphics.Color, modifier: Modifier = Modifier) {
    ElevatedCard(
        modifier = modifier,
        shape = RoundedCornerShape(10.dp),
        colors = SpentyStyle.cardColors()
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(title, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(4.dp))
            CurrencyText(amount = value, currencyCode = "INR", size = CurrencySize.SMALL, overrideColor = color)
        }
    }
}

@Composable
private fun AmortizationTable(schedule: List<AmortizationEntry>) {
    val displayEntries = schedule.take(24)

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors()
    ) {
        Column {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text("#", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(32.dp))
                Text("EMI", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
                Text("Principal", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
                Text("Interest", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
                Text("Balance", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
            }

            displayEntries.forEachIndexed { index, entry ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text("${entry.month}", style = SpentyType.Caption2, modifier = Modifier.width(32.dp))
                    Text(shortCurrency(entry.emi), style = SpentyType.Caption2, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
                    Text(shortCurrency(entry.principal), style = SpentyType.Caption2, color = SpentyPrimary, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
                    Text(shortCurrency(entry.interest), style = SpentyType.Caption2, color = SpentyWarning, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
                    Text(shortCurrency(entry.outstanding), style = SpentyType.Caption2, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
                }

                if (index < displayEntries.size - 1) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                }
            }

            if (schedule.size > 24) {
                Text(
                    text = "Showing first 24 of ${schedule.size} months",
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
private fun ODInterestSection(
    viewModel: AccountsViewModel,
    accountId: String,
    state: AccountsUiState,
    account: Account
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("OD Interest Calculator", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurface)

        ElevatedCard(
            modifier = Modifier.fillMaxWidth(),
            shape = SpentyStyle.cardShape,
            colors = SpentyStyle.cardColors()
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(state.odFromDate),
                    onValueChange = {},
                    label = { Text("From Date") },
                    modifier = Modifier.fillMaxWidth(),
                    readOnly = true,
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors()
                )
                OutlinedTextField(
                    value = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(state.odToDate),
                    onValueChange = {},
                    label = { Text("To Date") },
                    modifier = Modifier.fillMaxWidth(),
                    readOnly = true,
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors()
                )
                Button(
                    onClick = { viewModel.calculateODInterest(accountId) },
                    modifier = SpentyStyle.primaryButtonModifier,
                    colors = SpentyStyle.primaryButtonColors(),
                    shape = SpentyStyle.primaryButtonShape,
                    enabled = !state.isCalculatingOD
                ) {
                    if (state.isCalculatingOD) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Calculate Interest", style = SpentyType.Headline)
                }
            }
        }

        state.odInterestResult?.let { result ->
            ElevatedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    ODResultRow("Interest Amount", formatCurrency(result.interest, account.currency ?: "INR"), SpentyError)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                    ODResultRow("Number of Days", "${result.days}", MaterialTheme.colorScheme.onSurface)
                    result.averageBalance?.let {
                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        ODResultRow("Average Balance", formatCurrency(it, account.currency ?: "INR"), SpentyInfo)
                    }
                    result.rate?.let {
                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        ODResultRow("Effective Rate", String.format("%.2f%%", it), SpentyWarning)
                    }
                }
            }
        }
    }
}

@Composable
private fun ODResultRow(label: String, value: String, color: androidx.compose.ui.graphics.Color) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = SpentyType.Callout, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.weight(1f))
        Text(value, style = SpentyType.Headline, color = color)
    }
}

@Composable
private fun DematUploadSection(
    viewModel: AccountsViewModel,
    accountId: String,
    state: AccountsUiState
) {
    var showConfirmAction by remember { mutableStateOf<Pair<String, Boolean>?>(null) }

    LaunchedEffect(accountId) {
        viewModel.loadDematStatements(accountId)
    }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Description, contentDescription = null, modifier = Modifier.size(18.dp), tint = SpentyWarning)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Demat Statements", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurface)
        }

        // Upload area
        OutlinedCard(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            border = CardDefaults.outlinedCardBorder().copy(
                brush = androidx.compose.ui.graphics.SolidColor(SpentyPrimary.copy(alpha = 0.3f))
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SpentyPrimary.copy(alpha = 0.04f))
                    .padding(vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (state.isUploadingDemat) {
                    CircularProgressIndicator(color = SpentyPrimary)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Uploading...", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else {
                    Icon(Icons.Filled.UploadFile, contentDescription = null, modifier = Modifier.size(28.dp), tint = SpentyPrimary)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Upload CDSL / Demat Statement", style = SpentyType.Callout.copy(fontWeight = FontWeight.Medium), color = SpentyPrimary)
                    Text("PDF or CSV files supported", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        // Statements list
        if (state.isDematLoading && state.dematStatements.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = SpentyPrimary)
            }
        } else if (state.dematStatements.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("No statements uploaded", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Upload a CDSL statement to view your demat holdings.", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f), textAlign = TextAlign.Center)
            }
        } else {
            ElevatedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors()
            ) {
                Column {
                    state.dematStatements.forEachIndexed { index, statement ->
                        DematStatementRow(
                            statement = statement,
                            onApprove = { showConfirmAction = Pair(statement.id, true) },
                            onReject = { showConfirmAction = Pair(statement.id, false) }
                        )
                        if (index < state.dematStatements.size - 1) {
                            HorizontalDivider(
                                modifier = Modifier.padding(start = 48.dp),
                                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                            )
                        }
                    }
                }
            }
        }
    }

    // Confirm dialog
    showConfirmAction?.let { (id, approve) ->
        ConfirmDialog(
            title = "Confirm Action",
            message = "Are you sure you want to ${if (approve) "approve" else "reject"} this statement?",
            confirmText = if (approve) "Approve" else "Reject",
            isDestructive = !approve,
            onConfirm = {
                if (approve) viewModel.approveDematStatement(id, accountId)
                else viewModel.rejectDematStatement(id, accountId)
                showConfirmAction = null
            },
            onDismiss = { showConfirmAction = null }
        )
    }
}

@Composable
private fun DematStatementRow(
    statement: DematStatement,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(Icons.Filled.InsertDriveFile, contentDescription = null, modifier = Modifier.size(22.dp), tint = SpentyInfo)

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = statement.filename ?: "Statement",
                style = SpentyType.Callout.copy(fontWeight = FontWeight.Medium),
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                statement.createdAt?.let {
                    Text(it.take(10), style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                statement.transactionsCount?.let {
                    Text("$it entries", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        statement.status?.let {
            StatusBadge(
                text = it.replace("_", " ").replaceFirstChar { c -> c.uppercase() },
                variant = when {
                    it.contains("approved") -> BadgeVariant.SUCCESS
                    it.contains("reject") -> BadgeVariant.ERROR
                    it.contains("pending") -> BadgeVariant.WARNING
                    else -> BadgeVariant.NEUTRAL
                }
            )
        }

        if (statement.isPendingApproval) {
            Spacer(modifier = Modifier.width(4.dp))
            IconButton(onClick = onApprove, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Filled.CheckCircle, contentDescription = "Approve", tint = SpentySuccess, modifier = Modifier.size(22.dp))
            }
            IconButton(onClick = onReject, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Filled.Cancel, contentDescription = "Reject", tint = SpentyError, modifier = Modifier.size(22.dp))
            }
        }
    }
}

private fun formatCurrency(amount: Double, currencyCode: String?): String {
    return try {
        val format = NumberFormat.getCurrencyInstance(Locale.US)
        format.currency = Currency.getInstance(currencyCode ?: "INR")
        format.maximumFractionDigits = 2
        format.format(amount)
    } catch (e: Exception) {
        String.format("%.2f", amount)
    }
}

private fun shortCurrency(amount: Double): String {
    return try {
        val format = NumberFormat.getNumberInstance(Locale.US)
        format.maximumFractionDigits = 0
        format.format(amount)
    } catch (e: Exception) {
        "${amount.toInt()}"
    }
}
