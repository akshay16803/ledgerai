package com.spentyai.app.features.accounts

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.*
import com.spentyai.app.core.models.DematStatement
import com.spentyai.app.core.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DematUploadScreen(
    viewModel: AccountsViewModel,
    accountId: String,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    var showConfirmAction by remember { mutableStateOf<Pair<String, Boolean>?>(null) }

    LaunchedEffect(accountId) {
        viewModel.loadDematStatements(accountId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Demat Statements", style = SpentyType.Headline) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Upload area
            item {
                OutlinedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
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
                            Icon(Icons.Filled.UploadFile, contentDescription = null, modifier = Modifier.size(32.dp), tint = SpentyPrimary)
                            Spacer(modifier = Modifier.height(10.dp))
                            Text("Upload CDSL / Demat Statement", style = SpentyType.Callout.copy(fontWeight = FontWeight.Medium), color = SpentyPrimary)
                            Text("PDF or CSV files supported", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }

            // Statements
            if (state.isDematLoading && state.dematStatements.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = SpentyPrimary)
                    }
                }
            } else if (state.dematStatements.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("No statements uploaded", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("Upload a CDSL statement to view your demat holdings.", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f), textAlign = TextAlign.Center)
                    }
                }
            } else {
                item {
                    ElevatedCard(
                        modifier = Modifier.fillMaxWidth(),
                        shape = SpentyStyle.cardShape,
                        colors = SpentyStyle.cardColors(),
                        elevation = SpentyStyle.cardElevation()
                    ) {
                        Column {
                            state.dematStatements.forEachIndexed { index, statement ->
                                DematRow(
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
        }
    }

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
private fun DematRow(
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
