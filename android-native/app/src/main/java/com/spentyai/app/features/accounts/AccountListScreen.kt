package com.spentyai.app.features.accounts

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.*
import com.spentyai.app.core.models.Account
import com.spentyai.app.core.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountListScreen(
    viewModel: AccountsViewModel,
    onAccountClick: (String) -> Unit,
    onSubTypeManager: () -> Unit = {}
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        if (state.accounts.isEmpty()) {
            viewModel.loadAccounts()
            viewModel.loadSubTypes()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Accounts", style = SpentyType.Title2) },
                actions = {
                    IconButton(onClick = { onSubTypeManager() }) {
                        Icon(Icons.Filled.Settings, contentDescription = "Sub-Types", tint = SpentyPrimary)
                    }
                    IconButton(onClick = { viewModel.showForm() }) {
                        Icon(Icons.Filled.Add, contentDescription = "Add Account", tint = SpentyPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        floatingActionButton = {
            if (state.accounts.isNotEmpty()) {
                FloatingActionButton(
                    onClick = { viewModel.showForm() },
                    containerColor = SpentyPrimary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Add Account")
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                state.isLoading && state.accounts.isEmpty() -> {
                    LoadingView(message = "Loading accounts...")
                }
                state.accounts.isEmpty() -> {
                    EmptyStateView(
                        icon = Icons.Outlined.AccountBalance,
                        title = "No Accounts Yet",
                        subtitle = "Add your first account to start tracking your finances."
                    ) {
                        Button(
                            onClick = { viewModel.showForm() },
                            colors = SpentyStyle.primaryButtonColors(),
                            shape = SpentyStyle.primaryButtonShape
                        ) {
                            Text("Add Account", style = SpentyType.Headline)
                        }
                    }
                }
                else -> {
                    val groups = viewModel.groupedAccounts()
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 80.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        // Search bar
                        item {
                            SpentySearchBar(
                                query = state.searchText,
                                onQueryChange = { viewModel.updateSearchText(it) },
                                placeholder = "Search accounts",
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                            )
                        }

                        // Total balance card
                        item {
                            TotalBalanceCard(
                                totalBalance = viewModel.totalBalance(),
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                            )
                        }

                        // Grouped sections
                        groups.forEach { group ->
                            item {
                                AccountSectionHeader(
                                    type = group.type,
                                    sectionTotal = group.accounts.sumOf { it.balance ?: 0.0 },
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)
                                )
                            }

                            item {
                                ElevatedCard(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp)
                                        .padding(bottom = 16.dp),
                                    shape = SpentyStyle.cardShape,
                                    colors = SpentyStyle.cardColors(),
                                    elevation = SpentyStyle.cardElevation()
                                ) {
                                    Column {
                                        group.accounts.forEachIndexed { index, account ->
                                            AccountRow(
                                                account = account,
                                                onClick = { onAccountClick(account.id) },
                                                onEdit = { viewModel.showForm(account) },
                                                onDelete = { viewModel.deleteAccount(account.id) }
                                            )
                                            if (index < group.accounts.size - 1) {
                                                HorizontalDivider(
                                                    modifier = Modifier.padding(start = 68.dp),
                                                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
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

    // Account form bottom sheet
    if (state.showingForm) {
        AccountFormScreen(
            viewModel = viewModel,
            account = state.editingAccount,
            onDismiss = { viewModel.hideForm() }
        )
    }
}

@Composable
private fun TotalBalanceCard(totalBalance: Double, modifier: Modifier = Modifier) {
    ElevatedCard(
        modifier = modifier.fillMaxWidth(),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Total Balance",
                style = SpentyType.Caption1,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(6.dp))
            CurrencyText(
                amount = totalBalance,
                currencyCode = "INR",
                size = CurrencySize.LARGE,
                colorBySign = true
            )
        }
    }
}

@Composable
private fun AccountSectionHeader(type: String, sectionTotal: Double, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = iconForAccountType(type),
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = AccountsViewModel.colorForAccountType(type)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = type.replaceFirstChar { it.uppercase() },
            style = SpentyType.Headline,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.weight(1f))
        CurrencyText(
            amount = sectionTotal,
            currencyCode = "INR",
            size = CurrencySize.SMALL
        )
    }
}

@Composable
private fun AccountRow(
    account: Account,
    onClick: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Type icon circle
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(
                    AccountsViewModel.colorForAccountType(account.accountType ?: "").copy(alpha = 0.12f)
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = iconForSubType(account.subType),
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = AccountsViewModel.colorForAccountType(account.accountType ?: "")
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = account.name ?: "Unnamed Account",
                style = SpentyType.Callout.copy(fontWeight = FontWeight.Medium),
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1
            )

            if (!account.subType.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = AccountsViewModel.friendlySubType(account.subType),
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                )
            }
        }

        CurrencyText(
            amount = account.balance ?: 0.0,
            currencyCode = account.currency ?: "INR",
            size = CurrencySize.SMALL,
            colorBySign = true
        )

        Box {
            IconButton(onClick = { showMenu = true }, modifier = Modifier.size(32.dp)) {
                Icon(
                    Icons.Filled.MoreVert,
                    contentDescription = "More",
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                DropdownMenuItem(
                    text = { Text("Edit") },
                    onClick = { showMenu = false; onEdit() },
                    leadingIcon = { Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.size(18.dp)) }
                )
                DropdownMenuItem(
                    text = { Text("Delete", color = SpentyError) },
                    onClick = { showMenu = false; onDelete() },
                    leadingIcon = { Icon(Icons.Filled.Delete, contentDescription = null, modifier = Modifier.size(18.dp), tint = SpentyError) }
                )
            }
        }
    }
}

fun iconForAccountType(type: String): ImageVector {
    return when (type.lowercase()) {
        "asset" -> Icons.Filled.AccountBalance
        "liability" -> Icons.Filled.CreditCard
        "equity" -> Icons.Filled.PieChart
        "investment" -> Icons.Filled.TrendingUp
        else -> Icons.Filled.AccountBalanceWallet
    }
}

fun iconForSubType(subType: String?): ImageVector {
    return when (subType?.lowercase()) {
        "bank", "savings", "current" -> Icons.Filled.AccountBalance
        "credit_card", "credit card" -> Icons.Filled.CreditCard
        "cash" -> Icons.Filled.Payments
        "wallet", "digital_wallet" -> Icons.Filled.AccountBalanceWallet
        "investment", "demat" -> Icons.Filled.TrendingUp
        "loan" -> Icons.Filled.Percent
        "overdraft", "od" -> Icons.Filled.Sync
        "fixed_deposit", "fd" -> Icons.Filled.Lock
        else -> Icons.Filled.AccountBalance
    }
}
