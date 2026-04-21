package com.spentyai.app.features.billing

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.EmptyStateView
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentHistoryScreen(
    orders: List<PaymentOrder>,
    onNavigateBack: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Payment History", style = SpentyType.Title3) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { padding ->
        if (orders.isEmpty()) {
            EmptyStateView(
                icon = Icons.Default.SearchOff,
                title = "No Payments Yet",
                subtitle = "Your payment history will appear here once you subscribe.",
                modifier = Modifier.padding(padding)
            )
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                item { Spacer(modifier = Modifier.height(8.dp)) }
                items(orders, key = { it.id }) { order ->
                    PaymentHistoryRow(order)
                }
                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}

@Composable
private fun PaymentHistoryRow(order: PaymentOrder) {
    val statusColor = statusColor(order.status ?: "")
    val statusIcon = statusIcon(order.status ?: "")

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Status icon circle
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(statusColor.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = statusIcon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = statusColor
            )
        }

        // Details
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = order.plan ?: "Unknown",
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = formatHistoryDate(order.createdAt),
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "\u00B7",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = (order.paymentProvider ?: "").replaceFirstChar { it.uppercase() },
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Amount + Status
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = formatHistoryAmount(order.amount, order.currency),
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold)
            )
            Text(
                text = (order.status ?: "").replaceFirstChar { it.uppercase() },
                style = SpentyType.Caption2.copy(fontWeight = FontWeight.Medium),
                color = statusColor
            )
        }
    }
}

private fun statusColor(status: String): Color {
    return when (status.lowercase()) {
        "completed", "paid" -> SpentyPrimary
        "refunded" -> Color(0xFFFF9500)
        "pending" -> SpentyWarning
        else -> Color.Gray
    }
}

private fun statusIcon(status: String): ImageVector {
    return when (status.lowercase()) {
        "completed", "paid" -> Icons.Default.Check
        "refunded" -> Icons.Default.Refresh
        "pending" -> Icons.Default.Schedule
        else -> Icons.Default.HelpOutline
    }
}

private fun formatHistoryAmount(amount: Double?, currency: String?): String {
    if (amount == null) return "--"
    val rupees = amount / 100.0
    return if (rupees % 1.0 == 0.0) {
        String.format("\u20B9%.0f", rupees)
    } else {
        String.format("\u20B9%.2f", rupees)
    }
}

private fun formatHistoryDate(dateString: String?): String {
    if (dateString.isNullOrEmpty()) return ""
    return try {
        val formats = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US),
            SimpleDateFormat("yyyy-MM-dd", Locale.US)
        )
        val display = SimpleDateFormat("dd MMM yyyy", Locale.US)
        for (fmt in formats) {
            try {
                fmt.parse(dateString)?.let { return display.format(it) }
            } catch (_: Exception) {}
        }
        if (dateString.length >= 10) dateString.substring(0, 10) else dateString
    } catch (_: Exception) {
        dateString
    }
}
