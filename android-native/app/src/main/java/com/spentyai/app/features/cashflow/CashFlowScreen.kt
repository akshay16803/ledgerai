package com.spentyai.app.features.cashflow

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spentyai.app.core.components.*
import com.spentyai.app.core.models.*
import com.spentyai.app.core.theme.*
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.abs

enum class CashFlowDrillDown(val title: String) {
    INCOME("Monthly Income Items"),
    EXPENSE("Monthly Expense Items"),
    OD_INTEREST("OD Interest Breakdown"),
    EMI("EMI Schedule")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CashFlowScreen(viewModel: CashFlowViewModel, hasPremium: Boolean = true) {
    var activeDrillDown by remember { mutableStateOf<CashFlowDrillDown?>(null) }
    var showCalendar by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.loadAll()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Cash Flow", style = SpentyType.LargeTitle) }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            if (viewModel.isLoading && !viewModel.hasData) {
                LoadingView(message = "Loading cash flow...")
            } else {
                val scrollState = rememberScrollState()
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(scrollState)
                        .padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    // Error banner
                    if (viewModel.showError) {
                        ErrorBanner(
                            message = viewModel.errorMessage,
                            isVisible = true,
                            onDismiss = { viewModel.dismissError() },
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                    }

                    // Stats grid
                    StatsGrid(viewModel = viewModel, onDrillDown = { activeDrillDown = it })

                    // Next month button
                    if (viewModel.hasData) {
                        NextMonthButton(onClick = { showCalendar = true })
                    }

                    // Chart
                    CashFlowChartSection(projectionMonths = viewModel.projectionMonths)

                    // Recurring list
                    RecurringListSection(recurringItems = viewModel.recurringItems)

                    // Monthly breakdown
                    if (viewModel.projectionMonths.isNotEmpty()) {
                        MonthlyBreakdownTable(months = viewModel.projectionMonths)
                    }

                    Spacer(modifier = Modifier.height(40.dp))
                }
            }
        }
    }

    // Drill-down bottom sheet
    activeDrillDown?.let { drillDown ->
        CashFlowDrillDownSheet(
            drillDown = drillDown,
            viewModel = viewModel,
            hasPremium = hasPremium,
            onDismiss = { activeDrillDown = null }
        )
    }

    // Calendar sheet
    if (showCalendar) {
        MonthlyCalendarSheet(
            viewModel = viewModel,
            onDismiss = { showCalendar = false }
        )
    }
}

@Composable
private fun StatsGrid(viewModel: CashFlowViewModel, onDrillDown: (CashFlowDrillDown) -> Unit) {
    Column(
        modifier = Modifier.padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(
                title = "Monthly Income",
                value = formatCurrencyShort(viewModel.monthlyIncome),
                icon = Icons.Filled.ArrowCircleDown,
                iconColor = SpentySuccess,
                modifier = Modifier.weight(1f),
                onClick = { onDrillDown(CashFlowDrillDown.INCOME) }
            )
            StatCard(
                title = "Monthly Expense",
                value = formatCurrencyShort(viewModel.monthlyExpenseWithMandates),
                icon = Icons.Filled.ArrowCircleUp,
                iconColor = SpentyAccent1,
                modifier = Modifier.weight(1f),
                onClick = { onDrillDown(CashFlowDrillDown.EXPENSE) }
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(
                title = "OD Interest",
                value = formatCurrencyShort(viewModel.monthlyODInterest),
                icon = Icons.Filled.Percent,
                iconColor = SpentyError,
                modifier = Modifier.weight(1f),
                onClick = { onDrillDown(CashFlowDrillDown.OD_INTEREST) }
            )
            StatCard(
                title = "Monthly EMI",
                value = formatCurrencyShort(viewModel.monthlyEMI),
                icon = Icons.Filled.CreditCard,
                iconColor = SpentyAccent3,
                modifier = Modifier.weight(1f),
                onClick = { onDrillDown(CashFlowDrillDown.EMI) }
            )
        }
    }
}

