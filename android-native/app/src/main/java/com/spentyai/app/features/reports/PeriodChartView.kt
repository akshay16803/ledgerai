package com.spentyai.app.features.reports

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spentyai.app.core.models.ReportPeriod
import com.spentyai.app.core.theme.*
import java.text.NumberFormat
import java.util.*
import kotlin.math.abs
import kotlin.math.max

@Composable
fun PeriodChartView(
    periods: List<ReportPeriod>,
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
                "Income vs Expense",
                style = SpentyType.Headline,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(12.dp))

            if (periods.isEmpty()) {
                Text(
                    "No data for this period",
                    style = SpentyType.Footnote,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 40.dp),
                    textAlign = TextAlign.Center
                )
            } else {
                // Legend
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    LegendDot(color = SpentySuccess, label = "Income")
                    LegendDot(color = SpentyError, label = "Expense")
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Chart
                val textColor = MaterialTheme.colorScheme.onSurfaceVariant
                val borderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)

                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .pointerInput(periods) {
                            detectTapGestures { offset ->
                                val chartLeft = 50.dp.toPx()
                                val chartWidth = size.width - chartLeft - 8.dp.toPx()
                                if (periods.isEmpty()) return@detectTapGestures

                                val groupWidth = chartWidth / periods.size
                                val tappedIndex = ((offset.x - chartLeft) / groupWidth).toInt()
                                selectedIndex = if (tappedIndex in periods.indices) {
                                    if (selectedIndex == tappedIndex) -1 else tappedIndex
                                } else -1
                            }
                        }
                ) {
                    val chartLeft = 50.dp.toPx()
                    val chartTop = 0f
                    val chartBottom = size.height - 30.dp.toPx()
                    val chartHeight = chartBottom - chartTop
                    val chartWidth = size.width - chartLeft - 8.dp.toPx()

                    // Find max value for scaling
                    val maxValue = periods.maxOf {
                        max(it.income ?: 0.0, abs(it.expense ?: 0.0))
                    }.coerceAtLeast(1.0)

                    // Y-axis grid lines (4 levels)
                    val steps = 4
                    for (i in 0..steps) {
                        val y = chartBottom - (chartHeight * i / steps)
                        val value = maxValue * i / steps

                        // Grid line
                        drawLine(
                            color = borderColor,
                            start = Offset(chartLeft, y),
                            end = Offset(size.width - 8.dp.toPx(), y),
                            strokeWidth = 0.5.dp.toPx(),
                            pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(
                                floatArrayOf(8.dp.toPx(), 4.dp.toPx())
                            )
                        )

                        // Y-axis label
                        drawContext.canvas.nativeCanvas.drawText(
                            abbreviatedAmount(value),
                            chartLeft - 8.dp.toPx(),
                            y + 4.dp.toPx(),
                            android.graphics.Paint().apply {
                                color = textColor.hashCode()
                                textSize = 10.sp.toPx()
                                textAlign = android.graphics.Paint.Align.RIGHT
                            }
                        )
                    }

                    // Bars
                    val groupWidth = chartWidth / periods.size
                    val barWidth = (groupWidth * 0.35f).coerceAtMost(24.dp.toPx())
                    val barGap = 2.dp.toPx()

                    periods.forEachIndexed { index, period ->
                        val groupCenter = chartLeft + groupWidth * index + groupWidth / 2

                        // Income bar
                        val incomeHeight = ((period.income ?: 0.0) / maxValue * chartHeight).toFloat()
                        drawRoundRect(
                            color = SpentySuccess,
                            topLeft = Offset(groupCenter - barWidth - barGap / 2, chartBottom - incomeHeight),
                            size = Size(barWidth, incomeHeight.coerceAtLeast(2f)),
                            cornerRadius = androidx.compose.ui.geometry.CornerRadius(4.dp.toPx())
                        )

                        // Expense bar
                        val expenseHeight = (abs(period.expense ?: 0.0) / maxValue * chartHeight).toFloat()
                        drawRoundRect(
                            color = SpentyError,
                            topLeft = Offset(groupCenter + barGap / 2, chartBottom - expenseHeight),
                            size = Size(barWidth, expenseHeight.coerceAtLeast(2f)),
                            cornerRadius = androidx.compose.ui.geometry.CornerRadius(4.dp.toPx())
                        )

                        // X-axis label
                        drawContext.canvas.nativeCanvas.drawText(
                            shortMonth(period.period ?: ""),
                            groupCenter,
                            size.height - 4.dp.toPx(),
                            android.graphics.Paint().apply {
                                color = textColor.hashCode()
                                textSize = 10.sp.toPx()
                                textAlign = android.graphics.Paint.Align.CENTER
                            }
                        )
                    }
                }

                // Selected period detail
                if (selectedIndex >= 0 && selectedIndex < periods.size) {
                    val sel = periods[selectedIndex]
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        LegendValue(color = SpentySuccess, value = formatAmount(sel.income ?: 0.0))
                        LegendValue(color = SpentyError, value = formatAmount(abs(sel.expense ?: 0.0)))
                        Spacer(modifier = Modifier.weight(1f))
                        Text(
                            sel.period ?: "",
                            style = SpentyType.Caption1,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Canvas(modifier = Modifier.size(8.dp)) { drawCircle(color = color) }
        Text(label, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun LegendValue(color: Color, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Canvas(modifier = Modifier.size(8.dp)) { drawCircle(color = color) }
        Text(value, style = SpentyType.Caption1, color = color)
    }
}

private fun shortMonth(period: String): String {
    val parts = period.split("-")
    if (parts.size < 2) return period
    val monthNum = parts[1].toIntOrNull() ?: return period
    val symbols = arrayOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    val index = (monthNum - 1).coerceIn(0, 11)
    val year = if (parts[0].length >= 2) parts[0].takeLast(2) else parts[0]
    return "${symbols[index]} '$year"
}

private fun abbreviatedAmount(value: Double): String {
    return when {
        value >= 10_000_000 -> String.format("%.1fCr", value / 10_000_000)
        value >= 100_000 -> String.format("%.1fL", value / 100_000)
        value >= 1_000 -> String.format("%.1fK", value / 1_000)
        else -> String.format("%.0f", value)
    }
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
