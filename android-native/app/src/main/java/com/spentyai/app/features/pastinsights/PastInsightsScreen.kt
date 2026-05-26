package com.spentyai.app.features.pastinsights

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.EmptyStateView
import com.spentyai.app.core.components.LoadingView
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentySuccess
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning
import com.spentyai.app.features.billing.BillingRepository
import com.spentyai.app.features.billing.BillingViewModel
import com.spentyai.app.features.billing.PremiumFeatureSheet
import android.app.Activity
import androidx.compose.ui.platform.LocalContext
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PastInsightsScreen(
    viewModel: PastInsightsViewModel,
    billingViewModel: BillingViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToDetail: (String) -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    // ── Premium gate (Past Insights is the paid Premium tier) ───────────
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
            if (!hasPremium) onNavigateBack()
        }
        ModalBottomSheet(
            onDismissRequest = closeSheet,
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            PremiumFeatureSheet.Bundle(
                monthlyPriceDisplay = billingViewModel.displayPrice(BillingRepository.PRODUCT_MONTHLY) ?: "₹199",
                lifetimePriceDisplay = billingViewModel.displayPrice(BillingRepository.PRODUCT_LIFETIME_OFFER) ?: "₹4,999",
                isPurchasing = billingState.isPurchasing,
                onSubscribe = onSub@{
                    val act = activity ?: return@onSub
                    val details = billingState.productDetailsList
                        .firstOrNull { it.productId == BillingRepository.PRODUCT_MONTHLY }
                        ?: return@onSub
                    billingViewModel.purchaseSubscription(details, act)
                },
                onSubscribeLifetime = onLife@{
                    val act = activity ?: return@onLife
                    billingViewModel.purchaseLifetimeOffer(act)
                },
                onClose = closeSheet
            )
        }
    }

    // Gate data load behind hasPremium — backend 402s for free users.
    LaunchedEffect(hasPremium) {
        if (hasPremium) viewModel.loadSummaries()
    }

    if (state.showError) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissError() },
            title = { Text("Error", style = SpentyType.Headline) },
            text = { Text(state.errorMessage, style = SpentyType.Body) },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissError() }) {
                    Text("OK", color = SpentyPrimary)
                }
            }
        )
    }

    // Create form bottom sheet
    if (state.showCreateForm) {
        ModalBottomSheet(
            onDismissRequest = { viewModel.dismissCreateForm() },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ) {
            CreateSummaryForm(viewModel, state)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Past Insights", style = SpentyType.Title3) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.startCreate() }) {
                        Icon(Icons.Default.Add, contentDescription = "New", tint = SpentyPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { padding ->
        when {
            state.isLoading && state.summaries.isEmpty() -> {
                LoadingView(message = "Loading past insight summaries...")
            }
            state.summaries.isEmpty() && !state.isLoading -> {
                EmptyStateView(
                    icon = Icons.Default.Search,
                    title = "No Past Insight Summaries",
                    subtitle = "Create a past insight summary to analyze your income and expenses over a date range.",
                    modifier = Modifier.padding(padding),
                    action = {
                        Button(
                            onClick = { viewModel.startCreate() },
                            colors = SpentyStyle.primaryButtonColors(),
                            shape = SpentyStyle.primaryButtonShape
                        ) {
                            Text("Create Summary")
                        }
                    }
                )
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item { Spacer(modifier = Modifier.height(4.dp)) }
                    items(state.summaries, key = { it.id }) { summary ->
                        SummaryCard(
                            summary = summary,
                            onClick = {
                                viewModel.setSummaryForDetail(summary)
                                onNavigateToDetail(summary.id)
                            }
                        )
                    }
                    item { Spacer(modifier = Modifier.height(16.dp)) }
                }
            }
        }
    }
}

@Composable
private fun SummaryCard(
    summary: PastInsightSummary,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = summary.name ?: "Untitled",
                style = SpentyType.Body.copy(fontWeight = FontWeight.SemiBold),
                modifier = Modifier.weight(1f),
                maxLines = 1
            )
            StatusBadge(summary.status ?: "unknown")
        }

        if (summary.dateFrom != null && summary.dateTo != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "${formatDate(summary.dateFrom)} - ${formatDate(summary.dateTo)}",
                style = SpentyType.Caption1,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            FinancialPill("Income", summary.totalIncome, SpentySuccess)
            FinancialPill("Expense", summary.totalExpense, SpentyError)
            FinancialPill("Net", summary.net, SpentyPrimary)
        }
    }
}

@Composable
private fun StatusBadge(status: String) {
    val color = when (status.lowercase()) {
        "completed" -> SpentySuccess
        "processing" -> SpentyWarning
        "failed" -> SpentyError
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Text(
        text = status.replaceFirstChar { it.uppercase() },
        style = SpentyType.Caption2.copy(fontWeight = FontWeight.SemiBold),
        color = color,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 8.dp, vertical = 3.dp)
    )
}

@Composable
private fun FinancialPill(label: String, value: Double?, color: Color) {
    Column {
        Text(text = label, style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            text = formatCurrency(value ?: 0.0),
            style = SpentyType.Caption1.copy(fontWeight = FontWeight.Medium),
            color = color
        )
    }
}

@Composable
private fun CreateSummaryForm(
    viewModel: PastInsightsViewModel,
    state: PastInsightsUiState
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp)
    ) {
        Text("New Past Insight Summary", style = SpentyType.Title3)
        Spacer(modifier = Modifier.height(20.dp))

        OutlinedTextField(
            value = state.createName,
            onValueChange = { viewModel.updateCreateName(it) },
            label = { Text("Name") },
            modifier = Modifier.fillMaxWidth(),
            colors = SpentyStyle.inputColors(),
            shape = SpentyStyle.inputShape
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text("Date range will default to the past year.", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = { viewModel.createSummary() },
            enabled = !state.isCreating,
            colors = SpentyStyle.primaryButtonColors(),
            shape = SpentyStyle.primaryButtonShape,
            modifier = SpentyStyle.primaryButtonModifier
        ) {
            if (state.isCreating) {
                CircularProgressIndicator(
                    modifier = Modifier.padding(end = 8.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
            }
            Text(
                text = "Generate Past Insight Summary",
                style = SpentyType.Headline,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
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
