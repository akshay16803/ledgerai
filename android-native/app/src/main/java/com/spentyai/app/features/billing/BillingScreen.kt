package com.spentyai.app.features.billing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillingScreen(
    viewModel: BillingViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToPaymentHistory: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val uriHandler = LocalUriHandler.current

    LaunchedEffect(Unit) {
        viewModel.loadAll()
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

    if (state.showCancelConfirmation) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissCancelConfirmation() },
            title = { Text("Cancel Subscription", style = SpentyType.Headline) },
            text = {
                Text(
                    "Are you sure you want to cancel your subscription? You'll retain access until the end of your current billing period.",
                    style = SpentyType.Body
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val url = viewModel.getCancelSubscriptionUrl()
                        viewModel.cancelSubscription() // dismisses dialog
                        try {
                            uriHandler.openUri(url)
                        } catch (_: Throwable) {
                            // openUri may throw if no activity can handle it; swallow.
                        }
                        viewModel.refreshAfterCancelReturn()
                    },
                    colors = SpentyStyle.destructiveButtonColors()
                ) {
                    Text("Cancel Plan")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissCancelConfirmation() }) {
                    Text("Keep Plan")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Subscription", style = SpentyType.Title3) },
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
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // Current plan header
                state.currentStatus?.takeIf { it.isActive }?.let { status ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(SpentyPrimary.copy(alpha = 0.08f))
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Verified, contentDescription = null, tint = SpentyPrimary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Active Subscription", style = SpentyType.Headline, color = SpentyPrimary)
                        }
                        status.plan?.let { plan ->
                            Text(plan, style = SpentyType.Title3)
                        }
                        status.expiresAt?.let { expires ->
                            Text("Renews $expires", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        status.provider?.let { provider ->
                            Text("via ${provider.replaceFirstChar { it.uppercase() }}", style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }

                // Plan cards
                Column {
                    Text("Choose a Plan", style = SpentyType.Title3)
                    Spacer(modifier = Modifier.height(12.dp))
                    BillingRepository.fallbackPlans.forEach { plan ->
                        PlanCard(
                            plan = plan,
                            isCurrent = viewModel.isCurrentPlan(plan.productId),
                            isPurchasing = state.purchasingProductId == plan.productId,
                            onSubscribe = { viewModel.purchasePlan(plan.productId) },
                            isAnyPurchasing = state.isPurchasing
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                }

                // Promo code
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(2.dp, RoundedCornerShape(14.dp))
                        .clip(RoundedCornerShape(14.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(16.dp)
                ) {
                    Text("Promo Code", style = SpentyType.Title3)
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = state.promoCode,
                            onValueChange = { viewModel.onPromoCodeChange(it) },
                            placeholder = { Text("Enter promo code") },
                            modifier = Modifier.weight(1f),
                            colors = SpentyStyle.inputColors(),
                            shape = SpentyStyle.inputShape,
                            singleLine = true
                        )
                        OutlinedButton(
                            onClick = { viewModel.validatePromo() },
                            enabled = state.promoCode.isNotBlank() && !state.isValidatingPromo
                        ) {
                            if (state.isValidatingPromo) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Validate")
                            }
                        }
                    }
                    if (state.promoMessage.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                if (state.promoValid == true) Icons.Default.CheckCircle else Icons.Default.Cancel,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = if (state.promoValid == true) SpentyPrimary else SpentyError
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                state.promoMessage,
                                style = SpentyType.Caption1,
                                color = if (state.promoValid == true) SpentyPrimary else SpentyError
                            )
                        }
                    }
                    if (state.promoValid == true) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = { viewModel.activatePromo() },
                            enabled = !state.isActivatingPromo,
                            colors = SpentyStyle.primaryButtonColors(),
                            shape = SpentyStyle.primaryButtonShape,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            if (state.isActivatingPromo) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text("Activate Promo Code", color = Color.White)
                        }
                    }
                }

                // Payment History preview
                if (state.paymentHistory.isNotEmpty()) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Payment History", style = SpentyType.Title3)
                            TextButton(onClick = onNavigateToPaymentHistory) {
                                Text("See All", color = SpentyPrimary)
                            }
                        }
                        state.paymentHistory.take(3).forEach { order ->
                            PaymentRow(order)
                        }
                    }
                }

                // Cancel
                if (state.isSubscribed) {
                    TextButton(
                        onClick = { viewModel.showCancelConfirmation() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp), tint = SpentyError)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Cancel Subscription", color = SpentyError, style = SpentyType.Subheadline)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
            }

            if (state.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.background.copy(alpha = 0.7f)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = SpentyPrimary)
                }
            }
        }
    }
}

@Composable
private fun PlanCard(
    plan: FallbackPlan,
    isCurrent: Boolean,
    isPurchasing: Boolean,
    isAnyPurchasing: Boolean,
    onSubscribe: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(2.dp, RoundedCornerShape(14.dp))
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .then(
                if (isCurrent) Modifier.border(2.dp, SpentyPrimary, RoundedCornerShape(14.dp))
                else Modifier
            )
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(plan.name, style = SpentyType.Headline)
                    if (isCurrent) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            "Active",
                            style = SpentyType.Caption2.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(SpentyPrimary)
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                    plan.badge?.let { badge ->
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            badge,
                            style = SpentyType.Caption2.copy(fontWeight = FontWeight.Bold),
                            color = Color.White,
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(Color(0xFFFF9500))
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                }
                plan.subtitle?.let { subtitle ->
                    Text(subtitle, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(plan.displayPrice, style = SpentyType.Title3, color = SpentyPrimary)
                plan.perUnit?.let { per ->
                    Text(per, style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        if (!isCurrent) {
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = onSubscribe,
                enabled = !isAnyPurchasing,
                colors = SpentyStyle.primaryButtonColors(),
                shape = SpentyStyle.primaryButtonShape,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isPurchasing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Subscribe", style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold), color = Color.White)
                }
            }
        }
    }
}

@Composable
private fun PaymentRow(order: PaymentOrder) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Text(order.plan ?: "Unknown", style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium))
            Text(
                formatPaymentDate(order.createdAt),
                style = SpentyType.Caption1,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                formatPaymentAmount(order.amount, order.currency),
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold)
            )
            Text(
                (order.status ?: "").replaceFirstChar { it.uppercase() },
                style = SpentyType.Caption2,
                color = if (order.status == "completed" || order.status == "paid") SpentyPrimary else SpentyError
            )
        }
    }
}

private fun formatPaymentAmount(amount: Double?, currency: String?): String {
    if (amount == null) return "--"
    val rupees = amount / 100.0
    return if (rupees % 1.0 == 0.0) {
        String.format("\u20B9%.0f", rupees)
    } else {
        String.format("\u20B9%.2f", rupees)
    }
}

private fun formatPaymentDate(dateString: String?): String {
    if (dateString.isNullOrEmpty()) return ""
    return try {
        val formats = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US),
            SimpleDateFormat("yyyy-MM-dd", Locale.US)
        )
        val display = SimpleDateFormat("dd MMM yyyy", Locale.US)
        for (fmt in formats) {
            try {
                fmt.parse(dateString)?.let { return display.format(it) }
            } catch (_: Exception) {}
        }
        if (dateString.length >= 10) dateString.substring(0, 10) else dateString
    } catch (_: Exception) {
        dateString
    }
}
