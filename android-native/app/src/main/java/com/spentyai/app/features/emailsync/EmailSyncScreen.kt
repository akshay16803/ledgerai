package com.spentyai.app.features.emailsync

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spentyai.app.core.components.*
import com.spentyai.app.core.models.*
import com.spentyai.app.core.theme.*
import com.spentyai.app.features.aiconsent.AIConsentDialog
import com.spentyai.app.features.aiconsent.AIConsentManager
import android.app.Activity
import com.spentyai.app.features.billing.BillingRepository
import com.spentyai.app.features.billing.BillingViewModel
import com.spentyai.app.features.billing.PremiumFeatureSheet
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import java.text.NumberFormat
import java.util.*

// ================================
// EmailSyncScreen
// ================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmailSyncScreen(
    viewModel: EmailSyncViewModel,
    billingViewModel: BillingViewModel,
    onNavigateToPendingReview: () -> Unit,
    onBack: () -> Unit
) {
    // ── Premium gate (added 2026-05-13) ──────────────────────────────────────
    // Mirror of iOS EmailSyncView: Email Sync is the paid Premium tier
    // (com.spentyai.monthly @ ₹199/month). If the user isn't subscribed,
    // present the PremiumFeatureSheet on entry. Backend already 402s the
    // actual /api/email/* endpoints, but showing the upsell sheet locally
    // makes the UX feel intentional rather than a punitive error toast.
    val billingState by billingViewModel.uiState.collectAsState()
    val hasPremium = billingState.currentStatus?.isActive == true

    // Gate data load behind hasPremium — backend 402s for free users and
    // the resulting error toast races / clobbers the premium sheet.
    LaunchedEffect(hasPremium) { if (hasPremium) viewModel.loadAll() }
    val statusLoaded = billingState.currentStatus != null
    var showPremiumSheet by remember { mutableStateOf(false) }
    var initialGateChecked by remember { mutableStateOf(false) }

    // Initial gate decision — runs ONCE after the backend subscription
    // status has loaded. Waiting for `statusLoaded` avoids the flash
    // where currentStatus is briefly null on first composition and the
    // sheet would otherwise open for subscribers too.
    LaunchedEffect(statusLoaded) {
        if (!statusLoaded || initialGateChecked) return@LaunchedEffect
        initialGateChecked = true
        if (!hasPremium) showPremiumSheet = true
    }

    // Auto-close on successful purchase. Without this, after Play returns
    // success and the backend marks the user active, hasPremium flips to
    // true but the sheet stays open — the user paid yet still sees
    // "Unlock Email Sync" instead of the unlocked screen.
    LaunchedEffect(hasPremium) {
        if (hasPremium && showPremiumSheet) {
            showPremiumSheet = false
        }
    }

    // ── AI consent gate ──────────────────────────────────────────────────────
    // Required by Apple guideline 5.1.1(i) / 5.1.2(i) and Google Play's User
    // Data policy: before any data is sent to OpenAI we must show the user
    // exactly what is sent and get an explicit opt-in. Mirrors AIChatScreen.
    val context = LocalContext.current
    val activity = context as? Activity
    var showConsentSheet by remember { mutableStateOf(false) }
    var pendingAIAction by remember { mutableStateOf<(() -> Unit)?>(null) }

    /** Run [action] now if consent is granted, otherwise stash and prompt. */
    val gateAI: ((() -> Unit) -> Unit) = { action ->
        if (AIConsentManager.hasConsented(context)) {
            action()
        } else {
            pendingAIAction = action
            showConsentSheet = true
        }
    }

    if (showConsentSheet) {
        AIConsentDialog(
            onDismiss = {
                showConsentSheet = false
                pendingAIAction = null
            },
            onGrant = {
                pendingAIAction?.invoke()
                pendingAIAction = null
            }
        )
    }

    // Premium gate sheet — presented on entry for non-subscribers (mirror of
    // iOS PremiumFeatureSheet.emailSync). Both the gesture-dismiss path
    // (onDismissRequest) and the in-sheet "Maybe later" button (onClose)
    // route through `closeSheet()`. If the user closes the sheet WITHOUT
    // having become premium (the success path is handled by the auto-close
    // LaunchedEffect above), pop the screen — they shouldn't be left on a
    // screen they can't actually use.
    if (showPremiumSheet) {
        val closeSheet: () -> Unit = {
            showPremiumSheet = false
            if (!hasPremium) onBack()
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
                    // No need to mark a local flag — when Play returns
                    // success the backend flips currentStatus.isActive,
                    // the auto-close LaunchedEffect fires, and the !hasPremium
                    // check in closeSheet keeps the user on this screen.
                },
                onSubscribeLifetime = onLife@{
                    val act = activity ?: return@onLife
                    billingViewModel.purchaseLifetimeOffer(act)
                },
                onClose = closeSheet
            )
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Email Sync", style = SpentyType.Title3) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
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
            if (viewModel.isLoading && !viewModel.hasAnyAccount && viewModel.syncStatsResponse == null) {
                LoadingView(message = "Loading sync status...")
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    // Error
                    ErrorBanner(
                        message = viewModel.errorMessage ?: "",
                        isVisible = viewModel.errorMessage != null,
                        onDismiss = { viewModel.dismissError() }
                    )

                    // Success
                    SuccessBanner(
                        message = viewModel.successMessage ?: "",
                        isVisible = viewModel.successMessage != null,
                        onDismiss = { viewModel.dismissSuccess() }
                    )

                    // Overview Stats
                    OverviewStatsSection(viewModel)

                    // Gmail Section
                    GmailSection(viewModel, gateAI)

                    // Outlook Section
                    OutlookSection(viewModel, gateAI)

                    // Sync Actions
                    SyncActionsSection(viewModel, gateAI)

                    // Pending Review Card
                    PendingReviewCard(viewModel, onNavigateToPendingReview)

                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}

// ================================
// Overview Stats Section
// ================================

@Composable
private fun OverviewStatsSection(viewModel: EmailSyncViewModel) {
    val stats = viewModel.syncStatsResponse ?: return

    ElevatedCard(
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(SpentyStyle.cardPadding),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Sync Overview", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurface)

                if (viewModel.isAnySyncing) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp,
                            color = SpentyPrimary
                        )
                        Text("Syncing...", style = SpentyType.Caption1, color = SpentyPrimary)
                    }
                }
            }

            // 2x2 Stats Grid
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    MiniStatCard(
                        label = "Total Emails",
                        value = "${stats.totalSynced ?: 0}",
                        color = SpentyPrimary,
                        modifier = Modifier.weight(1f)
                    )
                    MiniStatCard(
                        label = "Transactions",
                        value = "${stats.transactionsCreated ?: 0}",
                        color = SpentySuccess,
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    MiniStatCard(
                        label = "Pending Review",
                        value = "${stats.pendingReview ?: 0}",
                        color = SpentyWarning,
                        modifier = Modifier.weight(1f)
                    )
                    MiniStatCard(
                        label = "AI Failed",
                        value = "${stats.aiFailed ?: 0}",
                        color = SpentyError,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            val processed = stats.processedByAi ?: 0
            if (processed > 0) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Filled.Memory,
                        contentDescription = null,
                        modifier = Modifier.size(11.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        "$processed processed by AI",
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun MiniStatCard(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.06f))
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(value, style = SpentyType.Headline, color = color)
        Text(label, style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// ================================
// Gmail Section
// ================================

@Composable
private fun GmailSection(viewModel: EmailSyncViewModel, gateAI: (() -> Unit) -> Unit) {
    ElevatedCard(
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(SpentyStyle.cardPadding),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Filled.Email,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = SpentyError
                )
                Text("Gmail", style = SpentyType.Title3, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.weight(1f))
                if (viewModel.gmailAccounts.isNotEmpty()) {
                    Text(
                        "${viewModel.gmailAccounts.size} connected",
                        style = SpentyType.Caption1,
                        color = SpentySuccess
                    )
                }
            }

            if (viewModel.gmailAccounts.isEmpty()) {
                Text(
                    "No Gmail accounts connected",
                    style = SpentyType.Subheadline,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                viewModel.gmailAccounts.forEach { account ->
                    AccountRow(account, "gmail", viewModel, gateAI)
                }
            }

            Button(
                onClick = { viewModel.connectGmail() },
                modifier = SpentyStyle.primaryButtonModifier,
                shape = SpentyStyle.primaryButtonShape,
                colors = SpentyStyle.primaryButtonColors(),
                enabled = !viewModel.isConnecting
            ) {
                if (viewModel.isConnecting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                } else {
                    Icon(Icons.Filled.AddCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("Connect Gmail")
            }
        }
    }
}

// ================================
// Outlook Section
// ================================

@Composable
private fun OutlookSection(viewModel: EmailSyncViewModel, gateAI: (() -> Unit) -> Unit) {
    ElevatedCard(
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(SpentyStyle.cardPadding),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Filled.Email,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = SpentyInfo
                )
                Text("Outlook", style = SpentyType.Title3, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.weight(1f))
                if (viewModel.outlookAccounts.isNotEmpty()) {
                    Text(
                        "${viewModel.outlookAccounts.size} connected",
                        style = SpentyType.Caption1,
                        color = SpentySuccess
                    )
                }
            }

            if (viewModel.outlookAccounts.isEmpty()) {
                Text(
                    "No Outlook accounts connected",
                    style = SpentyType.Subheadline,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                viewModel.outlookAccounts.forEach { account ->
                    AccountRow(account, "outlook", viewModel, gateAI)
                }
            }

            Button(
                onClick = { viewModel.connectOutlook() },
                modifier = SpentyStyle.primaryButtonModifier,
                shape = SpentyStyle.primaryButtonShape,
                colors = SpentyStyle.primaryButtonColors(),
                enabled = !viewModel.isConnecting
            ) {
                if (viewModel.isConnecting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                } else {
                    Icon(Icons.Filled.AddCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("Connect Outlook")
            }
        }
    }
}

// ================================
// Account Row
// ================================

@Composable
private fun AccountRow(
    account: EmailAccount,
    provider: String,
    viewModel: EmailSyncViewModel,
    gateAI: (() -> Unit) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    account.email ?: "Unknown",
                    style = SpentyType.Headline,
                    color = MaterialTheme.colorScheme.onSurface
                )
                if (account.connectedAt != null) {
                    Text(
                        "Connected ${account.connectedAt}",
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            when {
                account.syncing == true -> {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(12.dp),
                            strokeWidth = 1.5.dp,
                            color = SpentyPrimary
                        )
                        Text("Syncing", style = SpentyType.Caption2, color = SpentyPrimary)
                    }
                }
                account.needsReconnect == true -> {
                    StatusBadge(text = "Failed", variant = BadgeVariant.ERROR)
                }
                else -> {
                    StatusBadge(text = "Connected", variant = BadgeVariant.SUCCESS)
                }
            }
        }

        // Reconnect warning
        if (account.needsReconnect == true) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(SpentyWarning.copy(alpha = 0.08f))
                    .padding(8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Filled.Warning,
                    contentDescription = null,
                    modifier = Modifier.size(12.dp),
                    tint = SpentyWarning
                )
                Text(
                    "This account needs to be reconnected",
                    style = SpentyType.Caption1,
                    color = SpentyWarning
                )
            }
        }

        // Account sync stats
        account.stats?.let { stats ->
            AccountStatsGrid(stats)
        }

        // Action buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (account.needsReconnect == true) {
                ActionChip(
                    label = "Reconnect",
                    icon = Icons.Filled.Refresh,
                    color = SpentyWarning,
                    onClick = {
                        if (provider == "gmail") viewModel.connectGmail()
                        else viewModel.connectOutlook()
                    }
                )
            }

            ActionChip(
                label = "Sync",
                icon = Icons.Filled.Refresh,
                color = SpentyPrimary,
                onClick = { gateAI { viewModel.startSync(account) } },
                enabled = account.syncing != true && !viewModel.isSyncing
            )

            Spacer(modifier = Modifier.weight(1f))

            ActionChip(
                label = "Disconnect",
                icon = Icons.Filled.Delete,
                color = SpentyError,
                onClick = {
                    viewModel.disconnectProvider = provider
                    viewModel.disconnectEmail = account.email
                    viewModel.showDisconnectConfirm = true
                }
            )
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
    }

    // Disconnect Confirmation Dialog
    if (viewModel.showDisconnectConfirm && viewModel.disconnectEmail == account.email) {
        AlertDialog(
            onDismissRequest = { viewModel.showDisconnectConfirm = false },
            title = { Text("Disconnect Account", style = SpentyType.Headline) },
            text = { Text("Are you sure you want to disconnect this email account? Synced transactions will not be removed.", style = SpentyType.Body) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.showDisconnectConfirm = false
                    if (viewModel.disconnectProvider == "gmail") {
                        viewModel.disconnectGmail()
                    } else {
                        viewModel.disconnectOutlook()
                    }
                }) {
                    Text("Disconnect", color = SpentyError)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.showDisconnectConfirm = false }) {
                    Text("Cancel", color = SpentyPrimary)
                }
            }
        )
    }
}

