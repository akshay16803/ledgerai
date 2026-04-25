package com.spentyai.app.features.paymentplans

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.PlaylistAddCheck
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.BadgeVariant
import com.spentyai.app.core.components.EmptyStateView
import com.spentyai.app.core.components.LoadingView
import com.spentyai.app.core.components.StatCard
import com.spentyai.app.core.components.StatusBadge
import com.spentyai.app.core.components.formatCurrency
import com.spentyai.app.core.models.PaymentPlan
import com.spentyai.app.core.models.PaymentPlanStatus
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyInfo
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentPlansScreen(
    viewModel: PaymentPlansViewModel
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { viewModel.loadPlans() }

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Payment Plans", style = SpentyType.Title2) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (state.isLoading && state.plans.isEmpty()) {
                LoadingView(message = "Loading payment plans...")
            } else {
                val filtered = viewModel.filteredPlans()
                val allPlans = state.plans

                if (allPlans.isEmpty()) {
                    EmptyStateView(
                        icon = Icons.Filled.CreditCard,
                        title = "No Payment Plans",
                        subtitle = "Payment plans you create will appear here."
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 80.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        // Summary stat cards
                        item {
                            PaymentPlansSummary(plans = allPlans)
                        }

                        // Filter chips
                        item {
                            StatusFilterRow(
                                current = state.statusFilter,
                                onSelect = { viewModel.setStatusFilter(it) }
                            )
                        }

                        if (filtered.isEmpty()) {
                            item {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(32.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        "No plans match this filter.",
                                        style = SpentyType.Body,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        } else {
                            items(filtered, key = { it.id }) { plan ->
                                PaymentPlanRow(plan = plan)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PaymentPlansSummary(plans: List<PaymentPlan>) {
    val activePlans = plans.filter { it.status == PaymentPlanStatus.ACTIVE }
    val totalRemaining = activePlans.sumOf { it.amountRemaining }
    val totalAmount = activePlans.sumOf { it.totalAmount }

    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                title = "Active Plans",
                value = activePlans.size.toString(),
                icon = Icons.Filled.PlaylistAddCheck,
                iconColor = SpentyPrimary,
                modifier = Modifier.weight(1f)
            )
            StatCard(
                title = "Total Remaining",
                value = formatCurrency(totalRemaining),
                icon = Icons.Filled.AccountBalance,
                iconColor = SpentyWarning,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun StatusFilterRow(
    current: PaymentPlanStatus?,
    onSelect: (PaymentPlanStatus?) -> Unit
) {
    data class FilterOption(val label: String, val value: PaymentPlanStatus?)

    val options = listOf(
        FilterOption("All", null),
        FilterOption("Active", PaymentPlanStatus.ACTIVE),
        FilterOption("Completed", PaymentPlanStatus.COMPLETED),
        FilterOption("Paused", PaymentPlanStatus.PAUSED),
        FilterOption("Cancelled", PaymentPlanStatus.CANCELLED),
        FilterOption("Defaulted", PaymentPlanStatus.DEFAULTED)
    )

    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(options) { option ->
            FilterChip(
                selected = current == option.value,
                onClick = { onSelect(option.value) },
                label = { Text(option.label, style = SpentyType.Caption1) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SpentyPrimary.copy(alpha = 0.15f),
                    selectedLabelColor = SpentyPrimary
                )
            )
        }
    }
}

@Composable
private fun PaymentPlanRow(plan: PaymentPlan) {
    ElevatedCard(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = plan.name,
                    style = SpentyType.Headline,
                    modifier = Modifier.weight(1f)
                )
                StatusBadge(
                    text = plan.status.name.lowercase().replaceFirstChar { it.uppercase() },
                    variant = plan.status.toBadgeVariant()
                )
            }

            if (!plan.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = plan.description,
                    style = SpentyType.Subheadline,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Progress bar
            val progress = if (plan.totalAmount > 0) {
                (plan.amountPaid / plan.totalAmount).toFloat().coerceIn(0f, 1f)
            } else 0f

            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth(),
                color = SpentyPrimary,
                trackColor = SpentyPrimary.copy(alpha = 0.12f)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                PlanAmountLabel("Paid", formatCurrency(plan.amountPaid, plan.currency))
                PlanAmountLabel("Remaining", formatCurrency(plan.amountRemaining, plan.currency), highlight = true)
                PlanAmountLabel("Total", formatCurrency(plan.totalAmount, plan.currency))
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (plan.numInstallments > 0) {
                    Text(
                        text = "${plan.installmentsPaid}/${plan.numInstallments} installments",
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (!plan.nextPaymentDate.isNullOrBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        androidx.compose.material3.Icon(
                            imageVector = Icons.Filled.CalendarToday,
                            contentDescription = null,
                            modifier = Modifier
                                .padding(start = 4.dp)
                                .let { it },
                            tint = SpentyInfo
                        )
                        Text(
                            text = "Next: ${plan.nextPaymentDate}",
                            style = SpentyType.Caption1,
                            color = SpentyInfo
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PlanAmountLabel(title: String, amount: String, highlight: Boolean = false) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = title,
            style = SpentyType.Caption1,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = amount,
            style = SpentyType.Caption1.copy(fontWeight = if (highlight) FontWeight.SemiBold else FontWeight.Normal),
            color = if (highlight) SpentyError else MaterialTheme.colorScheme.onSurface
        )
    }
}

private fun PaymentPlanStatus.toBadgeVariant(): BadgeVariant = when (this) {
    PaymentPlanStatus.ACTIVE -> BadgeVariant.SUCCESS
    PaymentPlanStatus.COMPLETED -> BadgeVariant.INFO
    PaymentPlanStatus.PAUSED -> BadgeVariant.WARNING
    PaymentPlanStatus.CANCELLED -> BadgeVariant.NEUTRAL
    PaymentPlanStatus.DEFAULTED -> BadgeVariant.ERROR
}
