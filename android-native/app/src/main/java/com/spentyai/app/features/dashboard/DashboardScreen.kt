package com.spentyai.app.features.dashboard

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowCircleDown
import androidx.compose.material.icons.filled.ArrowCircleUp
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Money
import androidx.compose.material.icons.filled.Percent
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spentyai.app.core.components.ErrorBanner
import com.spentyai.app.core.components.LoadingView
import com.spentyai.app.core.models.Account
import com.spentyai.app.core.models.PendingTransaction
import com.spentyai.app.core.models.Transaction
import com.spentyai.app.core.theme.SpentyAccent1
import com.spentyai.app.core.theme.SpentyAccent3
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyInfo
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentySuccess
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning
import java.text.NumberFormat
import java.util.Calendar
import java.util.Currency
import java.util.Locale
import kotlin.math.abs

// ==========================================
// Currency Formatting Helper (INR)
// ==========================================

private fun formatCurrency(value: Double): String {
    val absValue = abs(value)
    val sign = if (value < 0) "-" else ""
    return when {
        absValue >= 1_00_00_000 -> {
            val crores = absValue / 1_00_00_000
            "${sign}\u20B9${String.format("%.1f", crores)}Cr"
        }
        absValue >= 1_00_000 -> {
            val lakhs = absValue / 1_00_000
            "${sign}\u20B9${String.format("%.1f", lakhs)}L"
        }
        absValue >= 1_000 -> {
            val thousands = absValue / 1_000
            "${sign}\u20B9${String.format("%.1f", thousands)}K"
        }
        else -> {
            try {
                val format = NumberFormat.getCurrencyInstance(Locale("en", "IN"))
                format.currency = Currency.getInstance("INR")
                format.maximumFractionDigits = 0
                format.minimumFractionDigits = 0
                format.format(value)
            } catch (_: Exception) {
                "\u20B9${value.toInt()}"
            }
        }
    }
}

// ==========================================
// Icon / Color / SubType Helpers
// ==========================================

private fun iconForAccountType(subType: String?): ImageVector {
    return when (subType?.lowercase()) {
        "bank", "savings", "current" -> Icons.Filled.AccountBalance
        "credit_card", "credit card" -> Icons.Filled.CreditCard
        "cash" -> Icons.Filled.Money
        "wallet", "digital_wallet" -> Icons.Filled.Wallet
        "investment", "demat" -> Icons.Filled.ShowChart
        "loan" -> Icons.Filled.Percent
        else -> Icons.Filled.AccountBalance
    }
}

private fun colorForAccountSubType(subType: String?): Color {
    return when (subType?.lowercase()) {
        "bank", "savings", "current" -> SpentyPrimary
        "cash" -> SpentyWarning
        "credit_card", "credit card" -> SpentyAccent1
        "wallet", "digital_wallet" -> SpentyInfo
        "investment", "demat" -> SpentyInfo
        "loan", "overdraft", "od" -> SpentyError
        else -> SpentyPrimary
    }
}

private fun friendlySubType(subType: String): String {
    return when (subType.lowercase()) {
        "bank" -> "Bank Account"
        "cash" -> "Cash"
        "credit_card", "credit card" -> "Credit Card"
        "digital_wallet", "wallet" -> "Digital Wallet"
        "overdraft", "od" -> "Overdraft"
        "demat" -> "Demat Account"
        "loan" -> "Loan"
        "savings" -> "Savings"
        "current" -> "Current Account"
        "fixed_deposit", "fd" -> "Fixed Deposit"
        else -> subType.replace("_", " ").replaceFirstChar { it.uppercase() }
    }
}

private fun iconForTransactionType(type: String?): ImageVector {
    return when (type?.lowercase()) {
        "income" -> Icons.Filled.ArrowCircleDown
        "expense" -> Icons.Filled.ArrowCircleUp
        "transfer" -> Icons.Filled.SwapHoriz
        else -> Icons.Filled.ArrowCircleUp
    }
}

private fun colorForTransactionType(type: String?): Color {
    return when (type?.lowercase()) {
        "income" -> SpentySuccess
        "expense" -> SpentyAccent1
        "transfer" -> SpentyInfo
        else -> Color.Gray
    }
}

// ==========================================
// Next Month Name Helper
// ==========================================

private fun nextMonthName(): String {
    val calendar = Calendar.getInstance()
    calendar.add(Calendar.MONTH, 1)
    val monthNames = arrayOf(
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    )
    return monthNames[calendar.get(Calendar.MONTH)]
}

