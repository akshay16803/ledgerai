package com.spentyai.app.features.transactions

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import kotlinx.coroutines.launch
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.ConfirmDialog
import com.spentyai.app.core.components.LoadingView
import com.spentyai.app.core.models.Transaction
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import com.spentyai.app.core.theme.*
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionDetailScreen(
    transaction: Transaction,
    apiClient: ApiClient,
    onDismiss: () -> Unit,
    onEdit: (Transaction) -> Unit,
    onDeleted: () -> Unit
) {
    val repository = remember { TransactionRepository(apiClient) }

    val scope = rememberCoroutineScope()

    var currentTransaction by remember { mutableStateOf(transaction) }
    var isLoading by remember { mutableStateOf(false) }
    var isPerformingAction by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Load full transaction details
    LaunchedEffect(transaction.id) {
        isLoading = true
        when (val result = repository.fetchTransaction(transaction.id)) {
            is ApiResult.Success -> currentTransaction = result.data
            is ApiResult.Failure -> errorMessage = result.error.message
        }
        isLoading = false
    }

    // Delete confirmation
    if (showDeleteConfirm) {
        ConfirmDialog(
            title = "Delete Transaction",
            message = "Are you sure you want to delete this transaction? This action cannot be undone.",
            confirmText = "Delete",
            isDestructive = true,
            onConfirm = {
                showDeleteConfirm = false
                isPerformingAction = true
                scope.launch {
                    when (repository.deleteTransaction(transaction.id)) {
                        is ApiResult.Success -> {
                            isPerformingAction = false
                            onDeleted()
                        }
                        is ApiResult.Failure -> {
                            isPerformingAction = false
                            errorMessage = "Failed to delete transaction"
                        }
                    }
                }
            },
            onDismiss = { showDeleteConfirm = false }
        )
    }

    // Error dialog
    errorMessage?.let { error ->
        AlertDialog(
            onDismissRequest = { errorMessage = null },
            title = { Text("Error", style = SpentyType.Headline) },
            text = { Text(error, style = SpentyType.Body) },
            confirmButton = {
                TextButton(onClick = { errorMessage = null }) {
                    Text("OK", color = SpentyPrimary)
                }
            },
            shape = SpentyStyle.cardShape
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Transaction Details", style = SpentyType.Headline) },
                navigationIcon = {
                    IconButton(onClick = onDismiss) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = "Close",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        if (isLoading && currentTransaction.amount == null) {
            LoadingView(message = "Loading transaction...")
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 20.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Amount Hero
                AmountSection(transaction = currentTransaction)

                // Status badge
                StatusSection(status = currentTransaction.status)

                // Detail card
                DetailCard(transaction = currentTransaction)

                // Source document
                SourceDocumentSection(transaction = currentTransaction)

                // Receipt section
                ReceiptSection(receiptId = currentTransaction.receiptId)

                // Action buttons
                ActionButtons(
                    isPending = currentTransaction.status?.lowercase() == "pending",
                    isPerformingAction = isPerformingAction,
                    onEdit = { onEdit(currentTransaction) },
                    onDelete = { showDeleteConfirm = true }
                )
            }
        }
    }
}

// MARK: - Amount Section

@Composable
private fun AmountSection(transaction: Transaction) {
    val amountColor = when (transaction.transactionType?.lowercase()) {
        "income" -> SpentySuccess
        "expense" -> SpentyError
        "transfer" -> SpentyInfo
        else -> MaterialTheme.colorScheme.onSurface
    }

    val prefix = when (transaction.transactionType?.lowercase()) {
        "income" -> "+"
        "expense" -> "-"
        else -> ""
    }

    val formattedAmount = transaction.amount?.let {
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "IN"))
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        "$prefix${formatter.format(it)}"
    } ?: "--"

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = formattedAmount,
            style = SpentyType.AmountLarge,
            color = amountColor
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = (transaction.transactionType ?: "--").replaceFirstChar { it.uppercase() },
            style = SpentyType.Subheadline,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// MARK: - Status Section

@Composable
private fun StatusSection(status: String?) {
    if (status.isNullOrEmpty() || status.lowercase() == "approved") return

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center
    ) {
        val (bgColor, textColor) = when (status.lowercase()) {
            "pending" -> SpentyWarning.copy(alpha = 0.12f) to SpentyWarning
            "rejected" -> SpentyError.copy(alpha = 0.12f) to SpentyError
            else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
        }

        Surface(
            shape = RoundedCornerShape(8.dp),
            color = bgColor
        ) {
            Text(
                text = status.replaceFirstChar { it.uppercase() },
                style = SpentyType.Footnote,
                fontWeight = FontWeight.SemiBold,
                color = textColor,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
            )
        }
    }
}

// MARK: - Detail Card