@Composable
private fun AccountStatsGrid(stats: SyncStats) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        MiniStatCard(
            label = "Emails",
            value = "${stats.totalSynced ?: 0}",
            color = SpentyPrimary,
            modifier = Modifier.weight(1f)
        )
        MiniStatCard(
            label = "Transactions",
            value = "${stats.transactionsCreated ?: 0}",
            color = SpentySuccess,
            modifier = Modifier.weight(1f)
        )
        MiniStatCard(
            label = "Review",
            value = "${stats.pendingReview ?: 0}",
            color = SpentyWarning,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun ActionChip(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    onClick: () -> Unit,
    enabled: Boolean = true
) {
    Surface(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(enabled = enabled, onClick = onClick),
        color = color.copy(alpha = 0.1f),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.size(12.dp),
                tint = if (enabled) color else color.copy(alpha = 0.4f)
            )
            Text(
                label,
                style = SpentyType.Caption1,
                color = if (enabled) color else color.copy(alpha = 0.4f)
            )
        }
    }
}

// ================================
// Sync Actions Section
// ================================

@Composable
private fun SyncActionsSection(viewModel: EmailSyncViewModel, gateAI: (() -> Unit) -> Unit) {
    if (!viewModel.hasAnyAccount) return

    ElevatedCard(
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(SpentyStyle.cardPadding),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = { gateAI { viewModel.startSync() } },
                modifier = SpentyStyle.primaryButtonModifier,
                shape = SpentyStyle.primaryButtonShape,
                colors = SpentyStyle.primaryButtonColors(),
                enabled = !viewModel.isSyncing
            ) {
                if (viewModel.isSyncing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Syncing...")
                } else {
                    Icon(Icons.Filled.Sync, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Start Email Sync")
                }
            }

            val stats = viewModel.syncStatsResponse
            if (stats != null && ((stats.aiFailed ?: 0) > 0 || (stats.aiPending ?: 0) > 0)) {
                Button(
                    onClick = { gateAI { viewModel.retryPending() } },
                    modifier = SpentyStyle.primaryButtonModifier,
                    shape = SpentyStyle.primaryButtonShape,
                    colors = SpentyStyle.primaryButtonColors(),
                    enabled = !viewModel.isRetrying
                ) {
                    if (viewModel.isRetrying) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Retrying...")
                    } else {
                        Icon(Icons.Filled.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Retry Failed Emails")
                    }
                }
            }
        }
    }
}