// ==========================================
// Dashboard Screen
// ==========================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onAccountClick: (String) -> Unit = {},
    onTransactionClick: (String) -> Unit = {},
    onPendingClick: (PendingTransaction) -> Unit = {},
    onNewTransactionClick: () -> Unit = {},
    onAIChatClick: () -> Unit = {},
    onNetWorthClick: () -> Unit = {},
    onIncomeClick: () -> Unit = {},
    onExpenseClick: () -> Unit = {},
    onPendingReviewClick: () -> Unit = {},
    onProjectionClick: () -> Unit = {}
) {
    val state by viewModel.uiState.collectAsState()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()

    LaunchedEffect(Unit) {
        viewModel.loadSummary()
    }

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            LargeTopAppBar(
                title = {
                    Text(
                        text = "Dashboard",
                        style = SpentyType.LargeTitle
                    )
                },
                actions = {
                    // AI Chat button - green pill with sparkles icon
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(SpentyPrimary.copy(alpha = 0.1f))
                            .clickable { onAIChatClick() }
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.AutoAwesome,
                            contentDescription = "AI Chat",
                            modifier = Modifier.size(14.dp),
                            tint = SpentyPrimary
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "AI",
                            style = SpentyType.Caption1.copy(
                                fontWeight = FontWeight.SemiBold
                            ),
                            color = SpentyPrimary
                        )
                    }
                },
                scrollBehavior = scrollBehavior,
                colors = TopAppBarDefaults.largeTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    scrolledContainerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNewTransactionClick,
                containerColor = SpentyPrimary,
                contentColor = Color.White,
                shape = CircleShape,
                modifier = Modifier
                    .size(56.dp)
                    .shadow(
                        elevation = 12.dp,
                        shape = CircleShape,
                        ambientColor = SpentyPrimary.copy(alpha = 0.35f),
                        spotColor = SpentyPrimary.copy(alpha = 0.35f)
                    )
            ) {
                Icon(
                    imageVector = Icons.Filled.Add,
                    contentDescription = "New Transaction",
                    modifier = Modifier.size(22.dp)
                )
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->

        if (state.isLoading && !viewModel.hasData) {
            LoadingView(
                message = "Loading your dashboard...",
                modifier = Modifier.padding(paddingValues)
            )
        } else {
            val pullRefreshState = rememberPullToRefreshState()
            var isRefreshing by remember { mutableStateOf(false) }

            PullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh = {
                    isRefreshing = true
                    viewModel.refresh()
                    isRefreshing = false
                },
                state = pullRefreshState,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    // Error banner
                    if (state.showError) {
                        ErrorBanner(
                            message = state.errorMessage,
                            isVisible = true,
                            onDismiss = { viewModel.dismissError() },
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                    }

                    // Stats grid (2x2)
                    StatsGrid(
                        viewModel = viewModel,
                        onNetWorthClick = onNetWorthClick,
                        onIncomeClick = onIncomeClick,
                        onExpenseClick = onExpenseClick,
                        onPendingClick = onPendingReviewClick,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )

                    // Next Month Projection tile
                    if (viewModel.hasProjectionData) {
                        NextMonthProjectionTile(
                            viewModel = viewModel,
                            onClick = onProjectionClick,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                    }

                    // Accounts section
                    if (viewModel.accounts.isNotEmpty()) {
                        AccountsSection(
                            accounts = viewModel.accounts,
                            onAccountClick = onAccountClick,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                    }

                    // Recent transactions section
                    if (viewModel.recentTransactions.isNotEmpty()) {
                        RecentTransactionsSection(
                            transactions = viewModel.recentTransactions,
                            onTransactionClick = onTransactionClick,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                    }

                    // Pending approval section
                    PendingApprovalSection(
                        pendingTransactions = state.pendingTransactions,
                        pendingCount = viewModel.pendingReview,
                        isLoading = state.isLoadingPending,
                        onPendingClick = onPendingClick,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )

                    // Bottom spacer for FAB clearance
                    Spacer(modifier = Modifier.height(80.dp))
                }
            }
        }
    }
}

// ==========================================
// Stats Grid (2x2)
// ==========================================

@Composable
private fun StatsGrid(
    viewModel: DashboardViewModel,
    onNetWorthClick: () -> Unit,
    onIncomeClick: () -> Unit,
    onExpenseClick: () -> Unit,
    onPendingClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MiniStatCard(
                label = "Net Worth",
                value = formatCurrency(viewModel.netWorth),
                icon = Icons.Filled.Money,
                iconColor = if (viewModel.netWorth >= 0) SpentySuccess else SpentyError,
                onClick = onNetWorthClick,
                modifier = Modifier.weight(1f)
            )
            MiniStatCard(
                label = "Income This Month",
                value = formatCurrency(viewModel.incomeThisMonth),
                icon = Icons.Filled.ArrowCircleDown,
                iconColor = SpentySuccess,
                onClick = onIncomeClick,
                modifier = Modifier.weight(1f)
            )
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MiniStatCard(
                label = "Expenses This Month",
                value = formatCurrency(viewModel.expenseThisMonth),
                icon = Icons.Filled.ArrowCircleUp,
                iconColor = SpentyAccent1,
                onClick = onExpenseClick,
                modifier = Modifier.weight(1f)
            )
            MiniStatCard(
                label = "Pending Review",
                value = "${viewModel.pendingReview}",
                icon = Icons.Filled.Schedule,
                iconColor = SpentyWarning,
                onClick = onPendingClick,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun MiniStatCard(
    label: String,
    value: String,
    icon: ImageVector,
    iconColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    ElevatedCard(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(14.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                modifier = Modifier.size(28.dp),
                tint = iconColor
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                style = SpentyType.Title3,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = label,
                style = SpentyType.Caption1,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// ==========================================
// Next Month Projection Tile
// ==========================================

@Composable
private fun NextMonthProjectionTile(
    viewModel: DashboardViewModel,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    ElevatedCard(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(SpentyPrimary.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.CalendarMonth,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                        tint = SpentyPrimary
                    )
                }

                Spacer(modifier = Modifier.width(10.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "${nextMonthName()} Projection",
                        style = SpentyType.Headline,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Upcoming outflows next month",
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Breakdown row
            Row(
                modifier = Modifier.fillMaxWidth()
            ) {
                ProjectionMiniStat(
                    label = "Expenses",
                    amount = viewModel.nextMonthExpense,
                    color = SpentyAccent1,
                    modifier = Modifier.weight(1f)
                )
                ProjectionMiniStat(
                    label = "EMIs",
                    amount = viewModel.nextMonthEMI,
                    color = SpentyAccent3,
                    modifier = Modifier.weight(1f)
                )
                ProjectionMiniStat(
                    label = "OD Interest",
                    amount = viewModel.nextMonthODInterest,
                    color = SpentyAccent1,
                    modifier = Modifier.weight(1f)
                )
            }

            // Total bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Total Outflow",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = formatCurrency(viewModel.nextMonthTotalOutflow),
                    style = SpentyType.AmountSmall,
                    color = SpentyAccent1
                )
            }
        }
    }
}

@Composable
private fun ProjectionMiniStat(
    label: String,
    amount: Double,
    color: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = formatCurrency(amount),
            style = SpentyType.Caption1.copy(fontWeight = FontWeight.Bold),
            color = color,
            maxLines = 1,
            textAlign = TextAlign.Center
        )
        Text(
            text = label,
            style = SpentyType.Caption2,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

// ==========================================
// Collapsible Section Header
// ==========================================

@Composable
private fun CollapsibleSectionHeader(
    title: String,
    icon: ImageVector,
    count: Int,
    isExpanded: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    val chevronRotation by animateFloatAsState(
        targetValue = if (isExpanded) 90f else 0f,
        animationSpec = tween(durationMillis = 250),
        label = "chevronRotation"
    )

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onToggle() },
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(14.dp),
            tint = SpentyPrimary
        )

        Spacer(modifier = Modifier.width(8.dp))

        Text(
            text = "$title ($count)",
            style = SpentyType.Headline,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.weight(1f))

        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
            contentDescription = if (isExpanded) "Collapse" else "Expand",
            modifier = Modifier
                .size(12.dp)
                .rotate(chevronRotation),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// ==========================================
// Accounts Section
// ==========================================

@Composable
private fun AccountsSection(
    accounts: List<Account>,
    onAccountClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var isExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        CollapsibleSectionHeader(
            title = "Accounts",
            icon = Icons.Filled.AccountBalance,
            count = accounts.size,
            isExpanded = isExpanded,
            onToggle = { isExpanded = !isExpanded }
        )

        AnimatedVisibility(
            visible = isExpanded,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut()
        ) {
            ElevatedCard(
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation()
            ) {
                Column {
                    accounts.forEachIndexed { index, account ->
                        AccountRow(
                            account = account,
                            onClick = { onAccountClick(account.id) }
                        )
                        if (index < accounts.size - 1) {
                            Divider(
                                modifier = Modifier.padding(start = 48.dp),
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
private fun AccountRow(
    account: Account,
    onClick: () -> Unit
) {
    val subType = account.subType
    val accountColor = colorForAccountSubType(subType)
    val accountIcon = iconForAccountType(subType)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Colored circle icon
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(accountColor.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = accountIcon,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = accountColor
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = account.name ?: "Unnamed Account",
                style = SpentyType.Subheadline,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (!subType.isNullOrEmpty()) {
                Text(
                    text = friendlySubType(subType),
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Text(
            text = formatCurrency(account.balance ?: 0.0),
            style = SpentyType.AmountSmall,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.width(8.dp))

        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
            contentDescription = null,
            modifier = Modifier.size(12.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        )
    }
}

// ==========================================
// Recent Transactions Section
// ==========================================

@Composable
private fun RecentTransactionsSection(
    transactions: List<Transaction>,
    onTransactionClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var isExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        CollapsibleSectionHeader(
            title = "Recent Transactions",
            icon = Icons.Filled.History,
            count = transactions.size,
            isExpanded = isExpanded,
            onToggle = { isExpanded = !isExpanded }
        )

        AnimatedVisibility(
            visible = isExpanded,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut()
        ) {
            ElevatedCard(
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation()
            ) {
                Column {
                    transactions.forEachIndexed { index, txn ->
                        TransactionRow(
                            transaction = txn,
                            onClick = { onTransactionClick(txn.id) }
                        )
                        if (index < transactions.size - 1) {
                            Divider(
                                modifier = Modifier.padding(start = 48.dp),
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
private fun TransactionRow(
    transaction: Transaction,
    onClick: () -> Unit
) {
    val txnType = transaction.transactionType
    val txnColor = colorForTransactionType(txnType)
    val txnIcon = iconForTransactionType(txnType)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Colored circle icon
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(txnColor.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = txnIcon,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = txnColor
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = transaction.description ?: "Transaction",
                style = SpentyType.Subheadline,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (!transaction.date.isNullOrEmpty()) {
                Text(
                    text = formatTransactionDate(transaction.date),
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Text(
            text = formatCurrency(transaction.amount ?: 0.0),
            style = SpentyType.AmountSmall,
            color = txnColor
        )
    }
}

// ==========================================
// Pending Approval Section
// ==========================================

@Composable
private fun PendingApprovalSection(
    pendingTransactions: List<PendingTransaction>,
    pendingCount: Int,
    isLoading: Boolean,
    onPendingClick: (PendingTransaction) -> Unit,
    modifier: Modifier = Modifier
) {
    var isExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        CollapsibleSectionHeader(
            title = "Pending Approval",
            icon = Icons.Filled.Email,
            count = pendingCount,
            isExpanded = isExpanded,
            onToggle = { isExpanded = !isExpanded }
        )

        AnimatedVisibility(
            visible = isExpanded,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut()
        ) {
            ElevatedCard(
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation()
            ) {
                when {
                    isLoading -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = SpentyPrimary,
                                strokeWidth = 2.dp
                            )
                        }
                    }
                    pendingTransactions.isEmpty() -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No pending transactions",
                                style = SpentyType.Subheadline,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    else -> {
                        Column {
                            pendingTransactions.forEachIndexed { index, txn ->
                                PendingRow(
                                    transaction = txn,
                                    onClick = { onPendingClick(txn) }
                                )
                                if (index < pendingTransactions.size - 1) {
                                    Divider(
                                        modifier = Modifier.padding(start = 48.dp),
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

@Composable
private fun PendingRow(
    transaction: PendingTransaction,
    onClick: () -> Unit
) {
    val sourceIcon = if (transaction.source == "sms") Icons.Filled.Sms else Icons.Filled.Email
    val amountColor = if (transaction.transactionType == "income") SpentySuccess else SpentyAccent1

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Warning-colored circle with source icon
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(SpentyWarning.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = sourceIcon,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = SpentyWarning
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = transaction.description ?: "Transaction",
                style = SpentyType.Subheadline,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (!transaction.date.isNullOrEmpty()) {
                Text(
                    text = formatTransactionDate(transaction.date),
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Text(
            text = formatCurrency(transaction.amount ?: 0.0),
            style = SpentyType.AmountSmall,
            color = amountColor
        )

        Spacer(modifier = Modifier.width(8.dp))

        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
            contentDescription = null,
            modifier = Modifier.size(12.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        )
    }
}

// ==========================================
// Date formatting helper
// ==========================================

private fun formatTransactionDate(dateString: String?): String {
    if (dateString.isNullOrEmpty()) return ""
    return try {
        val inputFormats = listOf(
            java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US),
            java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US),
            java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US)
        )
        val outputFormat = java.text.SimpleDateFormat("MMM d, yyyy", Locale.US)
        for (format in inputFormats) {
            try {
                val date = format.parse(dateString)
                if (date != null) return outputFormat.format(date)
            } catch (_: Exception) { }
        }
        dateString
    } catch (_: Exception) {
        dateString
    }
}
