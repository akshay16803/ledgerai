package com.spentyai.app.features.billing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AllInclusive
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Upgrade
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.clickable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyType
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Lifetime Offer Sheet — Android port of iOS LifetimeOfferSheet.swift.
 *
 * Two modes:
 *   showTimer = true  → non-subscriber Monthly intercept; 1-hour countdown.
 *   showTimer = false → existing subscriber upgrade; no timer, always available.
 *
 * UI is matched visually to iOS: dark forest-green header with gold accent,
 * "ONE-TIME SPECIAL OFFER" / "SUBSCRIBER EXCLUSIVE" badge, big price,
 * "LIMITED TIME OFFER · 50% OFF" pill, 4 feature rows, urgency note that
 * flips between orange countdown and gold "always available", primary CTA
 * with price right-aligned, secondary text button, "Secure payment via Google
 * Play" footer (only platform-specific copy that differs from iOS).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LifetimeOfferSheet(
    showTimer: Boolean,
    offerPrice: String?,
    isPurchasing: Boolean = false,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val manager = remember { LifetimeOfferManager.shared(context) }

    var displayTime by remember { mutableStateOf(if (showTimer) manager.formattedTimeRemaining() else "") }

    // Start the clock the first time we open the sheet (timer mode only).
    LaunchedEffect(showTimer) {
        if (showTimer) {
            manager.recordFirstShown()
            displayTime = manager.formattedTimeRemaining()
        }
    }

    fun close(after: () -> Unit) {
        scope.launch {
            sheetState.hide()
            after()
        }
    }

    // 1-second tick. Auto-decline when the window expires. Routed through the
    // same close path as the user-tap "No thanks" so the dismiss animation
    // plays in both cases (review nit #4).
    LaunchedEffect(showTimer, isPurchasing) {
        if (!showTimer || isPurchasing) return@LaunchedEffect
        while (true) {
            delay(1000L)
            if (manager.timeRemainingMs <= 0L) {
                close { onDecline() }
                break
            }
            displayTime = manager.formattedTimeRemaining()
        }
    }

    ModalBottomSheet(
        onDismissRequest = {
            // Mirror iOS interactiveDismissDisabled(isPurchasing) — block swipe-down
            // mid-purchase, otherwise treat dismiss as decline.
            if (!isPurchasing) onDecline()
        },
        sheetState = sheetState,
        dragHandle = null,
        containerColor = Color.Transparent
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.background)
        ) {
            PremiumHeader(showTimer = showTimer, offerPrice = offerPrice)
            OfferContent(
                showTimer = showTimer,
                offerPrice = offerPrice,
                displayTime = displayTime,
                isPurchasing = isPurchasing,
                onAccept = onAccept,
                onDecline = { close { onDecline() } }
            )
        }
    }
}

// MARK: - Brand palette (mirrors iOS exactly)

/** iOS accentGold = Color(red: 0.831, green: 0.686, blue: 0.216). */
private val AccentGold = Color(0xFFD4AF37)

/** iOS darkBg = Color(red: 0.055, green: 0.122, blue: 0.071). */
private val DarkBg = Color(0xFF0E1F12)

private val OrangeWarning = Color(0xFFFF9500)

@Composable
private fun PremiumHeader(showTimer: Boolean, offerPrice: String?) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(DarkBg)
            .padding(horizontal = 24.dp)
            .padding(top = 16.dp, bottom = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        // Badge
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            modifier = Modifier
                .clip(CircleShape)
                .background(AccentGold.copy(alpha = 0.14f))
                .border(1.dp, AccentGold.copy(alpha = 0.28f), CircleShape)
                .padding(horizontal = 14.dp, vertical = 7.dp)
        ) {
            Icon(
                imageVector = if (showTimer) Icons.Default.Bolt else Icons.Default.Star,
                contentDescription = null,
                tint = AccentGold,
                modifier = Modifier.size(12.dp)
            )
            Text(
                text = if (showTimer) "ONE-TIME SPECIAL OFFER" else "SUBSCRIBER EXCLUSIVE",
                style = SpentyType.Caption2.copy(
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.1.sp
                ),
                color = AccentGold
            )
        }

        // Title block
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = "Lifetime Access",
                style = SpentyType.Title1.copy(fontSize = 34.sp, fontWeight = FontWeight.Bold),
                color = Color.White
            )
            Text(
                text = "Pay once. Use SpentyAI forever.",
                style = SpentyType.Subheadline,
                color = Color.White.copy(alpha = 0.6f)
            )
        }

        // Price block
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "One-time purchase",
                style = SpentyType.Title3.copy(fontWeight = FontWeight.Medium),
                color = Color.White.copy(alpha = 0.38f)
            )
            if (offerPrice != null) {
                Text(
                    text = offerPrice,
                    style = SpentyType.Title1.copy(fontSize = 36.sp, fontWeight = FontWeight.Bold),
                    color = Color.White
                )
            } else {
                CircularProgressIndicator(
                    modifier = Modifier
                        .height(44.dp)
                        .size(28.dp),
                    color = Color.White,
                    strokeWidth = 2.5.dp
                )
            }
            Text(
                text = "LIMITED TIME OFFER  ·  50% OFF",
                style = SpentyType.Caption2.copy(
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.4.sp
                ),
                color = DarkBg,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(AccentGold)
                    .padding(horizontal = 16.dp, vertical = 7.dp)
            )
        }
    }
}

