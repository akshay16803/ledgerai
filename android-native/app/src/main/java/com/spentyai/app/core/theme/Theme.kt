package com.spentyai.app.core.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.TextFieldColors
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = SpentyPrimary,
    onPrimary = Color.White,
    primaryContainer = SpentyPrimary.copy(alpha = 0.12f),
    onPrimaryContainer = SpentyPrimary,
    secondary = SpentyInfo,
    onSecondary = Color.White,
    secondaryContainer = SpentyInfo.copy(alpha = 0.12f),
    onSecondaryContainer = SpentyInfo,
    tertiary = SpentyAccent1,
    onTertiary = Color.White,
    error = SpentyError,
    onError = Color.White,
    errorContainer = SpentyError.copy(alpha = 0.12f),
    onErrorContainer = SpentyError,
    background = SpentyBgPrimaryLight,
    onBackground = SpentyTextPrimaryLight,
    surface = SpentyCardBgLight,
    onSurface = SpentyTextPrimaryLight,
    surfaceVariant = SpentyBgSecondaryLight,
    onSurfaceVariant = SpentyTextSecondaryLight,
    outline = SpentyBorderLight,
    outlineVariant = SpentyBorderLight.copy(alpha = 0.5f)
)

private val DarkColorScheme = darkColorScheme(
    primary = SpentyPrimary,
    onPrimary = Color.White,
    primaryContainer = SpentyPrimary.copy(alpha = 0.12f),
    onPrimaryContainer = SpentyPrimary,
    secondary = SpentyInfo,
    onSecondary = Color.White,
    secondaryContainer = SpentyInfo.copy(alpha = 0.12f),
    onSecondaryContainer = SpentyInfo,
    tertiary = SpentyAccent1,
    onTertiary = Color.White,
    error = SpentyError,
    onError = Color.White,
    errorContainer = SpentyError.copy(alpha = 0.12f),
    onErrorContainer = SpentyError,
    background = SpentyBgPrimaryDark,
    onBackground = SpentyTextPrimaryDark,
    surface = SpentyCardBgDark,
    onSurface = SpentyTextPrimaryDark,
    surfaceVariant = SpentyBgSecondaryDark,
    onSurfaceVariant = SpentyTextSecondaryDark,
    outline = SpentyBorderDark,
    outlineVariant = SpentyBorderDark.copy(alpha = 0.5f)
)

@Composable
fun SpentyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = SpentyTypography,
        shapes = SpentyShapes,
        content = content
    )
}

// --- Style Modifiers matching iOS ---

object SpentyStyle {

    @Composable
    fun cardColors() = CardDefaults.elevatedCardColors(
        containerColor = MaterialTheme.colorScheme.surface
    )

    @Composable
    fun cardElevation() = CardDefaults.elevatedCardElevation(
        defaultElevation = 2.dp
    )

    val cardShape = RoundedCornerShape(16.dp)

    val cardPadding = PaddingValues(16.dp)

    @Composable
    fun primaryButtonColors() = ButtonDefaults.buttonColors(
        containerColor = SpentyPrimary,
        contentColor = Color.White
    )

    val primaryButtonShape = RoundedCornerShape(12.dp)

    val primaryButtonModifier: Modifier
        get() = Modifier
            .fillMaxWidth()
            .height(50.dp)

    @Composable
    fun secondaryButtonColors() = ButtonDefaults.outlinedButtonColors(
        contentColor = SpentyPrimary
    )

    @Composable
    fun secondaryButtonBorder() = BorderStroke(1.5.dp, SpentyPrimary)

    val secondaryButtonShape = RoundedCornerShape(12.dp)

    val secondaryButtonModifier: Modifier
        get() = Modifier
            .fillMaxWidth()
            .height(50.dp)

    @Composable
    fun destructiveButtonColors() = ButtonDefaults.buttonColors(
        containerColor = SpentyError,
        contentColor = Color.White
    )

    val destructiveButtonShape = RoundedCornerShape(12.dp)

    val destructiveButtonModifier: Modifier
        get() = Modifier
            .fillMaxWidth()
            .height(50.dp)

    @Composable
    fun inputColors(): TextFieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = SpentyPrimary,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline,
        focusedLabelColor = SpentyPrimary,
        cursorColor = SpentyPrimary
    )

    val inputShape = RoundedCornerShape(12.dp)
}
