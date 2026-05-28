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

    /**
     * The feature the user just tapped. Drives the spotlight at the top of
     * the sheet (icon, title, detailed pitch) and is filtered out of the
     * "ALSO UNLOCKED WITH PREMIUM" list below.
     */
    enum class Feature(
        val icon: ImageVector,
        val title: String,
        val detail: String,
        val oneLiner: String,
    ) {
        EMAIL_SYNC(
            icon = Icons.Filled.Email,
            title = "Email Sync",
            detail = "Connect your Gmail or Outlook inbox once and SpentyAI quietly reads every bank statement, UPI receipt, subscription invoice, and shopping confirmation — turning each transaction email into a categorised entry in your books. No typing, no copy-paste, no missed expenses. Most users save 3–5 hours of bookkeeping a month.",
            oneLiner = "Auto-import expenses from Gmail and Outlook.",
        ),
        SMS_SYNC(
            icon = Icons.Filled.Sms,
            title = "SMS Sync",
            detail = "Your phone already gets a text from your bank for every UPI payment, debit-card swipe, ATM withdrawal, and credit-card charge. SpentyAI reads those SMS alerts (with permission) and books them as transactions the moment they arrive, so your dashboard always reflects reality without you opening a single app.",
            oneLiner = "Capture bank UPI/debit/credit alerts the second they arrive.",
        ),
        INVOICES(
            icon = Icons.AutoMirrored.Filled.ReceiptLong,
            title = "Invoices",
            detail = "Create GST-ready invoices in seconds — line items, HSN/SAC codes, tax slabs, payment terms, and a professional PDF — then send to customers and track who has paid and who is overdue. Perfect for freelancers, consultants, and small business owners who want billing inside the same app they use for personal money.",
            oneLiner = "Create GST-ready invoices and track payments.",
        ),
        PURCHASES(
            icon = Icons.Filled.ShoppingCart,
            title = "Purchases",
            detail = "Track every bill you receive — from your CA's retainer to your cloud hosting to your office rent — with vendor records, due dates, partial-payment tracking, and aging reports. Stop paying the same bill twice and never miss a vendor due date again.",
            oneLiner = "Track every bill end-to-end with vendor history.",
        ),
        RECONCILIATION(
            icon = Icons.Filled.CompareArrows,
            title = "Reconciliation",
            detail = "Upload your bank statement PDF and SpentyAI matches every line to a transaction in your books in one tap. Mismatches are flagged so you spot fraud, duplicate charges, or missing entries instantly. What used to take an accountant a weekend now takes you 90 seconds.",
            oneLiner = "Match bank statements in one tap to catch errors.",
        ),
        RECORDS(
            icon = Icons.Filled.Inbox,
            title = "Records",
            detail = "Every email receipt, every attached invoice, every uploaded bill is archived and instantly searchable. Filter by vendor, date, category, or amount — and download the original email or PDF anytime. Tax season becomes a five-minute task instead of a weekend hunt through Gmail.",
            oneLiner = "Searchable archive of every receipt and attachment.",
        ),
        PAST_INSIGHTS(
            icon = Icons.Filled.Insights,
            title = "Past Insights",
            detail = "See exactly where your money went last month, last quarter, last year. Monthly and yearly breakdowns by category, vendor, and account, with trends, anomalies, and year-on-year comparisons. The 'why is my balance so low this month?' question — answered on one screen.",
            oneLiner = "Monthly and yearly analytics with trend breakdowns.",
        ),
        MANDATES(
            icon = Icons.Filled.Repeat,
            title = "Mandates",
            detail = "Every UPI auto-pay, every Netflix renewal, every recurring SIP — SpentyAI sees them coming, lays them out on a calendar, and warns you if your account balance won't cover the next hit. The 'forgotten subscription' tax most Indians pay every month? Gone.",
            oneLiner = "Track UPI auto-pay and recurring charges with a forecast.",
        );
    }

    // ── Public unified entry point ──────────────────────────────────────────

    @Composable
    fun Bundle(
        monthlyPriceDisplay: String,
        lifetimePriceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onSubscribeLifetime: () -> Unit,
        onClose: () -> Unit,
        featured: Feature = Feature.INVOICES,
    ) {
        Sheet(
            featured = featured,
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
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose, featured = Feature.EMAIL_SYNC)
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
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose, featured = Feature.INVOICES)
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
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose, featured = Feature.PURCHASES)
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
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose, featured = Feature.MANDATES)
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
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose, featured = Feature.RECONCILIATION)
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
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose, featured = Feature.RECORDS)
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
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose, featured = Feature.PAST_INSIGHTS)
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
        Bundle(priceDisplay, lifetimePriceDisplay, isPurchasing, onSubscribe, onSubscribeLifetime, onClose, featured = Feature.SMS_SYNC)
    }


    // ── Internal sheet UI ───────────────────────────────────────────────────

    @Composable
    private fun Sheet(
        featured: Feature,
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

                    // Feature-specific hero icon
                    Box(
                        modifier = Modifier
                            .size(92.dp)
                            .clip(CircleShape)
                            .background(SpentyPrimary.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(featured.icon, null,
                            tint = Color.White,
                            modifier = Modifier.size(36.dp))
                    }
                    Spacer(Modifier.height(20.dp))

                    Text(
                        "Unlock ${featured.title}",
                        color = Color.White,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Plus every other premium feature on one plan.",
                        color = Color.White.copy(alpha = 0.65f),
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            // ── Feature spotlight ──
            // Detailed pitch for the specific feature the user just tapped.
            Box(
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .fillMaxWidth()
                    .background(SpentyPrimary.copy(alpha = 0.05f))
                    .border(
                        width = 0.dp,
                        color = Color.Transparent
                    )
            ) {
                Row(modifier = Modifier
                    .fillMaxWidth()
                    .height(IntrinsicSize.Min)
                ) {
                    // Left vertical accent bar — height matches the row.
                    Box(
                        modifier = Modifier
                            .width(3.dp)
                            .fillMaxHeight()
                            .background(SpentyPrimary)
                    )
                    Column(modifier = Modifier.padding(horizontal = 18.dp, vertical = 16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(CircleShape)
                                    .background(SpentyPrimary.copy(alpha = 0.12f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(featured.icon, null,
                                    tint = SpentyPrimary,
                                    modifier = Modifier.size(16.dp))
                            }
                            Spacer(Modifier.width(10.dp))
                            Text(
                                featured.title,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        Text(
                            featured.detail,
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            lineHeight = 20.sp
                        )
                    }
                }
            }

            Spacer(Modifier.height(22.dp))

            // ── "ALSO UNLOCKED" header ──
            Text(
                "ALSO UNLOCKED WITH PREMIUM",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.9.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp)
            )

            // ── "Also unlocked" list — every other premium feature with a
            //    one-line benefit. Featured feature is filtered out since it
            //    is already detailed in the spotlight above.
            val others = Feature.values().filter { it != featured }
            others.forEachIndexed { idx, f ->
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
                        Icon(f.icon, null, tint = SpentyPrimary, modifier = Modifier.size(18.dp))
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(f.title, style = SpentyType.Body.copy(fontWeight = FontWeight.SemiBold))
                        Spacer(Modifier.height(2.dp))
                        Text(f.oneLiner, style = SpentyType.Caption1,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (idx < others.size - 1) {
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