// ================================
// Pending Review Card
// ================================

@Composable
private fun PendingReviewCard(viewModel: EmailSyncViewModel, onNavigate: () -> Unit) {
    if (viewModel.pendingReviewCount <= 0) return

    ElevatedCard(
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation(),
        onClick = onNavigate
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(SpentyStyle.cardPadding),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Filled.RemoveRedEye,
                contentDescription = null,
                modifier = Modifier.size(28.dp),
                tint = SpentyWarning
            )

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    "Pending Review",
                    style = SpentyType.Headline,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    "AI-detected transactions awaiting your approval",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Text(
                "${viewModel.pendingReviewCount}",
                style = SpentyType.AmountSmall,
                color = Color.White,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(SpentyWarning)
                    .padding(horizontal = 10.dp, vertical = 4.dp)
            )

            Icon(
                Icons.Filled.ChevronRight,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// ================================
// Success Banner
// ================================

@Composable
private fun SuccessBanner(message: String, isVisible: Boolean, onDismiss: () -> Unit) {
    AnimatedVisibility(
        visible = isVisible,
        enter = expandVertically(),
        exit = shrinkVertically()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(SpentySuccess)
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                Icons.Filled.CheckCircle,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(18.dp)
            )
            Text(
                message,
                style = SpentyType.Footnote,
                color = Color.White,
                maxLines = 3,
                modifier = Modifier.weight(1f)
            )
            IconButton(
                onClick = onDismiss,
                modifier = Modifier.size(24.dp)
            ) {
                Icon(
                    Icons.Filled.Close,
                    contentDescription = "Dismiss",
                    tint = Color.White.copy(alpha = 0.8f),
                    modifier = Modifier.size(12.dp)
                )
            }
        }
    }
}

