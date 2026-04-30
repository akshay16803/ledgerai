package com.spentyai.app.features.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spentyai.app.BuildConfig
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning

@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onGoogleSignInRequest: () -> Unit
) {
    val isLoading by viewModel.isLoading.collectAsState()
    val showError by viewModel.showError.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val onDevSignIn: (() -> Unit)? = if (BuildConfig.DEBUG) ({ viewModel.devSignIn() }) else null
    val onDemoSignIn: () -> Unit = { viewModel.signInWithDemo() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.weight(1f))

            // ── Logo & Branding ──
            BrandingSection()

            Spacer(modifier = Modifier.weight(1f))

            // ── Sign-in area ──
            SignInSection(
                isLoading = isLoading,
                showError = showError,
                errorMessage = errorMessage,
                onGoogleSignIn = onGoogleSignInRequest,
                onDemoSignIn = onDemoSignIn,
                onDismissError = { viewModel.dismissError() },
                onDevSignIn = onDevSignIn
            )

            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}

@Composable
private fun BrandingSection() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // App icon — green circle with dollar icon
        Box(
            modifier = Modifier
                .size(96.dp)
                .clip(CircleShape)
                .background(SpentyPrimary.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "$",
                style = SpentyType.LargeTitle.copy(
                    fontSize = 48.sp,
                    color = SpentyPrimary
                )
            )
        }

        Text(
            text = "SpentyAI",
            style = SpentyType.LargeTitle.copy(color = SpentyPrimary)
        )

        Text(
            text = "Smart spending starts here",
            style = SpentyType.Subheadline.copy(
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        )
    }
}

@Composable
private fun SignInSection(
    isLoading: Boolean,
    showError: Boolean,
    errorMessage: String,
    onGoogleSignIn: () -> Unit,
    onDemoSignIn: () -> Unit,
    onDismissError: () -> Unit,
    onDevSignIn: (() -> Unit)? = null
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Error banner
        AnimatedVisibility(
            visible = showError && errorMessage.isNotEmpty(),
            enter = slideInVertically { -it } + fadeIn(),
            exit = fadeOut()
        ) {
            ErrorBanner(
                message = errorMessage,
                onDismiss = onDismissError
            )
        }

        // Google Sign-In button
        Button(
            onClick = onGoogleSignIn,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .shadow(
                    elevation = 8.dp,
                    shape = RoundedCornerShape(14.dp),
                    ambientColor = SpentyPrimary.copy(alpha = 0.3f),
                    spotColor = SpentyPrimary.copy(alpha = 0.3f)
                ),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = SpentyPrimary,
                contentColor = Color.White
            ),
            enabled = !isLoading
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "G",
                    style = SpentyType.Title3.copy(color = Color.White)
                )
                Text(
                    text = "Sign in with Google",
                    style = SpentyType.Body.copy(
                        fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                        color = Color.White
                    )
                )
            }
        }

        // Loading indicator
        AnimatedVisibility(visible = isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = SpentyPrimary,
                strokeWidth = 2.dp
            )
        }

        // ── Demo Account ─────────────────────────────────────
        // Required for Google Play store reviewer flow. A small, low-profile
        // underlined link below the Google button. Mirrors iOS LoginView's
        // "View Demo Account" affordance.
        androidx.compose.material3.TextButton(
            onClick = onDemoSignIn,
            enabled = !isLoading
        ) {
            Text(
                text = "View Demo Account",
                style = SpentyType.Caption1.copy(
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textDecoration = TextDecoration.Underline
                )
            )
        }

        // DEBUG ONLY: dev bypass button — not shown in release builds
        if (onDevSignIn != null) {
            Button(
                onClick = onDevSignIn,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF6C757D),
                    contentColor = Color.White
                ),
                enabled = !isLoading
            ) {
                Text(
                    text = "🔧 Dev Login (Debug Only)",
                    style = SpentyType.Caption1.copy(color = Color.White)
                )
            }
        }

        // Terms & Privacy footer
        TermsFooter()
    }
}

@Composable
private fun ErrorBanner(
    message: String,
    onDismiss: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Filled.Warning,
            contentDescription = "Error",
            tint = SpentyWarning,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = message,
            style = SpentyType.Caption1.copy(
                color = MaterialTheme.colorScheme.onSurface
            ),
            modifier = Modifier.weight(1f)
        )
        IconButton(
            onClick = onDismiss,
            modifier = Modifier.size(24.dp)
        ) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = "Dismiss",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(14.dp)
            )
        }
    }
}

@Composable
private fun TermsFooter() {
    val uriHandler = LocalUriHandler.current
    val annotatedString = buildAnnotatedString {
        withStyle(
            SpanStyle(
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp
            )
        ) {
            append("By continuing you agree to our\n")
        }
        pushStringAnnotation(tag = "URL", annotation = "https://spentyai.com/terms")
        withStyle(
            SpanStyle(
                color = SpentyPrimary,
                fontSize = 12.sp,
                textDecoration = TextDecoration.Underline
            )
        ) {
            append("Terms of Service")
        }
        pop()
        withStyle(
            SpanStyle(
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp
            )
        ) {
            append(" & ")
        }
        pushStringAnnotation(tag = "URL", annotation = "https://spentyai.com/privacy")
        withStyle(
            SpanStyle(
                color = SpentyPrimary,
                fontSize = 12.sp,
                textDecoration = TextDecoration.Underline
            )
        ) {
            append("Privacy Policy")
        }
        pop()
    }

    ClickableText(
        text = annotatedString,
        modifier = Modifier.padding(top = 8.dp),
        style = MaterialTheme.typography.bodySmall.copy(textAlign = TextAlign.Center),
        onClick = { offset ->
            annotatedString.getStringAnnotations(tag = "URL", start = offset, end = offset)
                .firstOrNull()?.let { annotation ->
                    uriHandler.openUri(annotation.item)
                }
        }
    )
}
