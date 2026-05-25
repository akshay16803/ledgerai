package com.spentyai.app.features.billing

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CompareArrows
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material.icons.filled.Warning
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
    fun Invoices(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit
    ) {
        Sheet(
            featureIcon = Icons.AutoMirrored.Filled.ReceiptLong,
            featureName = "Invoices",
            headline = "Invoice clients,\nget paid faster.",
            subhead = "Create GST-ready invoices in seconds, share them as PDF, and track every rupee that's still owed.",
            bullets = listOf(
                Bullet(Icons.Filled.Bolt,        "One-tap invoices",          "Pick a customer, add line items, hit send — we generate the GST PDF for you."),
                Bullet(Icons.Filled.CheckCircle, "Track receivables",         "See exactly who owes you what, how old it is, and chase only the late ones."),
                Bullet(Icons.Filled.Lock,        "Record payments cleanly",   "Mark paid, capture partials, and stay reconciled with your ledger automatically."),
            ),
            priceDisplay = priceDisplay,
            isPurchasing = isPurchasing,
            onSubscribe = onSubscribe,
            onClose = onClose,
        )
    }

    @Composable
    fun Purchases(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit
    ) {
        Sheet(
            featureIcon = Icons.Filled.ShoppingCart,
            featureName = "Purchases",
            headline = "Every vendor bill,\norganised and on time.",
            subhead = "Log purchase bills, track what you owe each vendor, and never miss a payment deadline again.",
            bullets = listOf(
                Bullet(Icons.Filled.UploadFile,  "Bill in seconds",     "Snap a bill or fill the form — itemised, GST-aware and saved against the vendor."),
                Bullet(Icons.Filled.Warning,     "Aging at a glance",   "0-30, 31-60, 60+ days — see which payables are about to slip into overdue."),
                Bullet(Icons.Filled.CheckCircle, "Record payments fast", "Pay in full, split across modes, or close with a credit note — all stay tied to the bill."),
            ),
            priceDisplay = priceDisplay,
            isPurchasing = isPurchasing,
            onSubscribe = onSubscribe,
            onClose = onClose,
        )
    }

    @Composable
    fun Mandates(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit
    ) {
        Sheet(
            featureIcon = Icons.Filled.Repeat,
            featureName = "Mandates",
            headline = "Never get surprised\nby a recurring charge.",
            subhead = "Track every SIP, EMI, subscription and auto-debit in one place — and see exactly what's hitting your account next.",
            bullets = listOf(
                Bullet(Icons.Filled.CalendarMonth,  "Upcoming debits, mapped", "Know what's debiting tomorrow, this week, this month — before the bank does it."),
                Bullet(Icons.Filled.Notifications,  "No more missed renewals", "We surface auto-renew dates from your statements and SMS so nothing slips through."),
                Bullet(Icons.Filled.Insights,       "Plan your cash flow",     "Project balances forward, accounting for every committed recurring outflow."),
            ),
            priceDisplay = priceDisplay,
            isPurchasing = isPurchasing,
            onSubscribe = onSubscribe,
            onClose = onClose,
        )
    }

    @Composable
    fun Reconciliation(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit
    ) {
        Sheet(
            featureIcon = Icons.Filled.CompareArrows,
            featureName = "Reconciliation",
            headline = "Match every line\nto your statement.",
            subhead = "Upload your bank or card statement and we'll reconcile it against your ledger — finding misses, duplicates and mismatches.",
            bullets = listOf(
                Bullet(Icons.Filled.UploadFile,   "Statement upload",      "PDF, CSV or scanned — we parse every transaction and line it up against what you've logged."),
                Bullet(Icons.Filled.Warning,      "Catch the gaps",        "Missing entries, double-posts and amount mismatches surface in a clear review queue."),
                Bullet(Icons.Filled.CheckCircle,  "Close the period clean", "Approve a statement and your books are locked, audited and ready for tax season."),
            ),
            priceDisplay = priceDisplay,
            isPurchasing = isPurchasing,
            onSubscribe = onSubscribe,
            onClose = onClose,
        )
    }

    @Composable
    fun Records(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit
    ) {
        Sheet(
            featureIcon = Icons.Filled.Inbox,
            featureName = "Records",
            headline = "Every receipt,\nfiled and searchable.",
            subhead = "Every email receipt, statement and attachment we ingest is archived, indexed and one search away — forever.",
            bullets = listOf(
                Bullet(Icons.Filled.Search,  "Find any receipt fast",   "Search by vendor, amount, date or category — across years of statements and emails."),
                Bullet(Icons.Filled.Folder,  "Originals stay attached", "PDFs, images and EML files stay linked to the transaction they belong to."),
                Bullet(Icons.Filled.Lock,    "Encrypted at rest",       "Your records are AES-encrypted in our vault and only ever decrypted for you."),
            ),
            priceDisplay = priceDisplay,
            isPurchasing = isPurchasing,
            onSubscribe = onSubscribe,
            onClose = onClose,
        )
    }

    @Composable
    fun PastInsights(
        priceDisplay: String,
        isPurchasing: Boolean,
        onSubscribe: () -> Unit,
        onClose: () -> Unit
    ) {
        Sheet(
            featureIcon = Icons.Filled.Insights,
            featureName = "Past Insights",
            headline = "Your finances,\nlooked at clearly.",
            subhead = "Generate tax-ready summaries from any period — built from your real ledger, ready to hand to your CA.",
            bullets = listOf(
                Bullet(Icons.Filled.CalendarMonth, "Any period, instantly", "FY, quarter, month, custom dates — we slice the books however your CA needs."),
                Bullet(Icons.Filled.Tune,          "CA-ready exports",      "PDF + Excel out of the box, with category breakdowns, vendor totals and tax buckets."),
                Bullet(Icons.Filled.Insights,      "Spot the patterns",     "Where your money went, where it's growing, and where you're leaking — across years."),
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