// ================================
// PendingReviewScreen
// ================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PendingReviewScreen(
    viewModel: EmailSyncViewModel,
    onBack: () -> Unit
) {
    LaunchedEffect(Unit) { viewModel.loadPendingReview() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Pending Review", style = SpentyType.Title3) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    // Select/Deselect All menu
                    var menuExpanded by remember { mutableStateOf(false) }
                    IconButton(onClick = { menuExpanded = true }) {
                        Icon(Icons.Filled.MoreVert, contentDescription = "Options", tint = SpentyPrimary)
                    }
                    DropdownMenu(
                        expanded = menuExpanded,
                        onDismissRequest = { menuExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = {
                                Text(
                                    if (viewModel.allSelected) "Deselect All" else "Select All",
                                    style = SpentyType.Body
                                )
                            },
                            leadingIcon = {
                                Icon(
                                    if (viewModel.allSelected) Icons.Filled.Close else Icons.Filled.CheckCircle,
                                    contentDescription = null
                                )
                            },
                            onClick = {
                                if (viewModel.allSelected) viewModel.deselectAll() else viewModel.selectAll()
                                menuExpanded = false
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
                viewModel.isLoadingPending && viewModel.pendingTransactions.isEmpty() -> {
                    LoadingView(message = "Loading pending transactions...")
                }
                viewModel.pendingTransactions.isEmpty() -> {
                    EmptyStateView(
                        icon = Icons.Filled.CheckCircle,
                        title = "All Caught Up",
                        subtitle = "No transactions pending review. New AI-detected transactions will appear here."
                    )
                }
                else -> {
                    PendingTransactionList(viewModel)
                }
            }
        }
    }

    // Edit Sheet
    if (viewModel.showEditSheet) {
        EditTransactionSheet(viewModel)
    }

    // Source Sheet
    if (viewModel.showSourceSheet) {
        ViewSourceSheet(viewModel)
    }
}

// ================================
// Pending Transaction List
// ================================

@Composable
private fun PendingTransactionList(viewModel: EmailSyncViewModel) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Error
        if (viewModel.errorMessage != null) {
            item {
                ErrorBanner(
                    message = viewModel.errorMessage ?: "",
                    isVisible = true,
                    onDismiss = { viewModel.dismissError() }
                )
            }
        }

        // Success
        if (viewModel.successMessage != null) {
            item {
                SuccessBanner(
                    message = viewModel.successMessage ?: "",
                    isVisible = true,
                    onDismiss = { viewModel.dismissSuccess() }
                )
            }
        }

        // Bulk actions bar
        if (viewModel.selectedTransactionIds.isNotEmpty()) {
            item {
                BulkActionsBar(viewModel)
            }
        }

        // Transactions
        items(viewModel.pendingTransactions, key = { it.id }) { txn ->
            PendingTransactionRow(txn, viewModel)
        }
    }
}

