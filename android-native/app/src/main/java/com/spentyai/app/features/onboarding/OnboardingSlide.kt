package com.spentyai.app.features.onboarding

import androidx.annotation.DrawableRes
import androidx.compose.ui.graphics.Color
import com.spentyai.app.R

/**
 * Onboarding slide model — mirrors iOS's `OnboardingSlide.swift` exactly.
 *
 * iOS uses 6 slides total (5 feature slides + 1 CTA). The image asset names
 * differ from iOS (drawable resource ids vs Asset Catalog names) but the
 * titles, descriptions, accent colours and gradient stops match 1:1.
 */
data class OnboardingSlide(
    val id: Int,
    val accentColor: Color,
    val titleEn: String,
    val descriptionEn: String,
    val categoryLabel: String,
    val statPills: List<String>,
    val gradientColors: List<Color>,
    val isCtaSlide: Boolean = false,
    @DrawableRes val imageRes: Int? = null,
) {
    companion object {
        // ── Real iOS slide content (from OnboardingSlide.swift + AppStrings.swift) ──
        // We hard-code English strings here since Hindi is not yet wired on Android
        // (see PARITY_MATRIX → Localization). When localization lands these can be
        // moved to strings.xml under matching keys.
        val all: List<OnboardingSlide> = listOf(
            // 1 – Email Auto-Tracking → Royal Blue
            OnboardingSlide(
                id = 1,
                accentColor = Color(0xFF4A8EFF),
                titleEn = "Your Bills, Auto-Found",
                descriptionEn = "SpentyAI reads your Gmail, Outlook, and bank SMS to detect payments, salary credits, and EMIs. You just review and categorise them — no manual entry, no typing.",
                categoryLabel = "AUTO TRACKING",
                statPills = listOf("Zero typing", "Auto-detected"),
                gradientColors = listOf(Color(0xFF060E2E), Color(0xFF0D2B6B), Color(0xFF1565C0)),
                imageRes = R.drawable.onboarding_shot_1,
            ),
            // 2 – AI Finance Buddy → Forest Green
            OnboardingSlide(
                id = 2,
                accentColor = Color(0xFF30D158),
                titleEn = "Your AI Finance Buddy",
                descriptionEn = "Tell the AI \"I spent ₹500 on lunch\" and it records the expense for you — asking for any details it needs. Or ask \"How much did I save this month?\" and get an instant answer.",
                categoryLabel = "AI ASSISTANT",
                statPills = listOf("Instant answers", "No jargon"),
                gradientColors = listOf(Color(0xFF041A0C), Color(0xFF0A3D1E), Color(0xFF1B6B38)),
                imageRes = R.drawable.onboarding_shot_2,
            ),
            // 3 – Dashboard → Deep Violet
            OnboardingSlide(
                id = 3,
                accentColor = Color(0xFFBF5AF2),
                titleEn = "Your Money, All in One",
                descriptionEn = "See all your bank accounts, wallets, and cards together. Know your total balance, recent spends, and whether your money is actually growing.",
                categoryLabel = "DASHBOARD",
                statPills = listOf("All accounts", "Real-time"),
                gradientColors = listOf(Color(0xFF0D0026), Color(0xFF2A0A5E), Color(0xFF4527A0)),
                imageRes = R.drawable.onboarding_shot_3,
            ),
            // 4 – Cash Flow → Deep Indigo
            OnboardingSlide(
                id = 4,
                accentColor = Color(0xFF818CF8),
                titleEn = "Never Miss an EMI Again",
                descriptionEn = "SpentyAI finds your EMIs, insurance, and subscriptions from your emails and shows exactly how much is going out next month. Always stay prepared.",
                categoryLabel = "CASH FLOW",
                statPills = listOf("Never miss EMI", "Plan ahead"),
                gradientColors = listOf(Color(0xFF06082E), Color(0xFF111566), Color(0xFF1E2BA0)),
                imageRes = R.drawable.onboarding_shot_6,
            ),
            // 5 – Invoices → Ocean Blue
            OnboardingSlide(
                id = 5,
                accentColor = Color(0xFF38BDF8),
                titleEn = "Create Invoices in Seconds",
                descriptionEn = "Create GST-ready professional invoices with your business logo in seconds. Track what customers owe you and what you've paid suppliers — all in one place.",
                categoryLabel = "INVOICING",
                statPills = listOf("GST ready", "Professional"),
                gradientColors = listOf(Color(0xFF001929), Color(0xFF003456), Color(0xFF015A8C)),
                imageRes = R.drawable.onboarding_shot_7,
            ),
            // 6 – CTA → Dark Gold
            OnboardingSlide(
                id = 6,
                accentColor = Color(0xFFD4AF37),
                titleEn = "Try Free for 7 Days",
                descriptionEn = "All features fully unlocked. Subscribe today — your 7-day trial starts now and you'll only be charged after it ends. Cancel any time before that.",
                categoryLabel = "GO PREMIUM",
                statPills = listOf("7-day trial", "Cancel anytime"),
                gradientColors = listOf(Color(0xFF0A0800), Color(0xFF1C1500), Color(0xFF2E2200)),
                isCtaSlide = true,
                imageRes = null,
            ),
        )
    }
}