@Composable
private fun NextMonthButton(onClick: () -> Unit) {
    val nextMonth = remember {
        val cal = Calendar.getInstance()
        cal.add(Calendar.MONTH, 1)
        SimpleDateFormat("MMMM", Locale.getDefault()).format(cal.time)
    }

    ElevatedCard(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Filled.CalendarMonth,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = SpentyPrimary
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "$nextMonth Projection",
                    style = SpentyType.Headline,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "View day-wise cash flow calendar",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Icon(
                imageVector = Icons.Filled.ChevronRight,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

// Chart Section
@Composable
private fun CashFlowChartSection(projectionMonths: List<ProjectionMonth>) {
    ElevatedCard(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Filled.BarChart,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = SpentyPrimary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("24-Month Projection", style = SpentyType.Headline)
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (projectionMonths.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Filled.BarChart,
                            contentDescription = null,
                            modifier = Modifier.size(32.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                        )
                        Text(
                            "No projection data yet",
                            style = SpentyType.Caption1,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                val data = projectionMonths.take(24)
                val maxValue = data.maxOfOrNull {
                    maxOf(it.income ?: 0.0, abs(it.expense ?: 0.0) + abs(it.mandates ?: 0.0))
                } ?: 1.0

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    data.forEach { month ->
                        val incomeHeight = ((month.income ?: 0.0) / maxValue * 180).dp
                        val expenseHeight = ((abs(month.expense ?: 0.0) + abs(month.mandates ?: 0.0)) / maxValue * 180).dp

                        Column(
                            modifier = Modifier.width(48.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Row(
                                modifier = Modifier.height(190.dp),
                                horizontalArrangement = Arrangement.spacedBy(2.dp),
                                verticalAlignment = Alignment.Bottom
                            ) {
                                Box(
                                    modifier = Modifier
                                        .width(16.dp)
                                        .height(incomeHeight)
                                        .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                                        .background(SpentySuccess)
                                )
                                Box(
                                    modifier = Modifier
                                        .width(16.dp)
                                        .height(expenseHeight)
                                        .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                                        .background(SpentyError)
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = formattedMonth(month.month),
                                style = SpentyType.Caption1.copy(fontSize = 9.sp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Legend
                Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    LegendItem(color = SpentySuccess, label = "Income")
                    LegendItem(color = SpentyError, label = "Expense")
                }
            }
        }
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(color)
        )
        Text(label, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// Recurring List Section
@Composable
private fun RecurringListSection(recurringItems: List<RecurringItem>) {
    Column {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Filled.Repeat,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = SpentyPrimary
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Recurring Transactions", style = SpentyType.Headline)
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (recurringItems.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 40.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Filled.Repeat,
                        contentDescription = null,
                        modifier = Modifier.size(32.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "No recurring transactions",
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        "Mark transactions as recurring to see them here",
                        style = SpentyType.Caption1.copy(fontSize = 11.sp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            ElevatedCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = SpentyStyle.cardShape,
                colors = SpentyStyle.cardColors(),
                elevation = SpentyStyle.cardElevation()
            ) {
                Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                    recurringItems.forEachIndexed { index, item ->
                        RecurringRow(item)
                        if (index < recurringItems.lastIndex) {
                            HorizontalDivider(
                                modifier = Modifier.padding(start = 48.dp),
                                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RecurringRow(item: RecurringItem) {
    val color = when (item.type?.lowercase()) {
        "income" -> SpentySuccess
        "expense" -> SpentyAccent1
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    val icon = when (item.type?.lowercase()) {
        "income" -> Icons.Filled.ArrowCircleDown
        "expense" -> Icons.Filled.ArrowCircleUp
        else -> Icons.Filled.SwapHoriz
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(color.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = color
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.description ?: "Transaction",
                style = SpentyType.Subheadline,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                item.effectiveFrequency?.let { freq ->
                    Text(
                        text = freq.replaceFirstChar { it.titlecase() },
                        style = SpentyType.Caption1.copy(fontSize = 11.sp),
                        color = SpentyInfo,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(SpentyInfo.copy(alpha = 0.1f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
                val typeLabel = when (item.type?.lowercase()) {
                    "income" -> "Income"
                    "expense" -> "Expense"
                    else -> "Other"
                }
                Text(
                    text = typeLabel,
                    style = SpentyType.Caption1.copy(fontSize = 11.sp),
                    color = color,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(color.copy(alpha = 0.1f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }

        CurrencyText(
            amount = item.amount ?: 0.0,
            size = CurrencySize.SMALL,
            overrideColor = color
        )
    }
}

// Monthly Breakdown Table
@Composable
private fun MonthlyBreakdownTable(months: List<ProjectionMonth>) {
    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Filled.TableChart,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = SpentyPrimary
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Monthly Breakdown", style = SpentyType.Headline)
        }

        Spacer(modifier = Modifier.height(12.dp))

        ElevatedCard(
            shape = SpentyStyle.cardShape,
            colors = SpentyStyle.cardColors(),
            elevation = SpentyStyle.cardElevation()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
            ) {
                Column {
                    // Header
                    Row(
                        modifier = Modifier.padding(vertical = 8.dp)
                    ) {
                        TableCell("Month", width = 80, isHeader = true, alignment = Alignment.CenterStart)
                        TableCell("Income", width = 90, isHeader = true)
                        TableCell("Expense", width = 90, isHeader = true)
                        TableCell("OD Int.", width = 80, isHeader = true)
                    }

                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))

                    // Data rows
                    months.take(24).forEachIndexed { index, month ->
                        Row(
                            modifier = Modifier
                                .padding(vertical = 6.dp)
                                .then(
                                    if (index % 2 == 0) Modifier.background(
                                        MaterialTheme.colorScheme.background.copy(alpha = 0.5f)
                                    ) else Modifier
                                )
                        ) {
                            TableCell(formattedMonth(month.month), width = 80, alignment = Alignment.CenterStart)
                            TableCell(shortCurrency(month.income ?: 0.0), width = 90, color = SpentySuccess)
                            TableCell(
                                shortCurrency((month.expense ?: 0.0) + (month.mandates ?: 0.0)),
                                width = 90,
                                color = SpentyAccent1
                            )
                            TableCell(shortCurrency(month.odInterest ?: 0.0), width = 80, color = SpentyError)
                        }

                        if (index < minOf(months.size, 24) - 1) {
                            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TableCell(
    text: String,
    width: Int,
    isHeader: Boolean = false,
    color: Color = MaterialTheme.colorScheme.onSurface,
    alignment: Alignment = Alignment.CenterEnd
) {
    Box(
        modifier = Modifier
            .width(width.dp)
            .padding(horizontal = 8.dp),
        contentAlignment = alignment
    ) {
        Text(
            text = text,
            style = if (isHeader) SpentyType.Caption1.copy(fontWeight = FontWeight.Bold)
            else SpentyType.Caption1,
            color = if (isHeader) MaterialTheme.colorScheme.onSurfaceVariant else color,
            maxLines = 1
        )
    }
}

// Drill-Down Sheet
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CashFlowDrillDownSheet(
    drillDown: CashFlowDrillDown,
    viewModel: CashFlowViewModel,
    hasPremium: Boolean = true,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(drillDown.title, style = SpentyType.Headline)
                TextButton(onClick = onDismiss) {
                    Text("Done", color = SpentyPrimary, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            when (drillDown) {
                CashFlowDrillDown.INCOME -> {
                    if (viewModel.incomeItems.isEmpty()) {
                        DrillDownEmptyState("No recurring income items found")
                    } else {
                        viewModel.incomeItems.forEach { item ->
                            RecurringDrillDownRow(item, SpentySuccess)
                        }
                    }
                }
                CashFlowDrillDown.EXPENSE -> {
                    if (viewModel.expenseItems.isNotEmpty()) {
                        Text(
                            "Recurring Expenses",
                            style = SpentyType.Caption1.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp, bottom = 8.dp)
                        )
                        viewModel.expenseItems.forEach { item ->
                            RecurringDrillDownRow(item, SpentyError)
                        }
                    }
                    if (hasPremium && viewModel.mandateItemsList.isNotEmpty()) {
                        Text(
                            "Mandates",
                            style = SpentyType.Caption1.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 8.dp, bottom = 8.dp)
                        )
                        viewModel.mandateItemsList.forEach { item ->
                            MandateDrillDownRow(item)
                        }
                    }
                    if (viewModel.expenseItems.isEmpty() && (!hasPremium || viewModel.mandateItemsList.isEmpty())) {
                        DrillDownEmptyState("No recurring expense items found")
                    }
                }
                CashFlowDrillDown.OD_INTEREST -> {
                    if (viewModel.odInterestItemsList.isEmpty()) {
                        DrillDownEmptyState("No overdraft interest charges")
                    } else {
                        viewModel.odInterestItemsList.forEach { item ->
                            ODInterestDrillDownRow(item)
                        }
                    }
                }
                CashFlowDrillDown.EMI -> {
                    if (viewModel.emiItemsList.isEmpty()) {
                        DrillDownEmptyState("No active EMIs")
                    } else {
                        viewModel.emiItemsList.forEach { item ->
                            EMIDrillDownRow(item)
                        }
                        // Total row
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(SpentyPrimary.copy(alpha = 0.08f))
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "Total Monthly EMI",
                                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.SemiBold)
                            )
                            CurrencyText(
                                amount = viewModel.monthlyEMI,
                                size = CurrencySize.MEDIUM,
                                overrideColor = SpentyAccent3
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(40.dp))
        }
    }
}

@Composable
private fun DrillDownEmptyState(message: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 40.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(message, style = SpentyType.Subheadline, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun RecurringDrillDownRow(item: RecurringItem, color: Color) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.description ?: "Unnamed",
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                color = MaterialTheme.colorScheme.onSurface
            )
            item.effectiveFrequency?.let { freq ->
                Text(
                    text = freq.replaceFirstChar { it.titlecase() },
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            CurrencyText(amount = item.amount ?: 0.0, size = CurrencySize.SMALL, overrideColor = color)
            val monthly = item.monthlyAmount
            if (monthly != null && monthly != item.amount) {
                Text(
                    "${formatCurrencyShort(monthly)}/mo",
                    style = SpentyType.Caption1.copy(fontSize = 11.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
    Spacer(modifier = Modifier.height(8.dp))
}

@Composable
private fun MandateDrillDownRow(item: MandateItem) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.merchant ?: "Unknown Merchant",
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                color = MaterialTheme.colorScheme.onSurface
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                item.mandateType?.takeIf { it.isNotEmpty() }?.let { type ->
                    Text(
                        type.replaceFirstChar { it.titlecase() },
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                item.frequency?.takeIf { it.isNotEmpty() }?.let { freq ->
                    Text(
                        freq.replaceFirstChar { it.titlecase() },
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (item.isEstimatedRate == true) {
                    Text("~", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                CurrencyText(amount = item.amount ?: 0.0, size = CurrencySize.SMALL, overrideColor = SpentyWarning)
            }
            val monthly = item.monthlyEquivalent
            if (monthly != null && monthly != item.amount) {
                Text(
                    "${formatCurrencyShort(monthly)}/mo",
                    style = SpentyType.Caption1.copy(fontSize = 11.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
    Spacer(modifier = Modifier.height(8.dp))
}

@Composable
private fun ODInterestDrillDownRow(item: ODInterestItem) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.accountName ?: "OD Account",
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                color = MaterialTheme.colorScheme.onSurface
            )
            item.rate?.let { rate ->
                Text(
                    "Rate: ${String.format("%.2f", rate)}%",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            item.balance?.let { balance ->
                Text(
                    "Balance: ${formatCurrencyShort(balance)}",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        CurrencyText(amount = item.monthlyInterest ?: 0.0, size = CurrencySize.SMALL, overrideColor = SpentyError)
    }
    Spacer(modifier = Modifier.height(8.dp))
}

@Composable
private fun EMIDrillDownRow(item: EMIItem) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.accountName ?: "Loan Account",
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                color = MaterialTheme.colorScheme.onSurface
            )
            item.emiDay?.let { day ->
                Text(
                    "Due: ${ordinal(day)} of month",
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                item.loanInterestRate?.let { rate ->
                    Text(
                        "${String.format("%.1f", rate)}% p.a.",
                        style = SpentyType.Caption1,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                item.loanTenureMonths?.let { tenure ->
                    Text("$tenure months", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        CurrencyText(amount = item.emiAmount ?: 0.0, size = CurrencySize.SMALL, overrideColor = SpentyAccent3)
    }
    Spacer(modifier = Modifier.height(8.dp))
}

// Helpers
private fun formatCurrencyShort(value: Double): String {
    val format = NumberFormat.getCurrencyInstance(Locale("en", "IN"))
    format.maximumFractionDigits = if (abs(value) < 100_000) 2 else 0
    format.minimumFractionDigits = if (abs(value) < 100_000) 2 else 0
    return format.format(value)
}

private fun shortCurrency(value: Double): String {
    val absVal = abs(value)
    val sign = if (value < 0) "-" else ""
    return when {
        absVal >= 10_000_000 -> String.format("%s%.1fCr", sign, absVal / 10_000_000)
        absVal >= 100_000 -> String.format("%s%.1fL", sign, absVal / 100_000)
        absVal >= 1_000 -> String.format("%s%.1fK", sign, absVal / 1_000)
        else -> String.format("%s%.0f", sign, absVal)
    }
}

private fun formattedMonth(raw: String?): String {
    if (raw == null) return "---"
    val formats = arrayOf("MMM yyyy", "yyyy-MM", "yyyy-MM-dd")
    for (fmt in formats) {
        try {
            val inFmt = SimpleDateFormat(fmt, Locale.US)
            val date = inFmt.parse(raw) ?: continue
            val outFmt = SimpleDateFormat("MMM yy", Locale.US)
            return outFmt.format(date)
        } catch (_: Exception) { }
    }
    return raw.take(7)
}

private fun ordinal(day: Int): String {
    val suffix = when {
        day == 1 || day == 21 || day == 31 -> "st"
        day == 2 || day == 22 -> "nd"
        day == 3 || day == 23 -> "rd"
        else -> "th"
    }
    return "$day$suffix"
}