// ================================
// Bulk Actions Bar
// ================================

@Composable
private fun BulkActionsBar(viewModel: EmailSyncViewModel) {
    ElevatedCard(
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(SpentyStyle.cardPadding),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "${viewModel.selectedTransactionIds.size} selected",
                    style = SpentyType.Headline,
                    color = MaterialTheme.colorScheme.onSurface
                )
                TextButton(onClick = { viewModel.deselectAll() }) {
                    Text("Deselect", style = SpentyType.Caption1, color = SpentyPrimary)
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = { viewModel.bulkApprove() },
                    modifier = Modifier.weight(1f).height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SpentySuccess)
                ) {
                    Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Approve All", style = SpentyType.Headline.copy(fontSize = 14.sp))
                }

                Button(
                    onClick = { viewModel.bulkReject() },
                    modifier = Modifier.weight(1f).height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SpentyError)
                ) {
                    Icon(Icons.Filled.Cancel, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Reject All", style = SpentyType.Headline.copy(fontSize = 14.sp))
                }
            }
        }
    }
}

// ================================
// Pending Transaction Row
// ================================

@Composable
private fun PendingTransactionRow(txn: PendingTransaction, viewModel: EmailSyncViewModel) {
    val isSelected = viewModel.selectedTransactionIds.contains(txn.id)

    ElevatedCard(
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(
            modifier = Modifier.padding(SpentyStyle.cardPadding),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Selection + header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { viewModel.toggleSelection(txn.id) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        if (isSelected) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                        contentDescription = if (isSelected) "Selected" else "Select",
                        tint = if (isSelected) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                        modifier = Modifier.size(22.dp)
                    )
                }

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        txn.description ?: "Unknown Transaction",
                        style = SpentyType.Headline,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (txn.date != null) {
                        Text(
                            txn.date ?: "",
                            style = SpentyType.Caption1,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                txn.amount?.let { amount ->
                    Text(
                        formatAmount(amount, txn.transactionType),
                        style = SpentyType.AmountSmall,
                        color = if (txn.transactionType == "income") SpentySuccess else MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            // Details row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                txn.accountName?.let { account ->
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Filled.AccountBalance, contentDescription = null, modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(account, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                txn.categoryName?.let { category ->
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Filled.Label, contentDescription = null, modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(category, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                txn.source?.let { source ->
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Filled.Email, contentDescription = null, modifier = Modifier.size(12.dp), tint = SpentyInfo)
                        Text(source, style = SpentyType.Caption1, color = SpentyInfo, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                if (txn.isRecurring == true) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Filled.Repeat, contentDescription = null, modifier = Modifier.size(12.dp), tint = SpentyPrimary)
                        Text(
                            txn.recurringFrequency?.replaceFirstChar { it.uppercase() } ?: "Recurring",
                            style = SpentyType.Caption1,
                            color = SpentyPrimary,
                            maxLines = 1
                        )
                    }
                }
            }

            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Approve
                Surface(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { viewModel.approveTransaction(txn.id) },
                    color = SpentySuccess,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(12.dp), tint = Color.White)
                        Text("Approve", style = SpentyType.Caption1.copy(fontWeight = FontWeight.Bold), color = Color.White)
                    }
                }

                // Reject
                Surface(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { viewModel.rejectTransaction(txn.id) },
                    color = SpentyError.copy(alpha = 0.1f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Filled.Close, contentDescription = null, modifier = Modifier.size(12.dp), tint = SpentyError)
                        Text("Reject", style = SpentyType.Caption1.copy(fontWeight = FontWeight.Bold), color = SpentyError)
                    }
                }

                // Edit
                Surface(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { viewModel.beginEditTransaction(txn) },
                    color = SpentyPrimary.copy(alpha = 0.1f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.size(12.dp), tint = SpentyPrimary)
                        Text("Edit", style = SpentyType.Caption1.copy(fontWeight = FontWeight.Bold), color = SpentyPrimary)
                    }
                }

                // Source
                if (txn.sourceId != null) {
                    Surface(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(enabled = !viewModel.isLoadingSource) { viewModel.loadSource(txn) },
                        color = Color(0xFF9C27B0).copy(alpha = 0.1f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (viewModel.isLoadingSource) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(12.dp),
                                    strokeWidth = 1.5.dp,
                                    color = Color(0xFF9C27B0)
                                )
                            } else {
                                Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.size(12.dp), tint = Color(0xFF9C27B0))
                            }
                            Text("Source", style = SpentyType.Caption1.copy(fontWeight = FontWeight.Bold), color = Color(0xFF9C27B0))
                        }
                    }
                }
            }
        }
    }
}

