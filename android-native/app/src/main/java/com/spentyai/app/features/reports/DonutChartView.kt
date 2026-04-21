package com.spentyai.app.features.reports

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.models.ReportCategory
import com.spentyai.app.core.theme.*
import java.text.NumberFormat
import java.util.*
import kotlin.math.abs

private val PALETTE = listOf(
    Color(0xFF3A5C4A),
    Color(0xFFC26D5C),
    Color(0xFF4A6E7D),
    Color(0xFFC28C3C),
    Color(0xFF7B5EA7),
    Color(0xFF5A9E6F),
    Color(0xFFD4856A),
    Color(0xFF6A8FA0),
    Color(0xFFB5A24C),
    Color(0xFF9A6B8C)
)

@Composable
fun DonutChartView(
    categories: List<ReportCategory>,
    totalAmount: Double,
    modifier: Modifier = Modifier
) {
    var selectedIndex by remember { mutableIntStateOf(-1) }

    ElevatedCard(
        modifier = modifier.fillMaxWidth(),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(SpentyStyle.cardPadding)) {
            Text(
                "By Category",
                style = SpentyType.Headline,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(16.dp))

            if (categories.isEmpty()) {
                Text(
                    "No category data",
                    style = SpentyType.Footnote,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 40.dp),
                    textAlign = TextAlign.Center
                )
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    // Donut chart
                    Box(
                        modifier = Modifier.size(150.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Canvas(
                            modifier = Modifier
                                .fillMaxSize()
                                .clickable { selectedIndex = -1 }
                        ) {
                            val strokeWidth = 28.dp.toPx()
                            val padding = strokeWidth / 2
                            val chartSize = Size(size.width - strokeWidth, size.height - strokeWidth)
                            val topLeft = Offset(padding, padding)

                            if (totalAmount <= 0) return@Canvas

                            var startAngle = -90f
                            categories.forEachIndexed { index, category ->
                                val amount = abs(category.amount ?: 0.0)
                                val sweepAngle = (amount / totalAmount * 360f).toFloat()
                                val alpha = if (selectedIndex == -1 || selectedIndex == index) 1f else 0.4f
                                val color = PALETTE[index % PALETTE.size].copy(alpha = alpha)

                                drawArc(
                                    color = color,
                                    startAngle = startAngle,
                                    sweepAngle = sweepAngle.coerceAtLeast(1f),
                                    useCenter = false,
                                    topLeft = topLeft,
                                    size = chartSize,
                                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                                )

                                startAngle += sweepAngle
                            }
                        }

                        // Center label
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            if (selectedIndex >= 0 && selectedIndex < categories.size) {
                                val sel = categories[selectedIndex]
                                Text(
                                    sel.name ?: "",
                                    style = SpentyType.Caption2,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    formatAmount(abs(sel.amount ?: 0.0)),
                                    style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold),
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            } else {
                                Text(
                                    "Total",
                                    style = SpentyType.Caption2,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    formatAmount(totalAmount),
                                    style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold),
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }

                    // Legend
                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        categories.take(6).forEachIndexed { index, category ->
                            LegendRow(
                                name = category.name ?: "Unknown",
                                color = PALETTE[index % PALETTE.size],
                                percentage = percentString(category, totalAmount),
                                onClick = {
                                    selectedIndex = if (selectedIndex == index) -1 else index
                                }
                            )
                        }
                        if (categories.size > 6) {
                            Text(
                                "+${categories.size - 6} more",
                                style = SpentyType.Caption2,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LegendRow(
    name: String,
    color: Color,
    percentage: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Canvas(modifier = Modifier.size(8.dp)) {
            drawCircle(color = color)
        }
        Text(
            text = name,
            style = SpentyType.Caption1,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        Text(
            text = percentage,
            style = SpentyType.Caption2,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

private fun percentString(category: ReportCategory, totalAmount: Double): String {
    category.percentage?.let { return String.format("%.0f%%", it) }
    if (totalAmount <= 0) return "0%"
    val pct = abs(category.amount ?: 0.0) / totalAmount * 100
    return String.format("%.0f%%", pct)
}

private fun formatAmount(value: Double): String {
    return try {
        val format = NumberFormat.getCurrencyInstance(Locale.US)
        format.currency = Currency.getInstance("INR")
        format.maximumFractionDigits = 0
        format.format(value)
    } catch (e: Exception) {
        String.format("%.0f", value)
    }
}
