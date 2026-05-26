package com.spentyai.app.features.billing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.AllInclusive
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CompareArrows
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyType

/**
 * Unified premium upsell modal — presented when a free user opens ANY
 * Premium-gated surface (Email Sync, SMS, Invoices, Purchases, Mandates,
 * Reconciliation, Records, Past Insights). Mirror of iOS
 * `PremiumFeatureSheet.swift`.
 *
 * Pivot 2026-05-27:
 *  - Previously per-feature (Bullets + headline scoped to the feature).
 *  - Now shows the FULL bundle with both price options visible: monthly
 *    (com.spentyai.monthly @ ₹199/mo) AND lifetime
 *    (com.spentyai.lifetime_offer @ ₹4,999 one-time, 50% off).
 *  - The 8 per-feature builders are kept as shims that all delegate to
 *    [Bundle]. Prefer `PremiumFeatureSheet.Bundle(...)` for new callers.
 *
 * Use [ModalBottomSheet] at the call site:
 * ```
 * if (showPremium) {
 *     ModalBottomSheet(onDismissRequest = { showPremium = false }) {
 *         PremiumFeatureSheet.Bundle(
 *             monthlyPriceDisplay = vm.displayPrice(BillingRepository.PRODUCT_MONTHLY) ?: "₹199",
 *             lifetimePriceDisplay = vm.displayPrice(BillingRepository.PRODUCT_LIFETIME_OFFER) ?: "₹4,999",
 *             isPurchasing = state.isPurchasing,
 *             onSubscribe = { vm.subscribeMonthly(activity) },
 *             onSubscribeLifetime = { vm.subscribeLifetime(activity) },
 *             onClose = { showPremium = false }
 *         )
 *     }
 * }
 * ```
 */
object PremiumFeatureSheet {

    private val DarkBg = Color(0xFF0E1F12)
    private val GoldAccent = Color(0xFFD4AF37)

    data class Bullet(val icon: ImageVector, val title: String, val sub: String)

    /** Full bundle bullets — same content regardless of which feature triggered the sheet. */
    private val BundleBullets: List<Bullet> = listOf(
        Bullet(Icons.Filled.Email,                    "Email Sync",     "Auto-import expenses from Gmail and Outlook."),
        Bullet(Icons.Filled.Sms,                      "SMS Sync",       "Capture bank transaction alerts automatically."),
        Bullet(Icons.AutoMirrored.Filled.ReceiptLong, "Invoices",       "Create and send GST-ready invoices."),
        Bullet(Icons.Filled.ShoppingCart,             "Purchases",      "Track every bill end-to-end."),
        Bullet(Icons.Filled.CompareArrows,            "Reconciliation", "Match bank statements in one tap."),
        Bullet(Icons.Filled.Inbox,                    "Records",        "Full email and attachment archive."),
        Bullet(Icons.Filled.Insights,                 "Past Insights",  "Monthly and yearly analytics."),
        Bullet(Icons.Filled.Repeat,                   "Mandates",       "Track UPI auto-pay subscriptions."),
    )

    // ── Public unified entry point ──────────────────────────────────────────

    @Composable
    fun Bundle(
        monthlyPriceDisplay: String,
        lifetimePriceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onSubscribeLifetime: () -> Unit,
        onClose: () -> Unit,
    ) {
        Sheet(
            monthlyPriceDisplay = monthlyPriceDisplay,
            lifetimePriceDisplay = lifetimePriceDisplay,
            isPurchasing = isPurchasing,
            onSubscribe = onSubscribe,
            onSubscribeLifetime = onSubscribeLifetime,
            onClose = onClose,
        )
    }


    // ── Per-feature shims (back-compat) ─────────────────────────────────────
    // Every shim now produces the same bundle sheet. The old single-CTA call
    // signature is preserved so existing screens compile without changes,
    // but the new screens should switch to [Bundle].