// ================================
// Edit Transaction Sheet
// ================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditTransactionSheet(viewModel: EmailSyncViewModel) {
    LaunchedEffect(Unit) { viewModel.loadPickerData() }

    // Inline-create dialog state (P0 #15) — same dialogs used by
    // TransactionFormScreen so PendingReview no longer forces the user out
    // of the screen when the AI suggests an unknown account / category /
    // subcategory.
    var showCreateAccount by remember { mutableStateOf(false) }
    var showCreateCategory by remember { mutableStateOf(false) }
    var showCreateSubcategory by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = { viewModel.showEditSheet = false },
        containerColor = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = { viewModel.showEditSheet = false }) {
                    Text("Cancel", color = SpentyPrimary)
                }
                Text("Edit Transaction", style = SpentyType.Headline)
                TextButton(onClick = { viewModel.saveEditedTransaction() }) {
                    Text("Save", color = SpentyPrimary, fontWeight = FontWeight.SemiBold)
                }
            }

            // Description
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Description", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurface)
                OutlinedTextField(
                    value = viewModel.editDescription,
                    onValueChange = { viewModel.editDescription = it },
                    placeholder = { Text("Transaction description") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    singleLine = true
                )
            }

            // Amount
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Amount", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurface)
                OutlinedTextField(
                    value = viewModel.editAmount,
                    onValueChange = { viewModel.editAmount = it },
                    placeholder = { Text("0.00") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    singleLine = true
                )
            }

            // Transaction Type
            ElevatedCard(
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.SwapHoriz, contentDescription = null, modifier = Modifier.size(15.dp), tint = SpentyPrimary)
                    Text("Type", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurface)
                    Spacer(modifier = Modifier.weight(1f))

                    var typeMenuExpanded by remember { mutableStateOf(false) }
                    TextButton(onClick = { typeMenuExpanded = true }) {
                        Text(
                            if (viewModel.editTransactionType == "income") "Income" else "Expense",
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                    }
                    DropdownMenu(
                        expanded = typeMenuExpanded,
                        onDismissRequest = { typeMenuExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Expense") },
                            onClick = {
                                viewModel.editTransactionType = "expense"
                                viewModel.editCategoryId = ""
                                viewModel.editSubcategoryId = ""
                                typeMenuExpanded = false
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Income") },
                            onClick = {
                                viewModel.editTransactionType = "income"
                                viewModel.editCategoryId = ""
                                viewModel.editSubcategoryId = ""
                                typeMenuExpanded = false
                            }
                        )
                    }
                }
            }

            // Account Picker
            ElevatedCard(
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.AccountBalance, contentDescription = null, modifier = Modifier.size(15.dp), tint = SpentyPrimary)
                    Text("Account", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurface)
                    Spacer(modifier = Modifier.weight(1f))

                    var accountMenuExpanded by remember { mutableStateOf(false) }
                    TextButton(onClick = { accountMenuExpanded = true }) {
                        val selectedName = viewModel.accounts.firstOrNull { it.id == viewModel.editAccountId }?.name ?: "Select"
                        Text(selectedName, color = MaterialTheme.colorScheme.onSurface, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                    }
                    IconButton(
                        onClick = { showCreateAccount = true },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            Icons.Filled.AddCircle,
                            contentDescription = "Add Account",
                            tint = SpentyPrimary.copy(alpha = 0.7f),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    DropdownMenu(
                        expanded = accountMenuExpanded,
                        onDismissRequest = { accountMenuExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Select") },
                            onClick = {
                                viewModel.editAccountId = ""
                                accountMenuExpanded = false
                            }
                        )
                        viewModel.accounts.forEach { account ->
                            DropdownMenuItem(
                                text = { Text(account.name ?: "Unnamed") },
                                onClick = {
                                    viewModel.editAccountId = account.id
                                    accountMenuExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            // Category Picker
            ElevatedCard(
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation()
            ) {
                Column {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Filled.Label, contentDescription = null, modifier = Modifier.size(15.dp), tint = SpentyPrimary)
                        Text("Category", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurface)
                        Spacer(modifier = Modifier.weight(1f))

                        var catMenuExpanded by remember { mutableStateOf(false) }
                        TextButton(onClick = { catMenuExpanded = true }) {
                            val selectedCat = viewModel.filteredCategories.firstOrNull { it.id == viewModel.editCategoryId }?.name ?: "Select"
                            Text(selectedCat, color = MaterialTheme.colorScheme.onSurface, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                        }
                        IconButton(
                            onClick = { showCreateCategory = true },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                Icons.Filled.AddCircle,
                                contentDescription = "Add Category",
                                tint = SpentyPrimary.copy(alpha = 0.7f),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        DropdownMenu(
                            expanded = catMenuExpanded,
                            onDismissRequest = { catMenuExpanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Select") },
                                onClick = {
                                    viewModel.editCategoryId = ""
                                    viewModel.editSubcategoryId = ""
                                    catMenuExpanded = false
                                }
                            )
                            viewModel.filteredCategories.forEach { cat ->
                                DropdownMenuItem(
                                    text = { Text(cat.name ?: "Unnamed") },
                                    onClick = {
                                        viewModel.editCategoryId = cat.id
                                        viewModel.editSubcategoryId = ""
                                        catMenuExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    // Subcategory
                    if (viewModel.subcategories.isNotEmpty() || viewModel.editCategoryId.isNotEmpty()) {
                        HorizontalDivider(
                            modifier = Modifier.padding(start = 40.dp),
                            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                        )
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Filled.Label, contentDescription = null, modifier = Modifier.size(15.dp), tint = SpentyPrimary.copy(alpha = 0.6f))
                            Text("Subcategory", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurface)
                            Spacer(modifier = Modifier.weight(1f))

                            var subMenuExpanded by remember { mutableStateOf(false) }
                            TextButton(onClick = { subMenuExpanded = true }) {
                                val selectedSub = viewModel.subcategories.firstOrNull { it.id == viewModel.editSubcategoryId }?.name ?: "None"
                                Text(selectedSub, color = MaterialTheme.colorScheme.onSurface, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                            }
                            if (viewModel.editCategoryId.isNotEmpty()) {
                                IconButton(
                                    onClick = { showCreateSubcategory = true },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(
                                        Icons.Filled.AddCircle,
                                        contentDescription = "Add Subcategory",
                                        tint = SpentyPrimary.copy(alpha = 0.7f),
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                            DropdownMenu(
                                expanded = subMenuExpanded,
                                onDismissRequest = { subMenuExpanded = false }
                            ) {
                                DropdownMenuItem(
                                    text = { Text("None") },
                                    onClick = {
                                        viewModel.editSubcategoryId = ""
                                        subMenuExpanded = false
                                    }
                                )
                                viewModel.subcategories.forEach { sub ->
                                    DropdownMenuItem(
                                        text = { Text(sub.name ?: "Unnamed") },
                                        onClick = {
                                            viewModel.editSubcategoryId = sub.id
                                            subMenuExpanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }

    // ============================================================
    // Inline-create dialogs — P0 #15 (mirror TransactionFormScreen)
    // ============================================================

    if (showCreateAccount) {
        CreateAccountDialog(
            apiClient = viewModel.repository.apiClient,
            onDismiss = { showCreateAccount = false },
            onCreated = { newAccount ->
                viewModel.upsertAccount(newAccount)
                viewModel.editAccountId = newAccount.id
                showCreateAccount = false
            }
        )
    }

    if (showCreateCategory) {
        CreateCategoryDialog(
            apiClient = viewModel.repository.apiClient,
            transactionType = viewModel.editTransactionType,
            onDismiss = { showCreateCategory = false },
            onCreated = { newCat ->
                viewModel.upsertCategory(newCat)
                viewModel.editCategoryId = newCat.id
                viewModel.editSubcategoryId = ""
                showCreateCategory = false
            }
        )
    }

    if (showCreateSubcategory && viewModel.editCategoryId.isNotEmpty()) {
        val parentName = viewModel.categories.firstOrNull { it.id == viewModel.editCategoryId }?.name ?: ""
        CreateSubcategoryDialog(
            apiClient = viewModel.repository.apiClient,
            parentCategoryId = viewModel.editCategoryId,
            parentCategoryName = parentName,
            transactionType = viewModel.editTransactionType,
            onDismiss = { showCreateSubcategory = false },
            onCreated = { newSub ->
                viewModel.upsertSubcategory(parentId = viewModel.editCategoryId, sub = newSub)
                viewModel.editSubcategoryId = newSub.id
                showCreateSubcategory = false
            }
        )
    }
}

// ================================
// View Source Sheet
// ================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ViewSourceSheet(viewModel: EmailSyncViewModel) {
    ModalBottomSheet(
        onDismissRequest = { viewModel.showSourceSheet = false },
        containerColor = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    if (viewModel.sourceContent?.type == "sms") "Original SMS" else "Original Email",
                    style = SpentyType.Headline
                )
                TextButton(onClick = { viewModel.showSourceSheet = false }) {
                    Text("Done", color = SpentyPrimary)
                }
            }

            val source = viewModel.sourceContent
            if (source != null) {
                if (source.type == "email") {
                    // Email content
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("SUBJECT", style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(source.subject ?: "(no subject)", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurface)
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("FROM", style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(source.from ?: "-", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurface)
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("DATE", style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(source.date ?: "-", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurface)
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("BODY", style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            source.body ?: "(empty)",
                            style = SpentyType.Subheadline,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
                                .padding(12.dp)
                        )
                    }
                } else {
                    // SMS content
                    Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("SENDER", style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(source.sender ?: "-", style = SpentyType.Headline, color = MaterialTheme.colorScheme.onSurface)
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("DATE", style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(source.date ?: "-", style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurface)
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("MESSAGE", style = SpentyType.Caption2, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            source.body ?: "(empty)",
                            style = SpentyType.Subheadline,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
                                .padding(12.dp)
                        )
                    }
                }
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(40.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = SpentyPrimary)
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

// ================================
// Helpers
// ================================

private fun formatAmount(amount: Double, type: String?): String {
    val fmt = NumberFormat.getNumberInstance(Locale("en", "IN"))
    fmt.minimumFractionDigits = 2
    fmt.maximumFractionDigits = 2
    val formatted = fmt.format(kotlin.math.abs(amount))
    return if (type == "income") "+$formatted" else formatted
}
