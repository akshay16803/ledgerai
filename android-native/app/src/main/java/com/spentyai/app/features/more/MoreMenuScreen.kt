package com.spentyai.app.features.more

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.HelpCenter
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.spentyai.app.R
import com.spentyai.app.core.theme.SpentyAccent1
import com.spentyai.app.core.theme.SpentyAccent3
import com.spentyai.app.core.theme.SpentyInfo
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentySuccess
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning

data class MoreMenuItem(
    val titleRes: Int,
    val icon: ImageVector,
    val color: Color,
    val route: String
)

@Composable
fun MoreMenuScreen(
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val financeItems = listOf(
        MoreMenuItem(R.string.cash_flow, Icons.Default.TrendingUp, SpentyPrimary, "cash_flow"),
        MoreMenuItem(R.string.invoices, Icons.Default.Description, SpentyInfo, "invoices"),
        MoreMenuItem(R.string.purchases, Icons.Default.ShoppingCart, SpentyAccent1, "bills"),
        MoreMenuItem(R.string.categories, Icons.Default.Category, SpentyWarning, "categories")
    )

    val peopleItems = listOf(
        MoreMenuItem(R.string.customers, Icons.Default.People, SpentyInfo, "customers"),
        MoreMenuItem(R.string.vendors, Icons.Default.LocalShipping, SpentyAccent1, "vendors")
    )

    val dataItems = listOf(
        MoreMenuItem(R.string.reconciliation, Icons.Default.CheckCircle, SpentySuccess, "reconciliation"),
        MoreMenuItem(R.string.email_sync, Icons.Default.Email, SpentyInfo, "email_sync"),
        MoreMenuItem(R.string.sms_sync, Icons.Default.Sms, SpentyAccent3, "sms_sync"),
        MoreMenuItem(R.string.records, Icons.Default.Archive, MaterialTheme.colorScheme.onSurfaceVariant, "records"),
        MoreMenuItem(R.string.past_insights, Icons.Default.History, SpentyAccent3, "past_insights")
    )

    val toolsItems = listOf(
        MoreMenuItem(R.string.ai_chat, Icons.AutoMirrored.Filled.Chat, SpentyPrimary, "ai_chat"),
        MoreMenuItem(R.string.feature_requests, Icons.Default.Lightbulb, SpentyWarning, "feature_requests"),
        MoreMenuItem(R.string.support, Icons.AutoMirrored.Filled.HelpCenter, SpentyInfo, "support")
    )

    val accountItems = listOf(
        MoreMenuItem(R.string.settings, Icons.Default.Settings, MaterialTheme.colorScheme.onSurfaceVariant, "settings"),
        MoreMenuItem(R.string.help_center, Icons.AutoMirrored.Filled.HelpCenter, SpentyInfo, "help"),
        MoreMenuItem(R.string.billing, Icons.Default.CreditCard, SpentyPrimary, "billing")
    )

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        MoreMenuSection(stringResource(R.string.section_finance), financeItems, onNavigate)
        MoreMenuSection(stringResource(R.string.section_people), peopleItems, onNavigate)
        MoreMenuSection(stringResource(R.string.section_data), dataItems, onNavigate)
        MoreMenuSection(stringResource(R.string.section_tools), toolsItems, onNavigate)
        MoreMenuSection(stringResource(R.string.section_account), accountItems, onNavigate)

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun MoreMenuSection(
    title: String,
    items: List<MoreMenuItem>,
    onNavigate: (String) -> Unit
) {
    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        Text(
            text = title,
            style = SpentyType.Caption1.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold),
            color = SpentyPrimary,
            modifier = Modifier.padding(start = 4.dp, top = 16.dp, bottom = 8.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surface)
        ) {
            items.forEachIndexed { index, item ->
                MoreMenuRow(
                    title = stringResource(item.titleRes),
                    icon = item.icon,
                    iconColor = item.color,
                    onClick = { onNavigate(item.route) }
                )
                if (index < items.lastIndex) {
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 56.dp),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                    )
                }
            }
        }
    }
}

@Composable
private fun MoreMenuRow(
    title: String,
    icon: ImageVector,
    iconColor: Color,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(7.dp))
                .background(iconColor),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                modifier = Modifier.size(18.dp),
                tint = Color.White
            )
        }

        Spacer(modifier = Modifier.width(14.dp))

        Text(
            text = title,
            style = SpentyType.Body,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )

        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
