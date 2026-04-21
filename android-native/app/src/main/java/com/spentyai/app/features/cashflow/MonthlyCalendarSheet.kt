package com.spentyai.app.features.cashflow

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spentyai.app.core.components.CurrencyText
import com.spentyai.app.core.components.CurrencySize
import com.spentyai.app.core.theme.*
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.abs

enum class CalendarEntryType(val color: Color, val icon: ImageVector) {
    INCOME(SpentySuccess, Icons.Filled.ArrowCircleDown),
    EXPENSE(SpentyAccent1, Icons.Filled.ArrowCircleUp),
    MANDATE(SpentyAccent1, Icons.Filled.Description),
    EMI(SpentyAccent3, Icons.Filled.CreditCard),
    OD_INTEREST(SpentyError, Icons.Filled.Percent)
}

data class CalendarDayEntry(
    val id: String = java.util.UUID.randomUUID().toString(),
    val label: String,
    val amount: Double,
    val type: CalendarEntryType,
    val isEstimatedRate: Boolean = false,
    val originalCurrencyLabel: String? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MonthlyCalendarSheet(
    viewModel: CashFlowViewModel,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var selectedDay by remember { mutableIntStateOf(-1) }

    val cal = remember { Calendar.getInstance().apply { add(Calendar.MONTH, 1) } }
    val nextMonthName = remember { SimpleDateFormat("MMMM yyyy", Locale.getDefault()).format(cal.time) }
    val daysInMonth = remember { cal.getActualMaximum(Calendar.DAY_OF_MONTH) }
    val firstWeekday = remember {
        val c = Calendar.getInstance()
        c.set(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), 1)
        (c.get(Calendar.DAY_OF_WEEK) + 5) % 7 // Mon=0
    }

    val dayEntries = remember(viewModel.projection) {
        buildDayEntries(viewModel, daysInMonth)
    }
    val unscheduledEntries = remember(viewModel.projection) {
        buildUnscheduledEntries(viewModel)
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
        ) {
            // Title
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(nextMonthName, style = SpentyType.Headline)
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Filled.Close, contentDescription = "Close", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Summary bar
            SummaryBar(viewModel)

            Spacer(modifier = Modifier.height(12.dp))

            // Legend
            CalendarLegend()

            Spacer(modifier = Modifier.height(12.dp))

            // Calendar grid
            CalendarGrid(
                daysInMonth = daysInMonth,
                firstWeekday = firstWeekday,
                dayEntries = dayEntries,
                selectedDay = selectedDay,
                onDaySelected = { day -> selectedDay = if (selectedDay == day) -1 else day }
            )

            // Day detail
            if (selectedDay > 0) {
                val entries = dayEntries[selectedDay]
                if (entries != null && entries.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(16.dp))
                    DayDetail(day = selectedDay, monthName = nextMonthName, entries = entries)
                }
            }

            // Unscheduled items
            if (unscheduledEntries.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                UnscheduledSection(entries = unscheduledEntries)
            }

            Spacer(modifier = Modifier.height(40.dp))
        }
    }
}

@Composable
private fun SummaryBar(viewModel: CashFlowViewModel) {
    val totalIncome = viewModel.monthlyIncome
    val totalOutflow = viewModel.monthlyExpense + viewModel.monthlyMandates + viewModel.monthlyEMI + viewModel.monthlyODInterest
    val net = totalIncome - totalOutflow

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        MiniSummaryCard("Inflow", shortCurrencyCalendar(totalIncome), SpentySuccess, Modifier.weight(1f))
        MiniSummaryCard("Outflow", shortCurrencyCalendar(totalOutflow), SpentyAccent1, Modifier.weight(1f))
        MiniSummaryCard("Net", shortCurrencyCalendar(net), if (net >= 0) SpentySuccess else SpentyError, Modifier.weight(1f))
    }
}

@Composable
private fun MiniSummaryCard(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(label, style = SpentyType.Caption1.copy(fontSize = 11.sp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            value,
            style = SpentyType.Caption1.copy(fontWeight = FontWeight.Bold),
            color = color,
            maxLines = 1
        )
    }
}