    @Composable
    fun EmailSync(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit,
        lifetimePriceDisplay: String = "₹4,999",
        onSubscribeLifetime: () -> Unit = {},
    ) {
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose)
    }

    @Composable
    fun Invoices(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit,
        lifetimePriceDisplay: String = "₹4,999",
        onSubscribeLifetime: () -> Unit = {},
    ) {
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose)
    }

    @Composable
    fun Purchases(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit,
        lifetimePriceDisplay: String = "₹4,999",
        onSubscribeLifetime: () -> Unit = {},
    ) {
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose)
    }

    @Composable
    fun Mandates(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit,
        lifetimePriceDisplay: String = "₹4,999",
        onSubscribeLifetime: () -> Unit = {},
    ) {
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose)
    }

    @Composable
    fun Reconciliation(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit,
        lifetimePriceDisplay: String = "₹4,999",
        onSubscribeLifetime: () -> Unit = {},
    ) {
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose)
    }

    @Composable
    fun Records(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit,
        lifetimePriceDisplay: String = "₹4,999",
        onSubscribeLifetime: () -> Unit = {},
    ) {
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose)
    }

    @Composable
    fun PastInsights(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit,
        lifetimePriceDisplay: String = "₹4,999",
        onSubscribeLifetime: () -> Unit = {},
    ) {
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose)
    }

    @Composable
    fun SmsSync(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit,
        lifetimePriceDisplay: String = "₹4,999",
        onSubscribeLifetime: () -> Unit = {},
    ) {
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose)
    }


    // ── Internal sheet UI ───────────────────────────────────────────────────

    @Composable
    private fun Sheet(
        monthlyPriceDisplay: String,
        lifetimePriceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onSubscribeLifetime: () -> Unit,
        onClose: () -> Unit,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
        ) {
            // ── Hero ──
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(listOf(DarkBg, DarkBg.copy(alpha = 0.92f)))
                    )
                    .padding(horizontal = 24.dp, vertical = 28.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    // Tier badge
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .background(GoldAccent.copy(alpha = 0.14f), RoundedCornerShape(50))
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Filled.AutoAwesome, null,
                            tint = GoldAccent,
                            modifier = Modifier.size(12.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("SPENTYAI PREMIUM",
                            color = GoldAccent,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.4.sp)
                    }
                    Spacer(Modifier.height(18.dp))

                    // Bundle hero icon — sparkles (not per-feature)
                    Box(
                        modifier = Modifier
                            .size(92.dp)
                            .clip(CircleShape)
                            .background(SpentyPrimary.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Filled.AutoAwesome, null,
                            tint = Color.White,
                            modifier = Modifier.size(38.dp))
                    }
                    Spacer(Modifier.height(20.dp))

                    Text(
                        "Unlock SpentyAI Premium",
                        color = Color.White,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "One subscription. Every premium feature.",
                        color = Color.White.copy(alpha = 0.65f),
                        fontSize = 15.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            // ── Bundle bullets ──
            BundleBullets.forEachIndexed { idx, b ->
                Row(
                    verticalAlignment = Alignment.Top,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(SpentyPrimary.copy(alpha = 0.10f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(b.icon, null, tint = SpentyPrimary, modifier = Modifier.size(18.dp))
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(b.title, style = SpentyType.Body.copy(fontWeight = FontWeight.SemiBold))
                        Spacer(Modifier.height(2.dp))
                        Text(b.sub, style = SpentyType.Caption1,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (idx < BundleBullets.size - 1) {
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 78.dp, end = 24.dp),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )
                }
            }


            Spacer(Modifier.height(16.dp))

            // ── Monthly price box ──
            Box(
                modifier = Modifier
                    .padding(horizontal = 24.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(SpentyPrimary.copy(alpha = 0.07f))
                    .border(1.dp, SpentyPrimary.copy(alpha = 0.18f), RoundedCornerShape(14.dp))
                    .padding(horizontal = 18.dp, vertical = 14.dp)
            ) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        monthlyPriceDisplay.ifBlank { "₹199" },
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        "/month",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
                    )
                    Spacer(Modifier.weight(1f))
                    Text("Cancel anytime", style = SpentyType.Caption1,
                        fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(Modifier.height(10.dp))

            // ── Lifetime price box ──
            Box(
                modifier = Modifier
                    .padding(horizontal = 24.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(GoldAccent.copy(alpha = 0.08f))
                    .border(1.dp, GoldAccent.copy(alpha = 0.32f), RoundedCornerShape(14.dp))
                    .padding(horizontal = 18.dp, vertical = 14.dp)
            ) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        lifetimePriceDisplay.ifBlank { "₹4,999" },
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        "lifetime",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
                    )
                    Spacer(Modifier.weight(1f))
                    Column(horizontalAlignment = Alignment.End) {
                        Text("One-time payment", style = SpentyType.Caption1,
                            fontWeight = FontWeight.SemiBold)
                        Text("50% off", style = SpentyType.Caption2,
                            color = GoldAccent, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // ── Primary CTA — Subscribe Monthly ──
            Button(
                onClick = onSubscribe,
                enabled = !isPurchasing,
                modifier = Modifier
                    .padding(horizontal = 24.dp)
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SpentyPrimary)
            ) {
                if (isPurchasing) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
                } else {
                    Icon(Icons.Filled.AutoAwesome, null,
                        tint = Color.White, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Subscribe Monthly",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White)
                }
            }


            Spacer(Modifier.height(10.dp))

            // ── Secondary CTA — Get Lifetime ──
            OutlinedButton(
                onClick = onSubscribeLifetime,
                enabled = !isPurchasing,
                modifier = Modifier
                    .padding(horizontal = 24.dp)
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = SpentyPrimary.copy(alpha = 0.10f),
                    contentColor = SpentyPrimary
                ),
                border = androidx.compose.foundation.BorderStroke(1.5.dp, SpentyPrimary.copy(alpha = 0.35f))
            ) {
                Icon(Icons.Filled.AllInclusive, null,
                    tint = SpentyPrimary, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Get Lifetime",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = SpentyPrimary)
            }

            // ── Maybe later ──
            TextButton(
                onClick = onClose,
                modifier = Modifier
                    .padding(top = 8.dp)
                    .align(Alignment.CenterHorizontally),
                enabled = !isPurchasing,
            ) {
                Text("Maybe later",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            // ── Fine print ──
            Text(
                "Monthly auto-renews until cancelled. Lifetime is a one-time payment. " +
                "Cancel anytime in Play Store → Subscriptions. " +
                "Payment is charged to your Google account at confirmation of purchase.",
                style = SpentyType.Caption2,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .padding(horizontal = 28.dp, vertical = 14.dp)
            )

            Spacer(Modifier.height(8.dp))
        }
    }
}