@Composable
private fun OfferContent(
    showTimer: Boolean,
    offerPrice: String?,
    displayTime: String,
    isPurchasing: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Spacer(modifier = Modifier.height(20.dp))

        OfferRow(
            icon = Icons.Default.AllInclusive,
            title = "Use forever, no renewals",
            sub = "No annual fees, ever"
        )
        FeatureDivider()
        OfferRow(
            icon = Icons.Default.Upgrade,
            title = "All future updates included",
            sub = "Everything we build, free"
        )
        FeatureDivider()
        OfferRow(
            icon = Icons.Default.Psychology,
            title = "Full AI features",
            sub = "Unlimited insights & analysis"
        )
        FeatureDivider()
        OfferRow(
            icon = Icons.Default.Shield,
            title = "Priority support",
            sub = "We're here when you need us"
        )

        Spacer(modifier = Modifier.height(20.dp))

        Box(modifier = Modifier.padding(horizontal = 20.dp)) {
            UrgencyNote(showTimer = showTimer, displayTime = displayTime)
        }

        Spacer(modifier = Modifier.height(20.dp))

        // CTA stack
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Primary CTA
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(SpentyPrimary)
                    .then(
                        if (!isPurchasing) Modifier.clickable(onClick = onAccept)
                        else Modifier
                    )
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isPurchasing) {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.5.dp,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                } else {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Text(
                            text = if (showTimer) "Get Lifetime Access" else "Upgrade to Lifetime",
                            style = SpentyType.Headline,
                            color = Color.White
                        )
                        Text(
                            text = "One-time · no subscriptions",
                            style = SpentyType.Caption1.copy(fontSize = 12.sp),
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                    if (offerPrice != null) {
                        Text(
                            text = offerPrice,
                            style = SpentyType.Headline,
                            color = Color.White
                        )
                    } else {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            // Secondary text button
            TextButton(
                onClick = onDecline,
                enabled = !isPurchasing
            ) {
                Text(
                    text = if (showTimer) "No thanks, go back" else "Maybe later",
                    style = SpentyType.Subheadline,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Footer — only platform-specific copy that differs from iOS
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                    modifier = Modifier.size(11.dp)
                )
                Text(
                    text = "Secure payment via Google Play",
                    style = SpentyType.Caption2.copy(fontSize = 11.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                    textAlign = TextAlign.Center
                )
            }
        }

        Spacer(modifier = Modifier.height(36.dp))
    }
}

@Composable
private fun UrgencyNote(showTimer: Boolean, displayTime: String) {
    if (showTimer) {
        // Orange countdown
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(OrangeWarning.copy(alpha = 0.08f))
                .border(1.dp, OrangeWarning.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Schedule,
                contentDescription = null,
                tint = OrangeWarning
            )
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = "Offer expires in",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = displayTime,
                    style = SpentyType.Title3.copy(
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    ),
                    color = OrangeWarning
                )
            }
            Text(
                text = "1 hour only",
                style = SpentyType.Caption2.copy(fontSize = 10.sp, fontWeight = FontWeight.SemiBold),
                color = OrangeWarning,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(OrangeWarning.copy(alpha = 0.12f))
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }
    } else {
        // Gold "always available" note
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(AccentGold.copy(alpha = 0.07f))
                .border(1.dp, AccentGold.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Star,
                contentDescription = null,
                tint = AccentGold,
                modifier = Modifier.size(14.dp)
            )
            Text(
                text = "Always available — exclusive rate for SpentyAI subscribers",
                style = SpentyType.Caption1,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun OfferRow(icon: ImageVector, title: String, sub: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(SpentyPrimary.copy(alpha = 0.08f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = SpentyPrimary,
                modifier = Modifier.size(18.dp)
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold))
            Text(
                sub,
                style = SpentyType.Caption1,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = null,
            tint = SpentyPrimary,
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun FeatureDivider() {
    HorizontalDivider(
        modifier = Modifier.padding(start = 60.dp, end = 20.dp),
        thickness = 0.5.dp,
        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f)
    )
}

