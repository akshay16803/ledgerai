package com.spentyai.app.features.onboarding

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.android.billingclient.api.ProductDetails
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.features.billing.BillingRepository
import com.spentyai.app.features.billing.BillingViewModel
import com.spentyai.app.features.billing.FallbackPlan

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionPaywallScreen(
    viewModel: BillingViewModel,
    onDismiss: () -> Unit,
    onSubscribed: () -> Unit,
    onSignOut: (() -> Unit)? = null,
) {
    val state by viewModel.uiState.collectAsState()
    var selectedProductId by remember { mutableStateOf("com.spentyai.yearly") }
    var showPromoSection by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    // Surface restore-purchase result as a snackbar.
    LaunchedEffect(state.restoreMessage) {
        state.restoreMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.dismissRestoreMessage()
        }
    }

    LaunchedEffect(Unit) {
        viewModel.loadAll()
    }

    LaunchedEffect(state.isSubscribed) {
        if (state.isSubscribed) {
            onSubscribed()
        }
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = {},
                navigationIcon = {
                    if (onSignOut == null) {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, contentDescription = "Close")
                        }
                    }
                },
                actions = {
                    val signOutAction = onSignOut
                    if (signOutAction != null) {
                        TextButton(onClick = signOutAction) {
                            Text(
                                text = "Sign Out",
                                color = SpentyPrimary,
                                style = SpentyType.Subheadline
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 40.dp),
                verticalArrangement = Arrangement.spacedBy(28.dp)
            ) {
                // Hero section
                HeroSection()

                // Plan selection — prefer Play Store product details, fall back to static plans
                if (state.productDetailsList.isNotEmpty()) {
                    PlayProductSelectionSection(
                        productDetailsList = state.productDetailsList,
                        selectedProductId = selectedProductId,
                        onSelectPlan = { selectedProductId = it }
                    )
                } else {
                    PlanSelectionSection(
                        plans = BillingRepository.fallbackPlans,
                        selectedProductId = selectedProductId,
                        onSelectPlan = { selectedProductId = it }
                    )
                }

                // Subscribe button
                Button(
                    onClick = {
                        val activity = context as? android.app.Activity
                        val productDetails = state.productDetailsList.find { it.productId == selectedProductId }
                        if (activity != null && productDetails != null) {
                            viewModel.purchaseSubscription(productDetails, activity)
                        } else {
                            viewModel.purchasePlan(selectedProductId)
                        }
                    },
                    enabled = !state.isPurchasing,
                    colors = SpentyStyle.primaryButtonColors(),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp)
                ) {
                    Text(
                        "Continue",
                        style = SpentyType.Headline,
                        color = Color.White
                    )
                }

                // Restore Purchases (user-initiated). Required for Play UX & support cases.
                OutlinedButton(
                    onClick = { viewModel.restorePurchasesAction() },
                    enabled = !state.isRestoringPurchases && !state.isPurchasing,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                ) {
                    if (state.isRestoringPurchases) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = SpentyPrimary,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(
                        "Restore Purchases",
                        style = SpentyType.Subheadline,
                        color = SpentyPrimary
                    )
                }

                // Promo section
                PromoSection(
                    showPromoSection = showPromoSection,
                    onTogglePromo = { showPromoSection = !showPromoSection },
                    promoCode = state.promoCode,
                    onPromoCodeChange = { viewModel.onPromoCodeChange(it) },
                    isValidating = state.isValidatingPromo,
                    onValidate = { viewModel.validatePromo() },
                    promoMessage = state.promoMessage,
                    promoValid = state.promoValid,
                    isActivating = state.isActivatingPromo,
                    onActivate = { viewModel.activatePromo() }
                )

                // Detection note
                DetectionNote()

                // Terms section
                TermsSection()
            }

            // Processing overlay
            if (state.isPurchasing) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.3f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(MaterialTheme.colorScheme.surface)
                            .padding(28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        CircularProgressIndicator(color = SpentyPrimary)
                        Text(
                            "Processing...",
                            style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium)
                        )
                    }
                }
            }
        }
    }
}

