package com.spentyai.app.features.billing

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
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
 * Premium upsell modal — presented when a free user opens a Premium-gated
 * surface (Email Sync, SMS Auto-detection). Mirror of the iOS
 * `PremiumFeatureSheet.swift`. Single CTA, ₹199/month, dark hero with
 * brand green gradient.
 *
 * Use [ModalBottomSheet] at the call site:
 * ```
 * if (showPremium) {
 *     ModalBottomSheet(onDismissRequest = { showPremium = false }) {
 *         PremiumFeatureSheet.EmailSync(
 *             onSubscribe = { vm.subscribeMonthly(activity) },
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

    @Composable
    fun EmailSync(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit
    ) {
        Sheet(
            featureIcon = Icons.Filled.Email,
            featureName = "Email Sync",
            headline = "Your inbox,\nturned into your books.",
            subhead = "We read every UPI alert, bank statement and receipt — and post the transactions for you, automatically.",
            bullets = listOf(
                Bullet(Icons.Filled.Bolt,        "Set it once, forget it",  "Connect Gmail in 30 seconds. New emails auto-parse on arrival."),
                Bullet(Icons.Filled.CheckCircle, "Smart review queue",      "Anything we're unsure about waits for you — never silently wrong."),
                Bullet(Icons.Filled.Lock,        "Read-only & encrypted",   "We never send, delete or modify mail. Tokens are bank-grade encrypted."),
            ),
            priceDisplay = priceDisplay,
            isPurchasing = isPurchasing,
            onSubscribe = onSubscribe,
            onClose = onClose,
        )
    }

    @Composable
    fun SmsSync(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit
    ) {
        Sheet(
            featureIcon = Icons.Filled.Sms,
            featureName = "Auto Transaction Detection",
            headline = "Every UPI ping\nbecomes a transaction.",
            subhead = "We watch your bank SMS, detect every debit, credit and transfer, and turn them into clean ledger entries.",
            bullets = listOf(
                Bullet(Icons.Filled.Bolt,        "Realtime SMS parsing",   "Bank, card, UPI, wallet — all the major Indian formats out of the box."),
                Bullet(Icons.Filled.CheckCircle, "Smart categorization",   "Merchant, amount, account — auto-filled. You just confirm."),
                Bullet(Icons.Filled.Lock,        "Stays on your device",   "Messages are parsed locally. We only store the transaction, never the SMS."),
            ),
            priceDisplay = priceDisplay,
            isPurchasing = isPurchasing,
            onSubscribe = onSubscribe,
            onClose = onClose,
        )
    }

    @Composable
    private fun Sheet(
        featureIcon: ImageVector,
        featureName: String,
        headline: String,
        subhead: String,
        bullets: List<Bullet>,
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
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

                    // Feature icon
                    Box(
                        modifier = Modifier
                            .size(92.dp)
                            .clip(CircleShape)
                            .background(SpentyPrimary.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(featureIcon, null,
                            tint = Color.White,
                            modifier = Modifier.size(36.dp))
                    }
                    Spacer(Modifier.height(20.dp))

                    Text(
                        headline,
                        color = Color.White,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        subhead,
                        color = Color.White.copy(alpha = 0.65f),
                        fontSize = 15.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            // ── Bullets ──
            bullets.forEachIndexed { idx, b ->
                Row(
                    verticalAlignment = Alignment.Top,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 12.dp)
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
                if (idx < bullets.size - 1) {
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 78.dp, end = 24.dp),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            // ── Price box ──
            Box(
                modifier = Modifier
                    .padding(horizontal = 24.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(SpentyPrimary.copy(alpha = 0.07f))
                    .padding(horizontal = 18.dp, vertical = 16.dp)
            ) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        priceDisplay.ifBlank { "₹199" },
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        "/month",
                        fontSize = 15.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
                    )
                    Spacer(Modifier.weight(1f))
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Cancel anytime", style = SpentyType.Caption1,
                            fontWeight = FontWeight.SemiBold)
                        Text("No hidden fees", style = SpentyType.Caption2,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            Spacer(Modifier.height(18.dp))

            // ── Primary CTA ──
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
                    Text("Unlock $featureName",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White)
                }
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
                "Auto-renews monthly until cancelled. Cancel anytime in Play Store → Subscriptions. " +
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
