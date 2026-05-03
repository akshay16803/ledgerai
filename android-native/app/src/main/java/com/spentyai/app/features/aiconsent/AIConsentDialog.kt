package com.spentyai.app.features.aiconsent

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType

/**
 * One-time AI consent dialog presented before the user's first AI request,
 * explaining exactly what data will be sent to OpenAI and offering an
 * explicit opt-in. Required by Apple App Review Guidelines 5.1.1(i) /
 * 5.1.2(i) and Google Play's User Data policy.
 *
 * Mirrors the iOS [AIConsentSheet] word-for-word so the two platforms behave
 * identically.
 *
 * @param onDismiss called when the user taps "Don't allow" or dismisses the
 *   dialog by touching outside / pressing back. Consent state is NOT changed.
 * @param onGrant called AFTER consent has been recorded. Use this to
 *   immediately proceed with the AI request that triggered the dialog (e.g.
 *   send the chat message the user just composed).
 */
@Composable
fun AIConsentDialog(
    onDismiss: () -> Unit,
    onGrant: () -> Unit
) {
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(20.dp),
        title = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(SpentyPrimary.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = SpentyPrimary,
                        modifier = Modifier.size(26.dp)
                    )
                }
                Text(
                    text = "AI Processing Consent",
                    style = SpentyType.Title3.copy(fontWeight = FontWeight.Bold),
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 480.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text(
                    text = "Before SpentyAI sends any of your data to our AI provider, please review and confirm.",
                    style = SpentyType.Subheadline,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )

                ConsentSection(
                    title = "Where your data goes",
                    body = "SpentyAI uses OpenAI (a third-party AI provider based in the USA) to power AI features. Your data is sent over a TLS-encrypted connection to api.openai.com. Per OpenAI's API terms, data sent through the API is not retained for training and is not used to improve their models."
                )

                ConsentSection(
                    title = "What is sent",
                    body = "• AI Chat — your typed question plus a summary of your accounts, transactions, categories, and invoices so the assistant can answer you.\n" +
                        "• Email and SMS parsing — the body text of transaction-related messages from accounts you have connected.\n" +
                        "• Receipt scanner — the receipt image you photograph or upload."
                )

                ConsentSection(
                    title = "What is NEVER sent",
                    body = "• Account passwords or sign-in credentials.\n" +
                        "• Full bank account numbers or card numbers.\n" +
                        "• Aadhaar, PAN, or other government identification numbers."
                )

                ConsentSection(
                    title = "You stay in control",
                    body = "You can revoke this consent at any time in Settings → Privacy → AI processing consent. Once revoked, AI features will stop sending data until you opt in again."
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    AIConsentManager.grant(context)
                    onGrant()
                    onDismiss()
                },
                colors = SpentyStyle.primaryButtonColors(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    "Allow AI features",
                    style = SpentyType.Headline,
                    color = Color.White
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(
                    "Don't allow",
                    style = SpentyType.Headline,
                    color = SpentyPrimary
                )
            }
        }
    )
}

@Composable
private fun ConsentSection(title: String, body: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            text = title,
            style = SpentyType.Headline
        )
        Text(
            text = body,
            style = SpentyType.Subheadline,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