@Composable
private fun DetailCard(transaction: Transaction) {
    ElevatedCard(
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation(),
        shape = SpentyStyle.cardShape
    ) {
        Column(modifier = Modifier.padding(SpentyStyle.cardPadding)) {
            DetailRow(label = "Type", value = (transaction.transactionType ?: "--").replaceFirstChar { it.uppercase() })

            DetailDivider()

            DetailRow(label = "Date", value = transaction.date?.take(10) ?: "--")

            if (!transaction.description.isNullOrEmpty()) {
                DetailDivider()
                DetailRow(label = "Description", value = transaction.description!!)
            }

            if (!transaction.categoryName.isNullOrEmpty()) {
                DetailDivider()
                DetailRow(label = "Category", value = transaction.categoryName!!)
            }

            if (!transaction.subcategoryName.isNullOrEmpty()) {
                DetailDivider()
                DetailRow(label = "Subcategory", value = transaction.subcategoryName!!)
            }

            if (!transaction.accountName.isNullOrEmpty()) {
                DetailDivider()
                DetailRow(label = "Account", value = transaction.accountName!!)
            }

            if (transaction.transactionType?.lowercase() == "transfer" && !transaction.toAccountName.isNullOrEmpty()) {
                DetailDivider()
                DetailRow(label = "To Account", value = transaction.toAccountName!!)
            }

            if (!transaction.paymentMethod.isNullOrEmpty()) {
                DetailDivider()
                DetailRow(label = "Payment Method", value = transaction.paymentMethod!!)
            }

            // Recurring info
            DetailDivider()
            val isRecurring = transaction.isRecurring == true
            val recurringText = if (isRecurring) {
                "Yes" + (transaction.recurringFrequency?.let { " (${it.replaceFirstChar { c -> c.uppercase() }})" } ?: "")
            } else {
                "No"
            }
            DetailRow(label = "Recurring", value = recurringText)

            // Foreign currency
            if (transaction.originalCurrency != null && transaction.originalAmount != null) {
                DetailDivider()
                DetailRow(label = "Original Currency", value = transaction.originalCurrency!!.uppercase())

                DetailDivider()
                val formatter = NumberFormat.getNumberInstance()
                formatter.maximumFractionDigits = 2
                DetailRow(
                    label = "Original Amount",
                    value = formatter.format(transaction.originalAmount!!)
                )

                transaction.exchangeRate?.let { rate ->
                    DetailDivider()
                    val rateLabel = if (transaction.isEstimatedRate == true) "Exchange Rate (Est.)" else "Exchange Rate"
                    DetailRow(label = rateLabel, value = String.format("%.4f", rate))
                }
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = label,
            style = SpentyType.Subheadline,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(0.4f)
        )
        Text(
            text = value,
            style = SpentyType.Subheadline,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(0.6f)
        )
    }
}

@Composable
private fun DetailDivider() {
    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
}

// MARK: - Source Document Section

@Composable
private fun SourceDocumentSection(transaction: Transaction) {
    val sourceId = transaction.sourceEmailId ?: transaction.sourceSmsId
    if (sourceId == null) return

    ElevatedCard(
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation(),
        shape = SpentyStyle.cardShape
    ) {
        Column(modifier = Modifier.padding(SpentyStyle.cardPadding)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    Icons.Outlined.Email,
                    contentDescription = null,
                    tint = SpentyPrimary,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = "Source Document",
                    style = SpentyType.Headline,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Source badge
            transaction.source?.let { source ->
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = SpentyInfo.copy(alpha = 0.12f)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            if (source.lowercase() == "email") Icons.Outlined.Email else Icons.Outlined.Sms,
                            contentDescription = null,
                            modifier = Modifier.size(12.dp),
                            tint = SpentyInfo
                        )
                        Text(
                            text = "Via ${source.replaceFirstChar { it.uppercase() }}",
                            style = SpentyType.Caption1,
                            color = SpentyInfo
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Receipt Section

@Composable
private fun ReceiptSection(receiptId: String?) {
    ElevatedCard(
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation(),
        shape = SpentyStyle.cardShape
    ) {
        Column(modifier = Modifier.padding(SpentyStyle.cardPadding)) {
            Text(
                text = "Receipt",
                style = SpentyType.Headline,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(12.dp))

            if (!receiptId.isNullOrEmpty()) {
                Surface(
                    onClick = { /* Receipt viewer placeholder */ },
                    shape = RoundedCornerShape(10.dp),
                    color = SpentyPrimary.copy(alpha = 0.08f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(vertical = 12.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Outlined.Description,
                            contentDescription = null,
                            tint = SpentyPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "View Receipt",
                            style = SpentyType.Subheadline,
                            color = SpentyPrimary
                        )
                    }
                }
            } else {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Outlined.Description,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "No receipt attached",
                        style = SpentyType.Footnote,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

// MARK: - Action Buttons

@Composable
private fun ActionButtons(
    isPending: Boolean,
    isPerformingAction: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.padding(top = 8.dp)
    ) {
        // Edit button
        Button(
            onClick = onEdit,
            modifier = SpentyStyle.primaryButtonModifier,
            colors = SpentyStyle.primaryButtonColors(),
            shape = SpentyStyle.primaryButtonShape,
            enabled = !isPerformingAction
        ) {
            Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Edit Transaction", style = SpentyType.Headline)
        }

        // Delete button
        Button(
            onClick = onDelete,
            modifier = SpentyStyle.destructiveButtonModifier,
            colors = SpentyStyle.destructiveButtonColors(),
            shape = SpentyStyle.destructiveButtonShape,
            enabled = !isPerformingAction
        ) {
            Icon(Icons.Filled.Delete, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Delete Transaction", style = SpentyType.Headline)
        }
    }
}
