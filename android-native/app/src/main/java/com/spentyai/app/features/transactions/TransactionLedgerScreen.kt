package com.spentyai.app.features.transactions

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.models.Transaction
import com.spentyai.app.core.theme.*
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionLedgerScreen(
    viewModel: TransactionsViewModel
) {
    val state by viewModel.uiState.collectAsState()

    val isFilteredByAccount = state.filterAccountId.isNotEmpty()

    // Sort transactions by date ascending for ledger view
    val sortedTransactions = remember(state.transactions) {
        state.transactions.sortedBy { it.date ?: "" }
    }

    // Opening balance from the filtered account
    val openingBalance = remember(state.filterAccountId, state.accounts) {
        if (!isFilteredByAccount) 0.0
        else state.accounts.firstOrNull { it.id == state.filterAccountId }?.openingBalance ?: 0.0
    }

    // Running balances
    val runningBalances = remember(sortedTransactions, openingBalance, isFilteredByAccount) {
        val balances = mutableMapOf<String, Double>()
        var running = openingBalance
        for (txn in sortedTransactions) {
            val amount = txn.amount ?: 0.0
            when (txn.transactionType?.lowercase()) {
                "income" -> running += amount
                "expense" -> running -= amount
                "transfer" -> {
                    if (isFilteredByAccount) {
                        if (txn.accountId == state.filterAccountId) {
                            running -= amount
                        } else {
                            running += amount
                        }
                    }
                }
            }
            balances[txn.id] = running
        }
        balances
    }

    val horizontalScrollState = rememberScrollState()
    var isRefreshing by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
        // Account filter hint
        if (!isFilteredByAccount) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SpentyInfo.copy(alpha = 0.08f))
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Outlined.Info,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = SpentyInfo
                )
                Text(
                    text = "Select an account to see running balance",
                    style = SpentyType.Caption1,
                    color = SpentyInfo
                )
            }
        }

        // Header row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(horizontalScrollState)
                .background(SpentyPrimary.copy(alpha = 0.08f))
                .padding(horizontal = 16.dp, vertical = 10.dp)
        ) {
            Text(
                text = "Date",
                style = SpentyType.Caption1,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.width(90.dp)
            )
            Text(
                text = "Description",
                style = SpentyType.Caption1,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.width(140.dp)
            )
            Text(
                text = "Debit",
                style = SpentyType.Caption1,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.width(90.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.End
            )
            Text(
                text = "Credit",
                style = SpentyType.Caption1,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.width(90.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.End
            )
            if (isFilteredByAccount) {
                Text(
                    text = "Balance",
                    style = SpentyType.Caption1,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.width(90.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.End
                )
            }
        }

        // Ledger rows
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                isRefreshing = true
                viewModel.refresh()
                isRefreshing = false
            },
            modifier = Modifier.fillMaxSize()
        ) {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                itemsIndexed(
                    items = sortedTransactions,
                    key = { _, txn -> txn.id }
                ) { index, txn ->
                    val isAlternate = index % 2 == 1
                    val amount = txn.amount ?: 0.0
                    val isDebit = txn.transactionType?.lowercase() == "expense" ||
                            (txn.transactionType?.lowercase() == "transfer" && txn.accountId == state.filterAccountId)
                    val isCredit = txn.transactionType?.lowercase() == "income" ||
                            (txn.transactionType?.lowercase() == "transfer" && txn.toAccountId == state.filterAccountId)

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(horizontalScrollState)
                            .background(
                                if (isAlternate) MaterialTheme.colorScheme.background
                                else MaterialTheme.colorScheme.surface
                            )
                            .padding(horizontal = 16.dp, vertical = 10.dp)
                    ) {
                        // Date column
                        Text(
                            text = formatLedgerDate(txn.date),
                            style = SpentyType.Caption1,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.width(90.dp)
                        )

                        // Description column
                        Text(
                            text = txn.description ?: "-",
                            style = SpentyType.Caption1,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.width(140.dp)
                        )

                        // Debit column
                        if (isDebit) {
                            Text(
                                text = formatLedgerAmount(amount),
                                style = SpentyType.Caption1,
                                color = SpentyError,
                                modifier = Modifier.width(90.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.End
                            )
                        } else {
                            Text(
                                text = "-",
                                style = SpentyType.Caption1,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                                modifier = Modifier.width(90.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.End
                            )
                        }

                        // Credit column
                        if (isCredit) {
                            Text(
                                text = formatLedgerAmount(amount),
                                style = SpentyType.Caption1,
                                color = SpentySuccess,
                                modifier = Modifier.width(90.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.End
                            )
                        } else {
                            Text(
                                text = "-",
                                style = SpentyType.Caption1,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                                modifier = Modifier.width(90.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.End
                            )
                        }

                        // Balance column
                        if (isFilteredByAccount) {
                            val balance = runningBalances[txn.id] ?: 0.0
                            Text(
                                text = formatLedgerAmount(balance),
                                style = SpentyType.Caption1,
                                color = if (balance >= 0) SpentyPrimary else SpentyError,
                                modifier = Modifier.width(90.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.End
                            )
                        }
                    }

                    // Infinite scroll trigger
                    LaunchedEffect(txn.id) {
                        if (txn.id == state.transactions.lastOrNull()?.id) {
                            viewModel.loadMore()
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
}

// MARK: - Helpers

private fun formatLedgerDate(dateStr: String?): String {
    if (dateStr.isNullOrEmpty()) return "-"
    // Expecting ISO date string, take first 10 chars (yyyy-MM-dd) and reformat
    val datePart = dateStr.take(10)
    return try {
        val parts = datePart.split("-")
        if (parts.size == 3) {
            val months = arrayOf("", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
            val month = parts[1].toIntOrNull() ?: 0
            "${parts[2]} ${if (month in 1..12) months[month] else parts[1]} ${parts[0]}"
        } else {
            datePart
        }
    } catch (e: Exception) {
        datePart
    }
}

private fun formatLedgerAmount(amount: Double): String {
    val formatter = NumberFormat.getCurrencyInstance(Locale("en", "IN"))
    formatter.maximumFractionDigits = 2
    formatter.minimumFractionDigits = 2
    return formatter.format(kotlin.math.abs(amount))
}
