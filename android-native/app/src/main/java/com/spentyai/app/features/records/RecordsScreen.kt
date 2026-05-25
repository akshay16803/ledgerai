package com.spentyai.app.features.records

import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.spentyai.app.core.components.*
import com.spentyai.app.core.models.*
import com.spentyai.app.core.theme.*
import com.spentyai.app.features.billing.BillingRepository
import com.spentyai.app.features.billing.BillingViewModel
import com.spentyai.app.features.billing.PremiumFeatureSheet
import android.app.Activity
import androidx.compose.ui.platform.LocalContext
import java.text.NumberFormat
import java.util.*

// ================================
// RecordsScreen (main - tabbed)
// ================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecordsScreen(
    viewModel: RecordsViewModel,
    billingViewModel: BillingViewModel,
    onNavigateToPreview: (String) -> Unit,
    onBack: () -> Unit
) {
    LaunchedEffect(Unit) {
        viewModel.loadRecords()
        viewModel.loadReceipts()
    }

    var showUploadSheet by remember { mutableStateOf(false) }

    // ── Premium gate (Records is the paid Premium tier) ─────────────────
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
            PremiumFeatureSheet.Records(
                priceDisplay = billingViewModel.displayPrice(BillingRepository.PRODUCT_MONTHLY) ?: "₹199",
                isPurchasing = billingState.isPurchasing,
                onSubscribe = onSub@{
                    val act = activity ?: return@onSub
                    val details = billingState.productDetailsList
                        .firstOrNull { it.productId == BillingRepository.PRODUCT_MONTHLY }
                        ?: return@onSub
                    billingViewModel.purchaseSubscription(details, act)
                },
                onClose = closeSheet
            )
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Records", style = SpentyType.Title3) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (viewModel.activeTab == RecordsTab.RECEIPTS) {
                        IconButton(onClick = { showUploadSheet = true }) {
                            Icon(
                                Icons.Filled.AddCircle,
                                contentDescription = "Upload Receipt",
                                tint = SpentyPrimary,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Tab Bar
            TabRow(viewModel)

            when (viewModel.activeTab) {
                RecordsTab.EMAILS -> EmailsContent(viewModel, onNavigateToPreview)
                RecordsTab.RECEIPTS -> ReceiptsContent(viewModel)
            }
        }
    }

    if (showUploadSheet) {
        ReceiptUploadSheet(
            viewModel = viewModel,
            onDismiss = {
                showUploadSheet = false
                viewModel.resetUploadState()
            }
        )
    }
}

// ================================
// Tab Row
// ================================

@Composable
private fun TabRow(viewModel: RecordsViewModel) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        RecordsTab.entries.forEach { tab ->
            val isSelected = viewModel.activeTab == tab
            Surface(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { viewModel.activeTab = tab },
                color = if (isSelected) SpentyPrimary else Color.Transparent,
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    tab.label,
                    style = SpentyType.Subheadline.copy(fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal),
                    color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 8.dp).wrapContentWidth(Alignment.CenterHorizontally)
                )
            }
        }
    }
}

// ================================
// Emails Content
// ================================

@Composable
private fun EmailsContent(viewModel: RecordsViewModel, onNavigateToPreview: (String) -> Unit) {
    Column(modifier = Modifier.fillMaxSize()) {
        // Search
        EmailSearchSection(viewModel)

        // Filters
        EmailFilterSection(viewModel)

        // List
        EmailList(viewModel, onNavigateToPreview)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EmailSearchSection(viewModel: RecordsViewModel) {
    OutlinedTextField(
        value = viewModel.searchQuery,
        onValueChange = { viewModel.searchQuery = it },
        placeholder = { Text("Search emails...", style = SpentyType.Subheadline) },
        leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.size(18.dp)) },
        trailingIcon = {
            if (viewModel.searchQuery.isNotEmpty()) {
                IconButton(onClick = {
                    viewModel.searchQuery = ""
                    viewModel.refreshRecords()
                }) {
                    Icon(Icons.Filled.Close, contentDescription = "Clear", modifier = Modifier.size(16.dp))
                }
            }
        },
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        shape = SpentyStyle.inputShape,
        colors = SpentyStyle.inputColors(),
        singleLine = true,
        keyboardActions = androidx.compose.foundation.text.KeyboardActions(
            onDone = { viewModel.searchRecords() }
        )
    )
}

