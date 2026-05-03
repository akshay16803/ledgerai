package com.spentyai.app.features.billing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
    val context = LocalContext.current

    // Lifetime-offer modal state. Two modes:
    //  - Upgrade mode (existing subscriber tapped the gold banner) → no timer
    //  - Intercept mode (non-subscriber tapped Subscribe on Monthly while the
    //    1-hour offer window is still open) → countdown
    var showLifetimeOffer by remember { mutableStateOf(false) }
    var isUpgradeMode by remember { mutableStateOf(false) }

    if (showLifetimeOffer) {
        LifetimeOfferSheet(
            showTimer = !isUpgradeMode,
            offerPrice = viewModel.displayPrice(BillingRepository.PRODUCT_LIFETIME_OFFER)
                ?: BillingRepository.lifetimeOfferPlan.displayPrice,
            // Drive isPurchasing from VM state so the spinner clears when Play
            // returns USER_CANCELED and the user can retry from the same sheet.
            isPurchasing = state.purchasingProductId == BillingRepository.PRODUCT_LIFETIME_OFFER,
            onAccept = {
                val activity = context as? android.app.Activity
                if (activity != null) viewModel.purchaseLifetimeOffer(activity)
                // Sheet stays open while Play dialog is up; once the purchase
                // resolves (success or cancel), the listener flips
                // purchasingProductId and the sheet either closes (success
                // routes through isLifetime change) or shows the CTA again.
            },
            onDecline = {
                // Mirror iOS guideline 3.1.1 behavior: declining the offer just
                // closes the sheet — we do NOT auto-charge the Monthly plan the
                // user originally tapped. They can tap Subscribe again if they
                // want to commit to Monthly.
                showLifetimeOffer = false
                isUpgradeMode = false
            }
        )
    }

    // When the lifetime purchase succeeds, the VM's currentStatus updates and
    // isLifetime becomes true — close the sheet automatically.
    LaunchedEffect(state.isLifetime) {
        if (state.isLifetime && showLifetimeOffer) {
            showLifetimeOffer = false
            isUpgradeMode = false
        }
    }

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

                // Subscriber upgrade banner — only when user has an active SUBS
                // (Monthly/Quarterly/Yearly) and has not bought Lifetime yet.
                // Mirrors iOS BillingView.subscriberUpgradeBanner.
                if (state.isSubscribed && !state.isLifetime) {
                    SubscriberUpgradeBanner(
                        regularPrice = viewModel.displayPrice(BillingRepository.PRODUCT_LIFETIME),
                        offerPrice = viewModel.displayPrice(BillingRepository.PRODUCT_LIFETIME_OFFER)
                            ?: BillingRepository.lifetimeOfferPlan.displayPrice,
                        onUpgrade = {
                            isUpgradeMode = true
                            showLifetimeOffer = true
                        }
                    )
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
                            onSubscribe = {
                                // iOS-parity intercept: a non-lifetime user tapping
                                // Subscribe on Monthly while the 1-hour offer window
                                // is still open sees the lifetime offer first. All
                                // other taps go straight to Play Billing.
                                val isMonthly = plan.productId == BillingRepository.PRODUCT_MONTHLY
                                val offerOpen = LifetimeOfferManager.shared(context).isOfferActive
                                if (isMonthly && offerOpen && !state.isLifetime) {
                                    isUpgradeMode = false
                                    showLifetimeOffer = true
                                } else {
                                    val activity = context as? android.app.Activity
                                    val productDetails = state.productDetailsList
                                        .firstOrNull { it.productId == plan.productId }
                                    if (activity != null && productDetails != null) {
                                        viewModel.purchaseSubscription(productDetails, activity)
                                    } else {
                                        viewModel.purchasePlan(plan.productId)
                                    }
                                }
                            },
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

                // Terms of Service + Privacy Policy footer.
                // Required by Apple guideline 3.1.2 / Play UX parity, and mirrors
                // SubscriptionPaywallScreen.TermsSection.
                BillingTermsSection(uriHandler = uriHandler)

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

/**
 * Gold-bordered upgrade-to-Lifetime banner shown to users who already have an
 * active subscription (Monthly / Quarterly / Yearly). Tapping the CTA opens
 * the LifetimeOfferSheet in upgrade mode (no timer). Mirrors iOS
 * BillingView.subscriberUpgradeBanner exactly — same gold accent (#D4AF37),
 * same strikethrough regular price + bold offer price + 50% OFF pill.
 */
@Composable
private fun SubscriberUpgradeBanner(
    regularPrice: String?,
    offerPrice: String,
    onUpgrade: () -> Unit
) {
    val gold = Color(0xFFD4AF37)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(2.dp, RoundedCornerShape(16.dp))
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.5.dp, gold.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // SUBSCRIBER EXCLUSIVE pill
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(gold.copy(alpha = 0.12f))
                .padding(horizontal = 10.dp, vertical = 5.dp)
        ) {
            Icon(
                Icons.Default.Verified,
                contentDescription = null,
                tint = gold,
                modifier = Modifier.size(10.dp)
            )
            Text(
                "SUBSCRIBER EXCLUSIVE",
                style = SpentyType.Caption2.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp
                ),
                color = gold
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                "Upgrade to Lifetime Access",
                style = SpentyType.Title3.copy(fontWeight = FontWeight.Bold)
            )
            Text(
                "Pay once and never subscribe again.",
                style = SpentyType.Subheadline,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Row(
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Strikethrough regular price (only if Play has loaded it)
            regularPrice?.let {
                Text(
                    it,
                    style = SpentyType.Subheadline.copy(textDecoration = TextDecoration.LineThrough),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            // Bold offer price
            Text(
                offerPrice,
                style = SpentyType.Title2.copy(fontWeight = FontWeight.Bold),
                color = SpentyPrimary
            )
            Text(
                "50% OFF",
                style = SpentyType.Caption1.copy(fontWeight = FontWeight.Bold),
                color = Color.White,
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(Color(0xFFFF9500))
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }

        // Primary CTA — full width, primary green, price right-aligned
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(SpentyPrimary)
                .clickable(onClick = onUpgrade)
                .padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Upgrade Now",
                style = SpentyType.Headline,
                color = Color.White,
                modifier = Modifier.weight(1f)
            )
            Text(
                offerPrice,
                style = SpentyType.Headline,
                color = Color.White
            )
        }
    }
}

/**
 * Terms of Service + Privacy Policy footer for the in-app subscription
 * management screen. Mirrors SubscriptionPaywallScreen.TermsSection so already-
 * subscribed users still have a one-tap path to the legal docs from inside the
 * app — required for Apple guideline 3.1.2 parity and Play UX best practice.
 */
@Composable
private fun BillingTermsSection(uriHandler: androidx.compose.ui.platform.UriHandler) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Terms of Service",
                style = SpentyType.Caption2.copy(textDecoration = TextDecoration.Underline),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.clickable { uriHandler.openUri("https://spentyai.com/terms") }
            )
            Text(
                "·",
                style = SpentyType.Caption2,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                "Privacy Policy",
                style = SpentyType.Caption2.copy(textDecoration = TextDecoration.Underline),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.clickable { uriHandler.openUri("https://spentyai.com/privacy") }
            )
        }
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
