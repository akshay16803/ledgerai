package com.spentyai.app.core.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning

enum class BannerType {
    ERROR, WARNING
}

@Composable
fun ErrorBanner(
    message: String,
    isVisible: Boolean,
    type: BannerType = BannerType.ERROR,
    onDismiss: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val backgroundColor = when (type) {
        BannerType.ERROR -> SpentyError.copy(alpha = 0.12f)
        BannerType.WARNING -> SpentyWarning.copy(alpha = 0.12f)
    }
    val iconColor = when (type) {
        BannerType.ERROR -> SpentyError
        BannerType.WARNING -> SpentyWarning
    }
    val icon = when (type) {
        BannerType.ERROR -> Icons.Filled.ErrorOutline
        BannerType.WARNING -> Icons.Filled.WarningAmber
    }

    AnimatedVisibility(
        visible = isVisible,
        enter = expandVertically(),
        exit = shrinkVertically()
    ) {
        Row(
            modifier = modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(backgroundColor)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = iconColor
            )

            Spacer(modifier = Modifier.width(12.dp))

            Text(
                text = message,
                style = SpentyType.Subheadline,
                color = iconColor,
                modifier = Modifier.weight(1f)
            )

            if (onDismiss != null) {
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.Close,
                        contentDescription = "Dismiss",
                        modifier = Modifier.size(16.dp),
                        tint = iconColor
                    )
                }
            }
        }
    }
}
