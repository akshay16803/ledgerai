package com.spentyai.app.features.pastinsights

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowCircleDown
import androidx.compose.material.icons.filled.ArrowCircleUp
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.EqualRounded
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.ListAlt
import androidx.compose.material.icons.filled.TableChart
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyInfo
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentySuccess
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PastInsightDetailScreen(
    viewModel: PastInsightsViewModel,
    summaryId: String,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val summary = state.selectedSummary ?: PastInsightSummary(id = summaryId)

    LaunchedEffect(summaryId) {
        viewModel.loadDetail(summaryId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(summary.name ?: "Past Insight Summary", style = SpentyType.Headline) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item { Spacer(modifier = Modifier.height(4.dp)) }

            // Header
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    summary.status?.let { status ->
                        val color = when (status.lowercase()) {
                            "completed" -> SpentySuccess
                            "processing" -> SpentyWarning
                            "failed" -> SpentyError
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        }
                        Text(
                            text = status.replaceFirstChar { it.uppercase() },
                            style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold),
                            color = color,
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(color.copy(alpha = 0.12f))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    if (summary.dateFrom != null && summary.dateTo != null) {
                        Text(
                            text = "${formatDate(summary.dateFrom)} - ${formatDate(summary.dateTo)}",
                            style = SpentyType.Subheadline,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    summary.emailAddress?.let { email ->
                        if (email.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.Email,
                                    contentDescription = null,
                                    modifier = Modifier.size(14.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = email,
                                    style = SpentyType.Caption1,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }

            // Stats Cards
            item {
                Column {
                    Text("Summary", style = SpentyType.Headline, modifier = Modifier.padding(horizontal = 4.dp))
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        DetailStatCard(
                            title = "Total Income",
                            value = formatCurrency(summary.totalIncome ?: 0.0),
                            icon = Icons.Default.ArrowCircleDown,
                            color = SpentySuccess,
                            modifier = Modifier.weight(1f)
                        )
                        DetailStatCard(
                            title = "Total Expense",
                            value = formatCurrency(summary.totalExpense ?: 0.0),
                            icon = Icons.Default.ArrowCircleUp,
                            color = SpentyError,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        DetailStatCard(
                            title = "Net",
                            value = formatCurrency(summary.net ?: 0.0),
                            icon = Icons.Default.EqualRounded,
                            color = SpentyPrimary,
                            modifier = Modifier.weight(1f)
                        )
                        DetailStatCard(
                            title = "Transactions",
                            value = "${summary.transactionCount ?: state.detailTransactions.size}",
                            icon = Icons.Default.ListAlt,
                            color = SpentyInfo,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // Action buttons
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = { /* export CSV */ },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = SpentyPrimary)
                    ) {
                        Icon(Icons.Default.TableChart, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Export CSV", style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium))
                    }
                    Button(
                        onClick = { /* download CSV */ },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp),
                        colors = SpentyStyle.primaryButtonColors()
                    ) {
                        Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(18.dp), tint = Color.White)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Download CSV", style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium), color = Color.White)
                    }
                }
            }

            // Transactions section
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Transactions", style = SpentyType.Headline)
                    Text(
                        "${state.detailTransactions.size}",
                        style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (state.isLoadingTransactions) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = SpentyPrimary)
                    }
                }
            } else if (state.detailTransactions.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surface)
                            .padding(vertical = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.Inbox,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = SpentyPrimary.copy(alpha = 0.4f)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "No transactions found",
                            style = SpentyType.Subheadline,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surface)
                    ) {
                        state.detailTransactions.forEachIndexed { index, txn ->
                            TransactionRow(txn)
                            if (index < state.detailTransactions.lastIndex) {
                                HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                            }
                        }
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun DetailStatCard(
    title: String,
    value: String,
    icon: ImageVector,
    color: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .shadow(2.dp, RoundedCornerShape(12.dp))
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = color, modifier = Modifier.size(28.dp))
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = value,
            style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold),
            textAlign = TextAlign.Center
        )
        Text(
            text = title,
            style = SpentyType.Caption2,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun TransactionRow(txn: PastInsightTransaction) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = txn.description ?: "Transaction",
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                maxLines = 2
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                txn.date?.let { date ->
                    Text(
                        text = formatDate(date),
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                txn.categoryName?.takeIf { it.isNotEmpty() }?.let { cat ->
                    Text(
                        text = cat,
                        style = SpentyType.Caption2.copy(fontWeight = FontWeight.Medium),
                        color = SpentyPrimary,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(SpentyPrimary.copy(alpha = 0.1f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            val color = when (txn.transactionType?.lowercase()) {
                "income" -> SpentySuccess
                "expense" -> SpentyError
                else -> MaterialTheme.colorScheme.onSurface
            }
            Text(
                text = formatCurrency(txn.amount ?: 0.0),
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold),
                color = color
            )
            txn.transactionType?.let { type ->
                Text(
                    text = type.replaceFirstChar { it.uppercase() },
                    style = SpentyType.Caption2,
                    color = color
                )
            }
        }
    }
}

private fun formatCurrency(value: Double): String {
    val formatter = NumberFormat.getCurrencyInstance(Locale.US)
    formatter.maximumFractionDigits = 0
    return formatter.format(value)
}

private fun formatDate(dateString: String): String {
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val display = SimpleDateFormat("MMM dd, yyyy", Locale.US)
        parser.parse(dateString)?.let { display.format(it) } ?: dateString
    } catch (e: Exception) {
        dateString
    }
}