@Composable
private fun EmailFilterSection(viewModel: RecordsViewModel) {
    var showDateFilter by remember { mutableStateOf(false) }
    var showAmountFilter by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Date Range button
        FilterChip(
            label = if (viewModel.hasDateFilter) "Date Set" else "Date Range",
            icon = Icons.Filled.CalendarToday,
            isActive = viewModel.hasDateFilter,
            onClick = { showDateFilter = true },
            onClear = if (viewModel.hasDateFilter) ({ viewModel.clearDateFilter() }) else null
        )

        // Amount button
        FilterChip(
            label = if (viewModel.hasAmountFilter) "Amount Set" else "Amount",
            icon = Icons.Filled.CurrencyRupee,
            isActive = viewModel.hasAmountFilter,
            onClick = { showAmountFilter = true },
            onClear = if (viewModel.hasAmountFilter) ({ viewModel.clearAmountFilter() }) else null
        )

        Spacer(modifier = Modifier.weight(1f))

        // Download ZIP button
        Surface(
            modifier = Modifier
                .clip(RoundedCornerShape(20.dp))
                .clickable(enabled = !viewModel.isDownloadingZip) { viewModel.downloadZip() },
            color = SpentyPrimary.copy(alpha = 0.1f),
            shape = RoundedCornerShape(20.dp)
        ) {
            Row(
                modifier = Modifier
                    .border(1.dp, SpentyPrimary.copy(alpha = 0.3f), RoundedCornerShape(20.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (viewModel.isDownloadingZip) {
                    CircularProgressIndicator(modifier = Modifier.size(12.dp), strokeWidth = 1.5.dp, color = SpentyPrimary)
                } else {
                    Icon(Icons.Filled.Download, contentDescription = null, modifier = Modifier.size(12.dp), tint = SpentyPrimary)
                }
                Text("ZIP", style = SpentyType.Footnote, color = SpentyPrimary)
            }
        }
    }

    // Date Filter Dialog
    if (showDateFilter) {
        DateFilterDialog(
            viewModel = viewModel,
            onDismiss = { showDateFilter = false }
        )
    }

    // Amount Filter Dialog
    if (showAmountFilter) {
        AmountFilterDialog(
            viewModel = viewModel,
            onDismiss = { showAmountFilter = false }
        )
    }
}

@Composable
private fun FilterChip(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isActive: Boolean,
    onClick: () -> Unit,
    onClear: (() -> Unit)? = null
) {
    Surface(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .clickable(onClick = onClick),
        color = if (isActive) SpentyPrimary.copy(alpha = 0.1f) else MaterialTheme.colorScheme.background,
        shape = RoundedCornerShape(20.dp)
    ) {
        Row(
            modifier = Modifier
                .border(
                    1.dp,
                    if (isActive) SpentyPrimary.copy(alpha = 0.3f) else MaterialTheme.colorScheme.outline,
                    RoundedCornerShape(20.dp)
                )
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.size(12.dp),
                tint = if (isActive) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                label,
                style = SpentyType.Footnote,
                color = if (isActive) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (onClear != null) {
                IconButton(
                    onClick = onClear,
                    modifier = Modifier.size(16.dp)
                ) {
                    Icon(Icons.Filled.Cancel, contentDescription = "Clear", modifier = Modifier.size(12.dp), tint = SpentyPrimary)
                }
            }
        }
    }
}

@Composable
private fun DateFilterDialog(viewModel: RecordsViewModel, onDismiss: () -> Unit) {
    // Simple date range dialog using text fields (Android doesn't have native date pickers in dialogs easily)
    var fromText by remember {
        mutableStateOf(viewModel.dateFrom?.let {
            java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).format(it)
        } ?: "")
    }
    var toText by remember {
        mutableStateOf(viewModel.dateTo?.let {
            java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).format(it)
        } ?: "")
    }
    val fmt = java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Date Range", style = SpentyType.Headline) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("From (yyyy-MM-dd)", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedTextField(
                        value = fromText,
                        onValueChange = { fromText = it },
                        placeholder = { Text("2024-01-01") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors(),
                        singleLine = true
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("To (yyyy-MM-dd)", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedTextField(
                        value = toText,
                        onValueChange = { toText = it },
                        placeholder = { Text("2024-12-31") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors(),
                        singleLine = true
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                viewModel.dateFrom = try { fmt.parse(fromText) } catch (_: Exception) { null }
                viewModel.dateTo = try { fmt.parse(toText) } catch (_: Exception) { null }
                viewModel.applyFilters()
                onDismiss()
            }) {
                Text("Apply", color = SpentyPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    )
}

@Composable
private fun AmountFilterDialog(viewModel: RecordsViewModel, onDismiss: () -> Unit) {
    var minText by remember { mutableStateOf(viewModel.amountMin) }
    var maxText by remember { mutableStateOf(viewModel.amountMax) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Amount Range", style = SpentyType.Headline) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Min Amount", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedTextField(
                        value = minText,
                        onValueChange = { minText = it },
                        placeholder = { Text("0") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors(),
                        singleLine = true
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Max Amount", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedTextField(
                        value = maxText,
                        onValueChange = { maxText = it },
                        placeholder = { Text("No limit") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors(),
                        singleLine = true
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                viewModel.amountMin = minText
                viewModel.amountMax = maxText
                viewModel.applyFilters()
                onDismiss()
            }) {
                Text("Apply", color = SpentyPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    )
}

// ================================
// Email List
// ================================

@Composable
private fun EmailList(viewModel: RecordsViewModel, onNavigateToPreview: (String) -> Unit) {
    when {
        viewModel.isLoading && viewModel.records.isEmpty() -> {
            LoadingView(message = "Loading records...")
        }
        viewModel.records.isEmpty() -> {
            EmptyStateView(
                icon = Icons.Filled.MailOutline,
                title = "No Email Records",
                subtitle = "Synced emails with financial data will appear here."
            )
        }
        else -> {
            var deleteTargetId by remember { mutableStateOf<String?>(null) }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp)
            ) {
                // Error banner
                if (viewModel.errorMessage != null) {
                    item {
                        ErrorBanner(
                            message = viewModel.errorMessage ?: "",
                            isVisible = true,
                            onDismiss = { viewModel.dismissError() }
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }

                itemsIndexed(viewModel.records, key = { _, r -> r.id }) { index, record ->
                    EmailRow(
                        record = record,
                        onClick = { onNavigateToPreview(record.id) },
                        onDelete = { deleteTargetId = record.id }
                    )

                    if (index < viewModel.records.size - 1) {
                        HorizontalDivider(
                            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
                            modifier = Modifier.padding(start = 48.dp)
                        )
                    }

                    // Infinite scroll
                    if (record.id == viewModel.records.lastOrNull()?.id) {
                        LaunchedEffect(Unit) { viewModel.loadMoreRecords() }
                    }
                }

                if (viewModel.isLoadingMore) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = SpentyPrimary, modifier = Modifier.size(24.dp))
                        }
                    }
                }
            }

            // Delete confirmation
            if (deleteTargetId != null) {
                AlertDialog(
                    onDismissRequest = { deleteTargetId = null },
                    title = { Text("Delete Record", style = SpentyType.Headline) },
                    text = { Text("This action cannot be undone.", style = SpentyType.Body) },
                    confirmButton = {
                        TextButton(onClick = {
                            deleteTargetId?.let { viewModel.deleteRecord(it) }
                            deleteTargetId = null
                        }) {
                            Text("Delete", color = SpentyError)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { deleteTargetId = null }) {
                            Text("Cancel", color = SpentyPrimary)
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun EmailRow(record: Record, onClick: () -> Unit, onDelete: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Source icon
        Icon(
            Icons.Filled.Email,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = when (record.source?.lowercase()) {
                "gmail" -> SpentyError
                "outlook" -> SpentyInfo
                else -> MaterialTheme.colorScheme.onSurfaceVariant
            }
        )

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                record.subject ?: "No Subject",
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                record.sender ?: "Unknown Sender",
                style = SpentyType.Caption1,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            record.archivedAt?.let { dateStr ->
                Text(
                    dateStr,
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
            }
        }

        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            record.amount?.let { amount ->
                Text(
                    formatINR(amount),
                    style = SpentyType.AmountSmall,
                    color = amountColor(record.transactionType)
                )
            }
            val count = record.attachmentCount ?: 0
            if (count > 0) {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.background)
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.AttachFile, contentDescription = null, modifier = Modifier.size(10.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("$count", style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

// ================================
// Receipts Content
// ================================

@Composable
private fun ReceiptsContent(viewModel: RecordsViewModel) {
    when {
        viewModel.isLoadingReceipts && viewModel.receipts.isEmpty() -> {
            LoadingView(message = "Loading receipts...")
        }
        viewModel.receipts.isEmpty() -> {
            EmptyStateView(
                icon = Icons.Filled.DocumentScanner,
                title = "No Receipts",
                subtitle = "Upload receipts from camera or photo library to parse and link them."
            )
        }
        else -> {
            var deleteReceiptId by remember { mutableStateOf<String?>(null) }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp)
            ) {
                itemsIndexed(viewModel.receipts, key = { _, r -> r.id }) { index, receipt ->
                    ReceiptRow(
                        receipt = receipt,
                        onDownload = { viewModel.downloadReceipt(receipt.id) },
                        onDelete = { deleteReceiptId = receipt.id }
                    )

                    if (index < viewModel.receipts.size - 1) {
                        HorizontalDivider(
                            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
                            modifier = Modifier.padding(start = 48.dp)
                        )
                    }

                    // Infinite scroll
                    if (receipt.id == viewModel.receipts.lastOrNull()?.id) {
                        LaunchedEffect(Unit) { viewModel.loadMoreReceipts() }
                    }
                }

                if (viewModel.isLoadingMoreReceipts) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = SpentyPrimary, modifier = Modifier.size(24.dp))
                        }
                    }
                }
            }

            // Delete confirmation
            if (deleteReceiptId != null) {
                AlertDialog(
                    onDismissRequest = { deleteReceiptId = null },
                    title = { Text("Delete Receipt", style = SpentyType.Headline) },
                    text = { Text("This receipt will be permanently removed.", style = SpentyType.Body) },
                    confirmButton = {
                        TextButton(onClick = {
                            deleteReceiptId?.let { viewModel.deleteReceipt(it) }
                            deleteReceiptId = null
                        }) {
                            Text("Delete", color = SpentyError)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { deleteReceiptId = null }) {
                            Text("Cancel", color = SpentyPrimary)
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun ReceiptRow(receipt: Receipt, onDownload: () -> Unit, onDelete: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // File type icon
        Icon(
            when {
                receipt.mimeType?.lowercase()?.contains("pdf") == true -> Icons.Filled.PictureAsPdf
                receipt.mimeType?.lowercase()?.contains("image") == true -> Icons.Filled.Image
                else -> Icons.Filled.Description
            },
            contentDescription = null,
            modifier = Modifier.size(28.dp),
            tint = SpentyPrimary
        )

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                receipt.filename ?: "Unnamed Receipt",
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                receipt.parsedData?.merchant?.let { merchant ->
                    Text(merchant, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (receipt.parsedData?.merchant != null && receipt.uploadedAt != null) {
                    Text(".", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                receipt.uploadedAt?.let { date ->
                    Text(date, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            if (receipt.transactionId != null) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.Link, contentDescription = null, modifier = Modifier.size(10.dp), tint = SpentySuccess)
                    Text("Linked", style = SpentyType.Caption2, color = SpentySuccess)
                }
            }
        }

        val amount = receipt.parsedData?.total ?: receipt.parsedData?.amount
        if (amount != null) {
            Text(
                formatINR(amount),
                style = SpentyType.AmountSmall,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

// ================================
// RecordPreviewScreen
// ================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecordPreviewScreen(
    recordId: String,
    viewModel: RecordsViewModel,
    onBack: () -> Unit
) {
    LaunchedEffect(recordId) { viewModel.loadRecordPreview(recordId) }

    var showDeleteConfirm by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Email", style = SpentyType.Title3) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    var menuExpanded by remember { mutableStateOf(false) }
                    IconButton(onClick = { menuExpanded = true }) {
                        Icon(Icons.Filled.MoreVert, contentDescription = "Options", tint = SpentyPrimary)
                    }
                    DropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Download EML") },
                            leadingIcon = { Icon(Icons.Filled.Download, contentDescription = null) },
                            onClick = {
                                viewModel.downloadEml(recordId)
                                menuExpanded = false
                            }
                        )
                        HorizontalDivider()
                        DropdownMenuItem(
                            text = { Text("Delete", color = SpentyError) },
                            leadingIcon = { Icon(Icons.Filled.Delete, contentDescription = null, tint = SpentyError) },
                            onClick = {
                                menuExpanded = false
                                showDeleteConfirm = true
                            }
                        )
                    }
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            when {
                viewModel.isLoadingPreview -> {
                    LoadingView(message = "Loading email...")
                }
                viewModel.previewError != null -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            Icons.Filled.Warning,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp),
                            tint = SpentyError
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            viewModel.previewError ?: "Failed to load",
                            style = SpentyType.Subheadline,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        OutlinedButton(
                            onClick = { viewModel.loadRecordPreview(recordId) },
                            shape = SpentyStyle.secondaryButtonShape
                        ) {
                            Text("Retry", color = SpentyPrimary)
                        }
                    }
                }
                viewModel.activePreview != null -> {
                    val preview = viewModel.activePreview!!
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                    ) {
                        PreviewHeader(preview)
                        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        PreviewBody(preview)
                        val attachments = preview.attachments
                        if (!attachments.isNullOrEmpty()) {
                            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                            PreviewAttachments(recordId, attachments, viewModel)
                        }
                    }
                }
            }
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Record", style = SpentyType.Headline) },
            text = { Text("This email record will be permanently deleted.", style = SpentyType.Body) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteRecord(recordId)
                    showDeleteConfirm = false
                    onBack()
                }) {
                    Text("Delete", color = SpentyError)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel", color = SpentyPrimary)
                }
            }
        )
    }
}

@Composable
private fun PreviewHeader(preview: RecordPreviewResponse) {
    Column(
        modifier = Modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            preview.subject ?: "No Subject",
            style = SpentyType.Title3,
            color = MaterialTheme.colorScheme.onSurface
        )

        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Filled.AccountCircle,
                contentDescription = null,
                modifier = Modifier.size(32.dp),
                tint = SpentyPrimary
            )

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    preview.sender ?: "Unknown Sender",
                    style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                    color = MaterialTheme.colorScheme.onSurface
                )
                preview.archivedAt?.let { date ->
                    Text(
                        date,
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            preview.source?.let { source ->
                StatusBadge(
                    text = source,
                    variant = when (source.lowercase()) {
                        "gmail" -> BadgeVariant.ERROR
                        "outlook" -> BadgeVariant.INFO
                        else -> BadgeVariant.NEUTRAL
                    }
                )
            }
        }

        // Linked transaction info
        preview.transactionId?.let { txnId ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(SpentySuccess.copy(alpha = 0.08f))
                    .padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Filled.Link, contentDescription = null, modifier = Modifier.size(16.dp), tint = SpentySuccess)
                Text("Linked to transaction", style = SpentyType.Caption1, color = SpentySuccess)
                Text(
                    txnId.take(8) + "...",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun PreviewBody(preview: RecordPreviewResponse) {
    Column(
        modifier = Modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        val htmlBody = preview.bodyHtml
        val textBody = preview.body

        when {
            !htmlBody.isNullOrEmpty() -> {
                HtmlContent(html = htmlBody, modifier = Modifier.fillMaxWidth().heightIn(min = 300.dp))
            }
            !textBody.isNullOrEmpty() -> {
                Text(
                    textBody,
                    style = SpentyType.Body,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            else -> {
                Text(
                    "No content available",
                    style = SpentyType.Subheadline.copy(fontStyle = FontStyle.Italic),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun HtmlContent(html: String, modifier: Modifier = Modifier) {
    val styledHtml = """
        <!DOCTYPE html>
        <html>
        <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
            body {
                font-family: sans-serif;
                font-size: 15px;
                color: #2D2D2D;
                background-color: transparent;
                margin: 0;
                padding: 0;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }
            img { max-width: 100%; height: auto; }
            a { color: #3A5C4A; }
            pre, code { overflow-x: auto; max-width: 100%; }
            table { max-width: 100%; overflow-x: auto; display: block; }
        </style>
        </head>
        <body>$html</body>
        </html>
    """.trimIndent()

    AndroidView(
        factory = { context ->
            WebView(context).apply {
                webViewClient = WebViewClient()
                settings.apply {
                    javaScriptEnabled = false
                    loadWithOverviewMode = true
                    useWideViewPort = true
                }
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
                loadDataWithBaseURL(null, styledHtml, "text/html", "utf-8", null)
            }
        },
        modifier = modifier
    )
}

@Composable
private fun PreviewAttachments(
    recordId: String,
    attachments: List<RecordAttachment>,
    viewModel: RecordsViewModel
) {
    Column(
        modifier = Modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Filled.AttachFile, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                "Attachments (${attachments.size})",
                style = SpentyType.Headline,
                color = MaterialTheme.colorScheme.onSurface
            )
        }

        attachments.forEach { attachment ->
            AttachmentRow(
                attachment = attachment,
                onClick = { viewModel.downloadAttachment(recordId, attachment.index) }
            )
        }
    }
}

@Composable
private fun AttachmentRow(attachment: RecordAttachment, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.background,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                when {
                    attachment.mimeType?.lowercase()?.contains("pdf") == true -> Icons.Filled.PictureAsPdf
                    attachment.mimeType?.lowercase()?.contains("image") == true -> Icons.Filled.Image
                    attachment.mimeType?.lowercase()?.let { it.contains("spreadsheet") || it.contains("excel") || it.contains("csv") } == true -> Icons.Filled.TableChart
                    else -> Icons.Filled.Description
                },
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = SpentyPrimary
            )

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    attachment.filename ?: "Attachment ${attachment.index + 1}",
                    style = SpentyType.Subheadline,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                attachment.size?.let { size ->
                    Text(
                        formatFileSize(size),
                        style = SpentyType.Caption2,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Icon(Icons.Filled.Download, contentDescription = "Download", modifier = Modifier.size(18.dp), tint = SpentyPrimary)
        }
    }
}

// ================================
// Receipt Upload Sheet
// ================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReceiptUploadSheet(
    viewModel: RecordsViewModel,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancel", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text("Upload Receipt", style = SpentyType.Headline)
                Spacer(modifier = Modifier.width(60.dp))
            }

            // Upload area placeholder
            if (viewModel.uploadedReceiptId == null) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .border(
                            2.dp,
                            MaterialTheme.colorScheme.outline,
                            RoundedCornerShape(16.dp)
                        ),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        Icons.Filled.DocumentScanner,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = SpentyPrimary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        "Select Receipt Image",
                        style = SpentyType.Headline,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Photo picker integration required for production",
                        style = SpentyType.Subheadline,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Parsed Data
            viewModel.parsedReceipt?.parsedData?.let { data ->
                ElevatedCard(
                    shape = SpentyStyle.cardShape,
                    colors = SpentyStyle.cardColors(),
                    elevation = SpentyStyle.cardElevation()
                ) {
                    Column(
                        modifier = Modifier.padding(SpentyStyle.cardPadding),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Filled.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp), tint = SpentyPrimary)
                            Text("AI Parsed Data", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurface)
                        }

                        data.merchant?.let { ParsedDataRow("Merchant", it) }
                        data.amount?.let { ParsedDataRow("Amount", formatINR(it)) }
                        data.total?.let { ParsedDataRow("Total", formatINR(it)) }
                        data.tax?.let { ParsedDataRow("Tax", formatINR(it)) }
                        data.date?.let { ParsedDataRow("Date", it) }

                        val items = data.items
                        if (!items.isNullOrEmpty()) {
                            HorizontalDivider()
                            Text(
                                "Items",
                                style = SpentyType.Footnote.copy(fontWeight = FontWeight.Medium),
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            items.forEach { item ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Text(
                                            item.description ?: "Item",
                                            style = SpentyType.Subheadline,
                                            color = MaterialTheme.colorScheme.onSurface
                                        )
                                        item.quantity?.let { qty ->
                                            if (qty > 1) {
                                                Text(
                                                    "x${qty.toInt()}",
                                                    style = SpentyType.Caption1,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            }
                                        }
                                    }
                                    item.amount?.let { amt ->
                                        Text(
                                            formatINR(amt),
                                            style = SpentyType.Subheadline,
                                            color = MaterialTheme.colorScheme.onSurface
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Link Transaction Section
            if (viewModel.uploadedReceiptId != null && viewModel.parsedReceipt != null) {
                ElevatedCard(
                    shape = SpentyStyle.cardShape,
                    colors = SpentyStyle.cardColors(),
                    elevation = SpentyStyle.cardElevation()
                ) {
                    Column(
                        modifier = Modifier.padding(SpentyStyle.cardPadding),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Filled.Link, contentDescription = null, modifier = Modifier.size(16.dp), tint = SpentyPrimary)
                            Text("Link to Transaction", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurface)
                        }

                        OutlinedTextField(
                            value = viewModel.linkedTransactionId,
                            onValueChange = { viewModel.linkedTransactionId = it },
                            placeholder = { Text("Transaction ID") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = SpentyStyle.inputShape,
                            colors = SpentyStyle.inputColors(),
                            singleLine = true
                        )

                        if (viewModel.linkedTransactionId.isNotEmpty()) {
                            OutlinedButton(
                                onClick = {
                                    viewModel.uploadedReceiptId?.let { receiptId ->
                                        viewModel.linkReceiptToTransaction(receiptId, viewModel.linkedTransactionId)
                                        onDismiss()
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = SpentyStyle.secondaryButtonShape,
                                border = SpentyStyle.secondaryButtonBorder()
                            ) {
                                Text("Link Transaction", color = SpentyPrimary)
                            }
                        }
                    }
                }
            }

            // Action Buttons
            if (viewModel.uploadedReceiptId != null) {
                Button(
                    onClick = onDismiss,
                    modifier = SpentyStyle.primaryButtonModifier,
                    shape = SpentyStyle.primaryButtonShape,
                    colors = SpentyStyle.primaryButtonColors()
                ) {
                    Text("Done")
                }
            }

            // Error
            viewModel.errorMessage?.let { error ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(SpentyError.copy(alpha = 0.1f))
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.Warning, contentDescription = null, modifier = Modifier.size(16.dp), tint = SpentyError)
                    Text(error, style = SpentyType.Footnote, color = SpentyError, modifier = Modifier.weight(1f))
                    IconButton(
                        onClick = { viewModel.dismissError() },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(Icons.Filled.Cancel, contentDescription = "Dismiss", modifier = Modifier.size(14.dp), tint = SpentyError.copy(alpha = 0.6f))
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun ParsedDataRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium), color = MaterialTheme.colorScheme.onSurface)
    }
}

// ================================
// Helpers
// ================================

@Composable
private fun amountColor(transactionType: String?): Color {
    return when (transactionType?.lowercase()) {
        "income", "credit" -> SpentySuccess
        "expense", "debit" -> SpentyError
        else -> MaterialTheme.colorScheme.onSurface
    }
}

private fun formatINR(amount: Double): String {
    val fmt = NumberFormat.getNumberInstance(Locale("en", "IN"))
    fmt.minimumFractionDigits = 2
    fmt.maximumFractionDigits = 2
    return fmt.format(kotlin.math.abs(amount))
}

private fun formatFileSize(bytes: Int): String {
    return when {
        bytes >= 1_048_576 -> String.format("%.1f MB", bytes / 1_048_576.0)
        bytes >= 1024 -> String.format("%.1f KB", bytes / 1024.0)
        else -> "$bytes B"
    }
}
