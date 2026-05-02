package com.spentyai.app.features.reconciliation

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spentyai.app.core.components.*
import com.spentyai.app.core.models.*
import com.spentyai.app.core.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReconciliationScreen(
    viewModel: ReconciliationViewModel,
    onStatementClick: (String) -> Unit
) {
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var deleteTargetId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { viewModel.loadInitial() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Reconciliation", style = SpentyType.LargeTitle) },
                actions = {
                    IconButton(onClick = { viewModel.showUploadSheet = true }) {
                        Icon(Icons.Filled.AddCircle, contentDescription = "Upload", tint = SpentyPrimary, modifier = Modifier.size(28.dp))
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
                viewModel.isLoading && viewModel.statements.isEmpty() -> {
                    LoadingView()
                }
                viewModel.statements.isEmpty() -> {
                    EmptyStateView(
                        icon = Icons.Filled.FindInPage,
                        title = "No Statements",
                        subtitle = "Upload a bank statement to start reconciling."
                    ) {
                        Button(
                            onClick = { viewModel.showUploadSheet = true },
                            colors = SpentyStyle.primaryButtonColors(),
                            shape = SpentyStyle.primaryButtonShape
                        ) {
                            Text("Upload Statement")
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        // Defensive key: fall back to a per-row composite if statement.id
                        // is empty (e.g., due to a deserialization mismatch). Without this,
                        // duplicate empty keys crash the LazyColumn:
                        //   "Key '' was already used. LazyColumn please provide unique keys."
                        itemsIndexed(
                            items = viewModel.statements,
                            key = { idx, s ->
                                s.id.ifEmpty { "stmt-row-$idx-${s.filename ?: ""}-${s.uploadedAt ?: ""}" }
                            }
                        ) { _, statement ->
                            StatementRow(
                                statement = statement,
                                viewModel = viewModel,
                                onClick = {
                                    // Guard against empty id — navigation route requires a
                                    // non-empty path segment, otherwise crashes with:
                                    //   "Navigation destination 'statement_detail/' cannot be found"
                                    if (statement.id.isNotEmpty()) {
                                        onStatementClick(statement.id)
                                    }
                                },
                                onDelete = {
                                    if (statement.id.isNotEmpty()) {
                                        deleteTargetId = statement.id
                                        showDeleteConfirm = true
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    // Upload sheet
    if (viewModel.showUploadSheet) {
        StatementUploadSheet(
            viewModel = viewModel,
            onDismiss = { viewModel.showUploadSheet = false }
        )
    }

    // Delete confirmation
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete Statement") },
            text = { Text("This action cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    deleteTargetId?.let { viewModel.deleteStatement(it) }
                    showDeleteConfirm = false
                }) {
                    Text("Delete", color = SpentyError)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun StatementRow(
    statement: Statement,
    viewModel: ReconciliationViewModel,
    onClick: () -> Unit,
    onDelete: () -> Unit
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
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Filled.Description,
                contentDescription = null,
                modifier = Modifier.size(28.dp),
                tint = SpentyPrimary
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = statement.filename ?: "Unnamed Statement",
                    style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        statement.accountName ?: viewModel.accountName(statement.accountId),
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (statement.periodFrom != null && statement.periodTo != null) {
                        Text(
                            "${statement.periodFrom} - ${statement.periodTo}",
                            style = SpentyType.Caption1.copy(fontSize = 11.sp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    }
                }
                statement.entryCount?.let { count ->
                    Text(
                        "$count entries",
                        style = SpentyType.Caption1.copy(fontSize = 11.sp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                statement.status?.let { status ->
                    StatusBadge(text = status.replaceFirstChar { it.titlecase() }, variant = statusVariant(status))
                }
                val progress = statement.processingProgress
                if (progress != null && progress > 0 && progress < 1) {
                    LinearProgressIndicator(
                        progress = { progress.toFloat() },
                        modifier = Modifier.width(80.dp),
                        color = SpentyPrimary,
                        trackColor = SpentyPrimary.copy(alpha = 0.12f)
                    )
                    statement.processingStageLabel?.let { label ->
                        Text(label, style = SpentyType.Caption1.copy(fontSize = 10.sp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            Spacer(modifier = Modifier.width(4.dp))

            Icon(Icons.Filled.ChevronRight, contentDescription = null, modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// Statement Detail Screen
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatementDetailScreen(
    viewModel: ReconciliationViewModel,
    statementId: String,
    onBack: () -> Unit
) {
    var showBulkCategoryPicker by remember { mutableStateOf(false) }
    var showApproveConfirm by remember { mutableStateOf(false) }
    var showRejectConfirm by remember { mutableStateOf(false) }
    var selectedMissingIndices by remember { mutableStateOf(setOf<Int>()) }

    val statementStatus = viewModel.activeStatement?.status?.lowercase() ?: ""
    val isTerminal = statementStatus == "approved" || statementStatus == "rejected"
    val canReconcile = statementStatus == "parsed" || statementStatus == "reconciled"
    val canApproveReject = statementStatus == "reconciled"
    val canAddMissing = statementStatus == "reconciled" && (viewModel.reconciliationResult?.missingFromLedgerCount ?: 0) > 0

    val currentStep = when (statementStatus) {
        "uploaded" -> 0; "parsing" -> 1; "parsed" -> 2; "reconciled" -> 3
        "approved", "rejected" -> 4; else -> 0
    }

    LaunchedEffect(statementId) { viewModel.loadStatement(statementId) }
    DisposableEffect(Unit) { onDispose { viewModel.stopParsePolling() } }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Statement Details", style = SpentyType.Headline) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
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
            if (viewModel.isLoading && viewModel.activeStatement == null) {
                LoadingView()
            } else {
                viewModel.activeStatement?.let { statement ->
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Error/success banners
                        viewModel.errorMessage?.let { msg ->
                            ErrorBanner(message = msg, isVisible = true, onDismiss = { viewModel.dismissError() })
                        }
                        viewModel.successMessage?.let { msg ->
                            SuccessBanner(message = msg, onDismiss = { viewModel.dismissSuccess() })
                        }

                        // Workflow stepper
                        WorkflowStepper(currentStep = currentStep)

                        // Terminal banner
                        if (statementStatus == "approved") {
                            TerminalBanner(text = "Statement Approved", color = SpentySuccess, icon = Icons.Filled.CheckCircle)
                        } else if (statementStatus == "rejected") {
                            TerminalBanner(text = "Statement Rejected", color = SpentyError, icon = Icons.Filled.Cancel)
                        }

                        // Header card
                        StatementHeaderCard(statement, viewModel)

                        // Action buttons
                        if (!isTerminal) {
                            ActionButtons(
                                canReconcile = canReconcile,
                                canAddMissing = canAddMissing,
                                canApproveReject = canApproveReject,
                                isPasswordRequired = statementStatus == "password_required",
                                isReconciling = viewModel.isReconciling,
                                selectedMissingCount = selectedMissingIndices.size,
                                onReconcile = { viewModel.reconcile(statementId) },
                                onBulkCategorize = { showBulkCategoryPicker = true },
                                onAddMissing = {
                                    val indices = if (selectedMissingIndices.isEmpty()) null else selectedMissingIndices.toList().sorted()
                                    viewModel.addMissingToLedger(statementId, indices)
                                },
                                onReaudit = { viewModel.reaudit(statementId) },
                                onUnlock = { viewModel.showUnlockSheet = true },
                                onApprove = { showApproveConfirm = true },
                                onReject = { showRejectConfirm = true }
                            )
                        }

                        // Reconciliation results
                        viewModel.reconciliationResult?.let { result ->
                            ReconciliationResultsCard(result)
                        }

                        // Parsed entries
                        ParsedEntriesSection(
                            entries = viewModel.parsedEntries,
                            categories = viewModel.categories,
                            onCategoryUpdate = { index, catId, catName ->
                                viewModel.updateEntryCategory(statementId, index, catId, catName)
                            },
                            viewModel = viewModel
                        )

                        Spacer(modifier = Modifier.height(80.dp))
                    }
                }
            }
        }
    }

    // Dialogs
    if (showApproveConfirm) {
        AlertDialog(
            onDismissRequest = { showApproveConfirm = false },
            title = { Text("Approve Statement") },
            text = { Text("Mark this statement as approved?") },
            confirmButton = {
                TextButton(onClick = { viewModel.approveStatement(statementId); showApproveConfirm = false }) {
                    Text("Approve", color = SpentySuccess)
                }
            },
            dismissButton = { TextButton(onClick = { showApproveConfirm = false }) { Text("Cancel") } }
        )
    }

    if (showRejectConfirm) {
        AlertDialog(
            onDismissRequest = { showRejectConfirm = false },
            title = { Text("Reject Statement") },
            text = { Text("Mark this statement as rejected?") },
            confirmButton = {
                TextButton(onClick = { viewModel.rejectStatement(statementId); showRejectConfirm = false }) {
                    Text("Reject", color = SpentyError)
                }
            },
            dismissButton = { TextButton(onClick = { showRejectConfirm = false }) { Text("Cancel") } }
        )
    }

    // Unlock sheet
    if (viewModel.showUnlockSheet) {
        UnlockSheet(viewModel = viewModel, statementId = statementId)
    }

    // Bulk categorize sheet
    if (showBulkCategoryPicker) {
        BulkCategorizeSheet(
            categories = viewModel.categories,
            onSelect = { catId -> viewModel.bulkCategorize(statementId, catId); showBulkCategoryPicker = false },
            onDismiss = { showBulkCategoryPicker = false }
        )
    }
}

@Composable
private fun WorkflowStepper(currentStep: Int) {
    val steps = listOf("Upload", "Parse", "Review", "Reconcile", "Done")

    ElevatedCard(
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp, horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            steps.forEachIndexed { index, label ->
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    val stepColor = when {
                        index < currentStep -> SpentySuccess
                        index == currentStep -> SpentyPrimary
                        else -> MaterialTheme.colorScheme.outline
                    }
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(stepColor),
                        contentAlignment = Alignment.Center
                    ) {
                        when {
                            index < currentStep -> Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color.White)
                            index == currentStep -> Box(modifier = Modifier.size(10.dp).clip(RoundedCornerShape(5.dp)).background(Color.White))
                            else -> Text("${index + 1}", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold, fontSize = 11.sp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        label,
                        style = SpentyType.Caption1.copy(fontSize = 10.sp),
                        color = if (index <= currentStep) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun TerminalBanner(text: String, color: Color, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.1f))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = color)
        Spacer(modifier = Modifier.width(8.dp))
        Text(text, style = SpentyType.Headline, color = color)
    }
}

@Composable
private fun StatementHeaderCard(statement: Statement, viewModel: ReconciliationViewModel) {
    ElevatedCard(
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Description, contentDescription = null, modifier = Modifier.size(24.dp), tint = SpentyPrimary)
                Spacer(modifier = Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(statement.filename ?: "Statement", style = SpentyType.Headline)
                    Text(statement.accountName ?: viewModel.accountName(statement.accountId), style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                statement.status?.let { StatusBadge(text = it.replaceFirstChar { c -> c.titlecase() }, variant = statusVariant(it)) }
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            DetailRow("Period", if (statement.periodFrom != null && statement.periodTo != null) "${statement.periodFrom} - ${statement.periodTo}" else "N/A")
            DetailRow("Entries", "${statement.entryCount ?: viewModel.parsedEntries.size}")
            DetailRow("Type", statement.statementType?.replaceFirstChar { it.titlecase() } ?: "N/A")

            val progress = statement.processingProgress
            if (progress != null && progress > 0 && progress < 1) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text("Processing", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${(progress * 100).toInt()}%", style = SpentyType.Caption1, color = SpentyPrimary)
                }
                LinearProgressIndicator(
                    progress = { progress.toFloat() },
                    modifier = Modifier.fillMaxWidth(),
                    color = SpentyPrimary,
                    trackColor = SpentyPrimary.copy(alpha = 0.12f)
                )
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
private fun ActionButtons(
    canReconcile: Boolean, canAddMissing: Boolean, canApproveReject: Boolean,
    isPasswordRequired: Boolean, isReconciling: Boolean, selectedMissingCount: Int,
    onReconcile: () -> Unit, onBulkCategorize: () -> Unit, onAddMissing: () -> Unit,
    onReaudit: () -> Unit, onUnlock: () -> Unit, onApprove: () -> Unit, onReject: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (canReconcile) {
                Button(
                    onClick = onReconcile,
                    modifier = Modifier.weight(1f),
                    colors = SpentyStyle.primaryButtonColors(),
                    shape = RoundedCornerShape(10.dp),
                    enabled = !isReconciling
                ) {
                    if (isReconciling) CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Reconcile", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold))
                }
            }
            OutlinedButton(
                onClick = onBulkCategorize,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp),
                border = SpentyStyle.secondaryButtonBorder()
            ) {
                Icon(Icons.Filled.Label, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Bulk Categorize", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = SpentyPrimary)
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (canAddMissing) {
                ActionChip("Add All Missing", SpentyInfo, onAddMissing, Modifier.weight(1f))
            }
            ActionChip("Re-audit", SpentyWarning, onReaudit, Modifier.weight(1f))
            if (isPasswordRequired) {
                ActionChip("Unlock", MaterialTheme.colorScheme.onSurfaceVariant, onUnlock, Modifier.weight(1f))
            }
        }

        if (canApproveReject) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = onApprove,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = SpentySuccess),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Approve")
                }
                Button(
                    onClick = onReject,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = SpentyError),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(Icons.Filled.Cancel, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Reject")
                }
            }
        }
    }
}

@Composable
private fun ActionChip(text: String, color: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.1f))
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, style = SpentyType.Caption1.copy(fontWeight = FontWeight.Medium), color = color)
    }
}

@Composable
private fun ReconciliationResultsCard(result: ReconciliationResult) {
    ElevatedCard(
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Reconciliation Results", style = SpentyType.Headline)
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                ResultStat("Total", "${result.totalCount}", MaterialTheme.colorScheme.onSurface, Modifier.weight(1f))
                ResultStat("Matched", "${result.matchedCount}", SpentySuccess, Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                ResultStat("Missing (Ledger)", "${result.missingFromLedgerCount}", SpentyError, Modifier.weight(1f))
                ResultStat("Conflicts", "${result.conflictsCount}", SpentyError, Modifier.weight(1f))
            }

            result.openingBalance?.let { DetailRow("Opening Balance", String.format("%.2f", it)) }
            result.closingBalance?.let { DetailRow("Closing Balance", String.format("%.2f", it)) }
            result.computedClosing?.let { DetailRow("Computed Closing", String.format("%.2f", it)) }
            result.difference?.takeIf { it != 0.0 }?.let {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Difference", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(String.format("%.2f", it), style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold), color = if (it == 0.0) SpentySuccess else SpentyError)
                }
            }
        }
    }
}

@Composable
private fun ResultStat(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.06f))
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(value, style = SpentyType.Title3, color = color)
        Text(label, style = SpentyType.Caption1.copy(fontSize = 11.sp), color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ParsedEntriesSection(
    entries: List<ParsedEntry>,
    categories: List<Category>,
    onCategoryUpdate: (Int, String?, String?) -> Unit,
    viewModel: ReconciliationViewModel
) {
    ElevatedCard(
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Parsed Entries", style = SpentyType.Headline)
                Text("${entries.size} entries", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (entries.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.Inbox, contentDescription = null, modifier = Modifier.size(32.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
                        Text("No entries parsed yet", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            } else {
                entries.forEachIndexed { index, entry ->
                    EntryRow(entry, index, categories, onCategoryUpdate, viewModel)
                    if (index < entries.lastIndex) {
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun EntryRow(
    entry: ParsedEntry,
    index: Int,
    categories: List<Category>,
    onCategoryUpdate: (Int, String?, String?) -> Unit,
    viewModel: ReconciliationViewModel
) {
    var showCategoryMenu by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.background)
            .padding(12.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            entry.date?.let {
                Text(it, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            entry.amount?.let { amount ->
                Text(
                    String.format("%.2f", amount),
                    style = SpentyType.AmountSmall,
                    color = if (amount >= 0) SpentySuccess else SpentyError
                )
            }
        }
        entry.description?.let {
            Text(it, style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurface, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(SpentyPrimary.copy(alpha = 0.1f))
                        .clickable { showCategoryMenu = true }
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.Label, contentDescription = null, modifier = Modifier.size(12.dp), tint = SpentyPrimary)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        entry.categoryName ?: viewModel.categoryName(entry.categoryId),
                        style = SpentyType.Caption1,
                        color = SpentyPrimary
                    )
                    Icon(Icons.Filled.ExpandMore, contentDescription = null, modifier = Modifier.size(12.dp), tint = SpentyPrimary)
                }

                DropdownMenu(expanded = showCategoryMenu, onDismissRequest = { showCategoryMenu = false }) {
                    categories.forEach { category ->
                        DropdownMenuItem(
                            text = { Text(category.name ?: "Unnamed") },
                            onClick = {
                                onCategoryUpdate(index, category.id, category.name)
                                showCategoryMenu = false
                            }
                        )
                        category.children?.forEach { sub ->
                            DropdownMenuItem(
                                text = { Text("  ${sub.name ?: "Unnamed"}", style = SpentyType.Caption1) },
                                onClick = {
                                    onCategoryUpdate(index, sub.id, sub.name)
                                    showCategoryMenu = false
                                }
                            )
                        }
                    }
                }
            }

            if (entry.matched == true) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(12.dp), tint = SpentySuccess)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Matched", style = SpentyType.Caption1.copy(fontSize = 11.sp), color = SpentySuccess)
                }
            }
        }
    }
}

@Composable
fun SuccessBanner(message: String, onDismiss: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(SpentySuccess.copy(alpha = 0.1f))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = SpentySuccess, modifier = Modifier.size(20.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(message, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f))
        IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
            Icon(Icons.Filled.Close, contentDescription = "Dismiss", modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }

    LaunchedEffect(message) {
        kotlinx.coroutines.delay(3000)
        onDismiss()
    }
}

// Upload Sheet
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatementUploadSheet(viewModel: ReconciliationViewModel, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Text("Upload Statement", style = SpentyType.Headline)

            // Sub-type picker
            Column {
                Text("Account Sub-Type", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                var expanded by remember { mutableStateOf(false) }
                Box {
                    OutlinedCard(
                        modifier = Modifier.fillMaxWidth().clickable { expanded = true },
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(
                                if (viewModel.selectedSubType.isEmpty()) "Select sub-type" else viewModel.selectedSubType,
                                color = if (viewModel.selectedSubType.isEmpty()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface
                            )
                            Icon(Icons.Filled.ExpandMore, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                    }
                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        DropdownMenuItem(text = { Text("All Types") }, onClick = { viewModel.selectedSubType = ""; viewModel.selectedAccountId = ""; expanded = false })
                        viewModel.accountSubTypes.forEach { subType ->
                            DropdownMenuItem(
                                text = { Text(subType.name ?: "Unnamed") },
                                onClick = { viewModel.selectedSubType = subType.name ?: ""; viewModel.selectedAccountId = ""; expanded = false }
                            )
                        }
                    }
                }
            }

            // Account picker
            Column {
                Text("Account", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                var expanded by remember { mutableStateOf(false) }
                Box {
                    OutlinedCard(
                        modifier = Modifier.fillMaxWidth().clickable { expanded = true },
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(
                                if (viewModel.selectedAccountId.isEmpty()) "Select account" else viewModel.accountName(viewModel.selectedAccountId),
                                color = if (viewModel.selectedAccountId.isEmpty()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface
                            )
                            Icon(Icons.Filled.ExpandMore, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                    }
                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        viewModel.filteredAccounts.forEach { account ->
                            DropdownMenuItem(
                                text = { Text(account.name ?: "Unnamed") },
                                onClick = { viewModel.selectedAccountId = account.id; expanded = false }
                            )
                        }
                    }
                }
            }

            // File note
            ElevatedCard(
                shape = RoundedCornerShape(12.dp),
                colors = SpentyStyle.cardColors()
            ) {
                Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.UploadFile, contentDescription = null, modifier = Modifier.size(24.dp), tint = SpentyPrimary)
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Choose PDF or CSV", style = SpentyType.Subheadline)
                        Text("Supported: PDF, CSV", style = SpentyType.Caption1.copy(fontSize = 11.sp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            // Upload button placeholder
            Button(
                onClick = { /* File picker would be integrated here */ },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                colors = SpentyStyle.primaryButtonColors(),
                shape = SpentyStyle.primaryButtonShape,
                enabled = !viewModel.isUploading && viewModel.selectedAccountId.isNotEmpty()
            ) {
                if (viewModel.isUploading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(if (viewModel.isUploading) "Uploading..." else "Upload Statement")
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UnlockSheet(viewModel: ReconciliationViewModel, statementId: String) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = { viewModel.showUnlockSheet = false; viewModel.unlockPassword = "" },
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Icon(Icons.Filled.Lock, contentDescription = null, modifier = Modifier.size(48.dp), tint = SpentyPrimary)
            Text("Unlock PDF", style = SpentyType.Title3)
            Text("Enter the password to unlock this password-protected PDF statement.", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            OutlinedTextField(
                value = viewModel.unlockPassword,
                onValueChange = { viewModel.unlockPassword = it },
                label = { Text("PDF Password") },
                modifier = Modifier.fillMaxWidth(),
                shape = SpentyStyle.inputShape,
                colors = SpentyStyle.inputColors()
            )
            Button(
                onClick = { viewModel.unlock(statementId) },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                colors = SpentyStyle.primaryButtonColors(),
                shape = SpentyStyle.primaryButtonShape,
                enabled = viewModel.unlockPassword.isNotEmpty() && !viewModel.isProcessing
            ) {
                if (viewModel.isProcessing) { CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp); Spacer(modifier = Modifier.width(8.dp)) }
                Text(if (viewModel.isProcessing) "Unlocking..." else "Unlock")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BulkCategorizeSheet(categories: List<Category>, onSelect: (String) -> Unit, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp).verticalScroll(rememberScrollState())
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Select Category", style = SpentyType.Headline)
                TextButton(onClick = onDismiss) { Text("Cancel", color = SpentyPrimary) }
            }
            Spacer(modifier = Modifier.height(12.dp))
            categories.forEach { category ->
                TextButton(
                    onClick = { onSelect(category.id) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(category.name ?: "Unnamed", modifier = Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.onSurface)
                }
                category.children?.forEach { sub ->
                    TextButton(
                        onClick = { onSelect(sub.id) },
                        modifier = Modifier.fillMaxWidth().padding(start = 16.dp)
                    ) {
                        Text(sub.name ?: "Unnamed", modifier = Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.onSurface, style = SpentyType.Caption1)
                    }
                }
            }
            Spacer(modifier = Modifier.height(40.dp))
        }
    }
}

private fun statusVariant(status: String): BadgeVariant {
    return when (status.lowercase()) {
        "approved", "reconciled", "parsed" -> BadgeVariant.SUCCESS
        "rejected", "failed", "error" -> BadgeVariant.ERROR
        "parsing", "uploaded", "processing" -> BadgeVariant.WARNING
        "password_required" -> BadgeVariant.INFO
        else -> BadgeVariant.NEUTRAL
    }
}
