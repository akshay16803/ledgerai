package com.spentyai.app.core.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.spentyai.app.R

// Inter via Google Fonts downloadable font provider
val InterFontFamily = FontFamily(Font(R.font.inter_variable))

// Fallback aliases kept for compatibility
val RoundedFontFamily = InterFontFamily
val MonospaceFontFamily = FontFamily.Monospace

// Custom text styles matching iOS exactly
object SpentyType {
    val LargeTitle = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 34.sp,
        lineHeight = 41.sp
    )

    val Title1 = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 34.sp
    )

    val Title2 = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 22.sp,
        lineHeight = 28.sp
    )

    val Title3 = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        lineHeight = 25.sp
    )

    val Headline = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 17.sp,
        lineHeight = 22.sp
    )

    val Body = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 17.sp,
        lineHeight = 22.sp
    )

    val Callout = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 21.sp
    )

    val Subheadline = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 20.sp
    )

    val Footnote = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 18.sp
    )

    val Caption1 = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp
    )

    val Caption2 = TextStyle(
        fontFamily = InterFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 11.sp,
        lineHeight = 13.sp
    )

    val AmountLarge = TextStyle(
        fontFamily = MonospaceFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 36.sp,
        lineHeight = 43.sp
    )

    val AmountMedium = TextStyle(
        fontFamily = MonospaceFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 29.sp
    )

    val AmountSmall = TextStyle(
        fontFamily = MonospaceFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 17.sp,
        lineHeight = 22.sp
    )
}

val SpentyTypography = Typography(
    displayLarge = SpentyType.LargeTitle,
    displayMedium = SpentyType.Title1,
    displaySmall = SpentyType.Title2,
    headlineLarge = SpentyType.Title2,
    headlineMedium = SpentyType.Title3,
    headlineSmall = SpentyType.Headline,
    titleLarge = SpentyType.Title1,
    titleMedium = SpentyType.Title2,
    titleSmall = SpentyType.Title3,
    bodyLarge = SpentyType.Body,
    bodyMedium = SpentyType.Callout,
    bodySmall = SpentyType.Subheadline,
    labelLarge = SpentyType.Headline,
    labelMedium = SpentyType.Footnote,
    labelSmall = SpentyType.Caption1
)
