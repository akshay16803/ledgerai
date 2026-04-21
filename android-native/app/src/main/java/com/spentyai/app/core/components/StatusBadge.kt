package com.spentyai.app.core.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyInfo
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentySuccess
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning

enum class BadgeVariant {
    SUCCESS, ERROR, WARNING, INFO, NEUTRAL
}

@Composable
fun StatusBadge(
    text: String,
    variant: BadgeVariant = BadgeVariant.NEUTRAL,
    modifier: Modifier = Modifier
) {
    val backgroundColor = when (variant) {
        BadgeVariant.SUCCESS -> SpentySuccess.copy(alpha = 0.12f)
        BadgeVariant.ERROR -> SpentyError.copy(alpha = 0.12f)
        BadgeVariant.WARNING -> SpentyWarning.copy(alpha = 0.12f)
        BadgeVariant.INFO -> SpentyInfo.copy(alpha = 0.12f)
        BadgeVariant.NEUTRAL -> Color.Gray.copy(alpha = 0.12f)
    }

    val textColor = when (variant) {
        BadgeVariant.SUCCESS -> SpentySuccess
        BadgeVariant.ERROR -> SpentyError
        BadgeVariant.WARNING -> SpentyWarning
        BadgeVariant.INFO -> SpentyInfo
        BadgeVariant.NEUTRAL -> Color.Gray
    }

    Text(
        text = text,
        style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold),
        color = textColor,
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(backgroundColor)
            .padding(horizontal = 8.dp, vertical = 4.dp)
    )
}