// --- Play Store product details section ---

@Composable
private fun PlayProductSelectionSection(
    productDetailsList: List<ProductDetails>,
    selectedProductId: String,
    onSelectPlan: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        productDetailsList.forEach { productDetails ->
            PlayProductOption(
                productDetails = productDetails,
                isSelected = selectedProductId == productDetails.productId,
                onSelect = { onSelectPlan(productDetails.productId) }
            )
        }
    }
}

@Composable
private fun PlayProductOption(
    productDetails: ProductDetails,
    isSelected: Boolean,
    onSelect: () -> Unit
) {
    // Pick the cheapest offer's pricing phase for display
    val offerDetails = productDetails.subscriptionOfferDetails?.firstOrNull()
    val pricingPhase = offerDetails?.pricingPhases?.pricingPhaseList?.lastOrNull()
    val displayPrice = pricingPhase?.formattedPrice ?: ""
    val billingPeriod = when (pricingPhase?.billingPeriod) {
        "P1M" -> "/month"
        "P1Y" -> "/year"
        "P3M" -> "/3 months"
        else -> ""
    }
    val isYearly = productDetails.productId.contains("year", ignoreCase = true)
    val badge = if (isYearly) "Popular" else null

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (isSelected) SpentyPrimary.copy(alpha = 0.06f)
                else MaterialTheme.colorScheme.surface
            )
            .border(
                width = if (isSelected) 2.dp else 1.dp,
                color = if (isSelected) SpentyPrimary else Color.Gray.copy(alpha = 0.12f),
                shape = RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onSelect)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Radio button
        Box(
            modifier = Modifier
                .size(22.dp)
                .border(
                    width = 2.dp,
                    color = if (isSelected) SpentyPrimary else Color.Gray.copy(alpha = 0.3f),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            if (isSelected) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(SpentyPrimary)
                )
            }
        }

        // Name + badge
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    productDetails.name,
                    style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold)
                )
                badge?.let {
                    Text(
                        text = it,
                        style = SpentyType.Caption2.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(Color(0xFFFF9500))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
            productDetails.description.takeIf { it.isNotEmpty() }?.let {
                Text(
                    it,
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Price
        Column(horizontalAlignment = Alignment.End) {
            Text(
                displayPrice,
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Bold),
                color = SpentyPrimary
            )
            if (billingPeriod.isNotEmpty()) {
                Text(
                    billingPeriod,
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

// --- Fallback static plan section (unchanged) ---

@Composable
private fun HeroSection() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Spacer(modifier = Modifier.height(20.dp))

        // Crown icon with gradient tint
        Icon(
            imageVector = Icons.Default.Star,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = SpentyPrimary
        )

        Text(
            text = "Unlock SpentyAI Premium",
            style = SpentyType.Title1,
            textAlign = TextAlign.Center
        )

        Text(
            text = "Smart financial insights, AI-powered categorization, and complete control over your money.",
            style = SpentyType.Subheadline,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 12.dp)
        )

        // Feature pills
        Column(
            modifier = Modifier.padding(top = 4.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            FeatureRow(icon = Icons.Default.Psychology, text = "AI-powered transaction insights")
            FeatureRow(icon = Icons.Default.Insights, text = "Advanced cash flow analytics")
            FeatureRow(icon = Icons.Default.Email, text = "Automatic email & SMS sync")
            FeatureRow(icon = Icons.Default.Description, text = "Unlimited invoices & reports")
        }
    }
}

@Composable
private fun FeatureRow(icon: ImageVector, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = SpentyPrimary
        )
        Text(text, style = SpentyType.Subheadline)
    }
}

@Composable
private fun PlanSelectionSection(
    plans: List<FallbackPlan>,
    selectedProductId: String,
    onSelectPlan: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        plans.forEach { plan ->
            PlanOption(
                plan = plan,
                isSelected = selectedProductId == plan.productId,
                onSelect = { onSelectPlan(plan.productId) }
            )
        }
    }
}

@Composable
private fun PlanOption(
    plan: FallbackPlan,
    isSelected: Boolean,
    onSelect: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (isSelected) SpentyPrimary.copy(alpha = 0.06f)
                else MaterialTheme.colorScheme.surface
            )
            .border(
                width = if (isSelected) 2.dp else 1.dp,
                color = if (isSelected) SpentyPrimary else Color.Gray.copy(alpha = 0.12f),
                shape = RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onSelect)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Radio button
        Box(
            modifier = Modifier
                .size(22.dp)
                .border(
                    width = 2.dp,
                    color = if (isSelected) SpentyPrimary else Color.Gray.copy(alpha = 0.3f),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            if (isSelected) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(SpentyPrimary)
                )
            }
        }

        // Name + badge + subtitle
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    plan.name,
                    style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold)
                )
                plan.badge?.let { badge ->
                    Text(
                        text = badge,
                        style = SpentyType.Caption2.copy(fontWeight = FontWeight.Bold),
                        color = Color.White,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(if (badge == "Popular") Color(0xFFFF9500) else SpentyPrimary)
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
            plan.subtitle?.let { subtitle ->
                Text(
                    subtitle,
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Price
        Column(horizontalAlignment = Alignment.End) {
            Text(
                plan.displayPrice,
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Bold),
                color = SpentyPrimary
            )
            plan.perUnit?.let { per ->
                Text(
                    per,
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun PromoSection(
    showPromoSection: Boolean,
    onTogglePromo: () -> Unit,
    promoCode: String,
    onPromoCodeChange: (String) -> Unit,
    isValidating: Boolean,
    onValidate: () -> Unit,
    promoMessage: String,
    promoValid: Boolean?,
    isActivating: Boolean,
    onActivate: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Toggle header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onTogglePromo),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(
                Icons.Default.ConfirmationNumber,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = SpentyPrimary
            )
            Text(
                "Have a promo code?",
                style = SpentyType.Subheadline,
                color = SpentyPrimary,
                modifier = Modifier.weight(1f)
            )
            Icon(
                if (showPromoSection) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = SpentyPrimary
            )
        }

        // Expandable content
        AnimatedVisibility(
            visible = showPromoSection,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut()
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = promoCode,
                        onValueChange = onPromoCodeChange,
                        placeholder = { Text("Enter code") },
                        modifier = Modifier.weight(1f),
                        colors = SpentyStyle.inputColors(),
                        shape = SpentyStyle.inputShape,
                        singleLine = true
                    )
                    OutlinedButton(
                        onClick = onValidate,
                        enabled = promoCode.isNotBlank() && !isValidating
                    ) {
                        if (isValidating) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Apply")
                        }
                    }
                }

                if (promoMessage.isNotEmpty()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            if (promoValid == true) Icons.Default.CheckCircle else Icons.Default.Cancel,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = if (promoValid == true) SpentyPrimary else SpentyError
                        )
                        Text(
                            promoMessage,
                            style = SpentyType.Caption1,
                            color = if (promoValid == true) SpentyPrimary else SpentyError
                        )
                    }
                }

                if (promoValid == true) {
                    Button(
                        onClick = onActivate,
                        enabled = !isActivating,
                        colors = SpentyStyle.primaryButtonColors(),
                        shape = SpentyStyle.primaryButtonShape,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (isActivating) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text(
                            "Activate Promo",
                            style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold),
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DetectionNote() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(SpentyPrimary.copy(alpha = 0.05f))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Icon(
            Icons.Default.Sync,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = SpentyPrimary
        )
        Text(
            "Already have a subscription? It will be detected automatically.",
            style = SpentyType.Caption1,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun TermsSection() {
    val uriHandler = LocalUriHandler.current

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            "Recurring billing. Cancel anytime in Settings.",
            style = SpentyType.Caption2,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
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