@Composable
private fun CalendarLegend() {
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        LegendDot(SpentySuccess, "Income")
        LegendDot(SpentyAccent1, "Expense")
        LegendDot(SpentyAccent3, "EMI")
        LegendDot(SpentyError, "OD Int.")
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(color))
        Text(label, style = SpentyType.Caption1.copy(fontSize = 11.sp), color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun CalendarGrid(
    daysInMonth: Int,
    firstWeekday: Int,
    dayEntries: Map<Int, List<CalendarDayEntry>>,
    selectedDay: Int,
    onDaySelected: (Int) -> Unit
) {
    val weekdays = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

    ElevatedCard(
        shape = RoundedCornerShape(16.dp),
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Weekday headers
            Row {
                weekdays.forEach { day ->
                    Box(
                        modifier = Modifier.weight(1f).height(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            day,
                            style = SpentyType.Caption1.copy(fontSize = 11.sp, fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Day cells
            val totalCells = firstWeekday + daysInMonth
            val rows = (totalCells + 6) / 7

            for (row in 0 until rows) {
                Row {
                    for (col in 0 until 7) {
                        val index = row * 7 + col
                        if (index < firstWeekday || index >= firstWeekday + daysInMonth) {
                            Spacer(modifier = Modifier.weight(1f).height(64.dp))
                        } else {
                            val day = index - firstWeekday + 1
                            val entries = dayEntries[day] ?: emptyList()
                            val isSelected = selectedDay == day
                            val hasItems = entries.isNotEmpty()
                            val dayIncome = entries.filter { it.type == CalendarEntryType.INCOME }.sumOf { it.amount }
                            val dayExpense = entries.filter { it.type != CalendarEntryType.INCOME }.sumOf { it.amount }

                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(64.dp)
                                    .padding(1.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(
                                        when {
                                            isSelected -> SpentyPrimary
                                            hasItems -> MaterialTheme.colorScheme.surfaceVariant
                                            else -> Color.Transparent
                                        }
                                    )
                                    .clickable { onDaySelected(day) },
                                contentAlignment = Alignment.TopCenter
                            ) {
                                Column(
                                    modifier = Modifier.padding(top = 6.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        "$day",
                                        style = SpentyType.Caption1.copy(fontWeight = FontWeight.Bold),
                                        color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface
                                    )
                                    if (hasItems) {
                                        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                                            entries.map { it.type }.distinct().forEach { type ->
                                                Box(modifier = Modifier.size(5.dp).clip(CircleShape).background(type.color))
                                            }
                                        }
                                        if (dayIncome > 0) {
                                            Text(
                                                "+${compactCurrency(dayIncome)}",
                                                style = SpentyType.Caption1.copy(
                                                    fontSize = 8.sp,
                                                    fontWeight = FontWeight.SemiBold,
                                                    fontFamily = FontFamily.Monospace
                                                ),
                                                color = if (isSelected) Color.White.copy(alpha = 0.9f) else SpentySuccess,
                                                maxLines = 1
                                            )
                                        }
                                        if (dayExpense > 0) {
                                            Text(
                                                "-${compactCurrency(dayExpense)}",
                                                style = SpentyType.Caption1.copy(
                                                    fontSize = 8.sp,
                                                    fontWeight = FontWeight.SemiBold,
                                                    fontFamily = FontFamily.Monospace
                                                ),
                                                color = if (isSelected) Color.White.copy(alpha = 0.9f) else SpentyAccent1,
                                                maxLines = 1
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DayDetail(day: Int, monthName: String, entries: List<CalendarDayEntry>) {
    ElevatedCard(
        shape = RoundedCornerShape(16.dp),
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Day $day - $monthName",
                style = SpentyType.Headline,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(12.dp))
            entries.forEachIndexed { index, entry ->
                CalendarEntryRow(entry)
                if (index < entries.lastIndex) {
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 4.dp),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )
                }
            }
        }
    }
}

@Composable
private fun CalendarEntryRow(entry: CalendarDayEntry) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(entry.type.color.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = entry.type.icon,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = entry.type.color
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                entry.label,
                style = SpentyType.Subheadline,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            val typeLabel = when (entry.type) {
                CalendarEntryType.INCOME -> "Recurring Income"
                CalendarEntryType.EXPENSE -> "Recurring Expense"
                CalendarEntryType.MANDATE -> "Mandate"
                CalendarEntryType.EMI -> "Loan EMI"
                CalendarEntryType.OD_INTEREST -> "OD Interest"
            }
            Text(typeLabel, style = SpentyType.Caption1.copy(fontSize = 11.sp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Column(horizontalAlignment = Alignment.End) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (entry.isEstimatedRate) {
                    Text("~", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                CurrencyText(
                    amount = entry.amount,
                    size = CurrencySize.SMALL,
                    overrideColor = if (entry.type == CalendarEntryType.INCOME) SpentySuccess else SpentyAccent1
                )
            }
            entry.originalCurrencyLabel?.let { label ->
                Text("$label est.", style = SpentyType.Caption1.copy(fontSize = 9.sp), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun UnscheduledSection(entries: List<CalendarDayEntry>) {
    ElevatedCard(
        shape = RoundedCornerShape(16.dp),
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.EventBusy, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("No Fixed Date", style = SpentyType.Headline)
                }
                Text("${entries.size} items", style = SpentyType.Caption1.copy(fontSize = 11.sp), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(modifier = Modifier.height(12.dp))
            entries.forEachIndexed { index, entry ->
                CalendarEntryRow(entry)
                if (index < entries.lastIndex) {
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 2.dp),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )
                }
            }
        }
    }
}

// Data aggregation helpers
private fun buildDayEntries(viewModel: CashFlowViewModel, daysInMonth: Int): Map<Int, List<CalendarDayEntry>> {
    val result = mutableMapOf<Int, MutableList<CalendarDayEntry>>()

    viewModel.incomeItems.forEach { item ->
        val day = item.recurrenceDate
        if (day != null && day in 1..daysInMonth) {
            result.getOrPut(day) { mutableListOf() }.add(
                CalendarDayEntry(label = item.description ?: "Income", amount = item.monthlyAmount ?: item.amount ?: 0.0, type = CalendarEntryType.INCOME)
            )
        }
    }
    viewModel.expenseItems.forEach { item ->
        val day = item.recurrenceDate
        if (day != null && day in 1..daysInMonth) {
            result.getOrPut(day) { mutableListOf() }.add(
                CalendarDayEntry(label = item.description ?: "Expense", amount = item.monthlyAmount ?: item.amount ?: 0.0, type = CalendarEntryType.EXPENSE)
            )
        }
    }
    viewModel.mandateItemsList.forEach { item ->
        val day = item.dayOfMonth
        if (day != null && day in 1..daysInMonth) {
            val foreignLabel = if (item.isForeignCurrency) "${item.currency ?: ""} ${formatCurrencyCalendar(item.originalAmount ?: 0.0)}" else null
            result.getOrPut(day) { mutableListOf() }.add(
                CalendarDayEntry(
                    label = item.merchant ?: "Mandate",
                    amount = item.monthlyEquivalent ?: item.amount ?: 0.0,
                    type = CalendarEntryType.MANDATE,
                    isEstimatedRate = item.isEstimatedRate == true,
                    originalCurrencyLabel = foreignLabel
                )
            )
        }
    }
    viewModel.emiItemsList.forEach { item ->
        val day = item.emiDay
        if (day != null && day in 1..daysInMonth) {
            result.getOrPut(day) { mutableListOf() }.add(
                CalendarDayEntry(label = item.accountName ?: "EMI", amount = item.emiAmount ?: 0.0, type = CalendarEntryType.EMI)
            )
        }
    }
    viewModel.odInterestItemsList.forEach { item ->
        val day = item.interestChargeDay
        if (day != null && day in 1..daysInMonth) {
            result.getOrPut(day) { mutableListOf() }.add(
                CalendarDayEntry(label = item.accountName ?: "OD Interest", amount = item.monthlyInterest ?: 0.0, type = CalendarEntryType.OD_INTEREST)
            )
        }
    }

    return result
}

private fun buildUnscheduledEntries(viewModel: CashFlowViewModel): List<CalendarDayEntry> {
    val result = mutableListOf<CalendarDayEntry>()
    viewModel.incomeItems.filter { it.recurrenceDate == null }.forEach {
        result.add(CalendarDayEntry(label = it.description ?: "Income", amount = it.monthlyAmount ?: it.amount ?: 0.0, type = CalendarEntryType.INCOME))
    }
    viewModel.expenseItems.filter { it.recurrenceDate == null }.forEach {
        result.add(CalendarDayEntry(label = it.description ?: "Expense", amount = it.monthlyAmount ?: it.amount ?: 0.0, type = CalendarEntryType.EXPENSE))
    }
    viewModel.mandateItemsList.filter { it.dayOfMonth == null }.forEach {
        val foreignLabel = if (it.isForeignCurrency) "${it.currency ?: ""} ${formatCurrencyCalendar(it.originalAmount ?: 0.0)}" else null
        result.add(CalendarDayEntry(label = it.merchant ?: "Mandate", amount = it.monthlyEquivalent ?: it.amount ?: 0.0, type = CalendarEntryType.MANDATE, isEstimatedRate = it.isEstimatedRate == true, originalCurrencyLabel = foreignLabel))
    }
    viewModel.emiItemsList.filter { it.emiDay == null }.forEach {
        result.add(CalendarDayEntry(label = it.accountName ?: "EMI", amount = it.emiAmount ?: 0.0, type = CalendarEntryType.EMI))
    }
    viewModel.odInterestItemsList.filter { it.interestChargeDay == null }.forEach {
        result.add(CalendarDayEntry(label = it.accountName ?: "OD Interest", amount = it.monthlyInterest ?: 0.0, type = CalendarEntryType.OD_INTEREST))
    }
    return result
}

private fun formatCurrencyCalendar(value: Double): String {
    val format = NumberFormat.getCurrencyInstance(Locale("en", "IN"))
    format.maximumFractionDigits = 0
    format.minimumFractionDigits = 0
    return format.format(value)
}

private fun shortCurrencyCalendar(value: Double): String {
    val absVal = abs(value)
    val sign = if (value < 0) "-" else ""
    return when {
        absVal >= 10_000_000 -> String.format("%s%.1fCr", sign, absVal / 10_000_000)
        absVal >= 100_000 -> String.format("%s%.1fL", sign, absVal / 100_000)
        absVal >= 1_000 -> String.format("%s%.1fK", sign, absVal / 1_000)
        else -> String.format("%s%.0f", sign, absVal)
    }
}

private fun compactCurrency(value: Double): String {
    return when {
        value >= 10_000_000 -> String.format("%.0fCr", value / 10_000_000)
        value >= 100_000 -> String.format("%.0fL", value / 100_000)
        value >= 1_000 -> String.format("%.0fK", value / 1_000)
        else -> String.format("%.0f", value)
    }
}
