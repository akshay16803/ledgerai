package com.spentyai.app.core.components

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType

@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmText: String = "Confirm",
    cancelText: String = "Cancel",
    isDestructive: Boolean = false,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = title,
                style = SpentyType.Headline
            )
        },
        text = {
            Text(
                text = message,
                style = SpentyType.Body,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = if (isDestructive) {
                    SpentyStyle.destructiveButtonColors()
                } else {
                    SpentyStyle.primaryButtonColors()
                },
                shape = SpentyStyle.primaryButtonShape
            ) {
                Text(
                    text = confirmText,
                    style = SpentyType.Headline
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(
                    text = cancelText,
                    style = SpentyType.Headline,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        modifier = modifier,
        shape = SpentyStyle.cardShape
    )
}
