package com.spentyai.app.features.reports

import android.content.Intent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.spentyai.app.core.components.*
import com.spentyai.app.core.models.ReportCategory
import com.spentyai.app.core.models.ReportSubcategory
import com.spentyai.app.core.theme.*
import java.io.File
import java.text.NumberFormat
import java.util.*
import kotlin.math.abs

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportsScreen(
    viewModel: ReportsViewModel
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var expandedCategoryIndex by remember { mutableIntStateOf(-1) }

    LaunchedEffect(Unit) {
        viewModel.loadData()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Reports", style = SpentyType.Title2) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (state.isLoading && !viewModel.hasData()) {
                LoadingView(message = "Loading reports...")
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    // Period filter chips
                    item {
                        PeriodFilterChips(
                            activePreset = state.activePreset,
                            onPresetSelected = { preset ->
                                viewModel.applyPreset(preset)
                                if (preset != PeriodPreset.CUSTOM) {
                                    viewModel.loadData()
                                }
                            }
                        )
                    }

                    // Custom date section
                    if (state.activePreset == PeriodPreset.CUSTOM) {
                        item {
                            CustomDateSection(
                                startDate = state.startDate,
                                endDate = state.endDate,
                                onRefresh = { viewModel.loadData() }
                            )
                        }
                    }

                    // Summary cards
                    item {
                        SummaryCardsSection(
                            totalIncome = viewModel.totalIncome(),
                            totalExpense = viewModel.totalExpense(),
                            net = viewModel.net(),
                            transactionCount = viewModel.transactionCount()
                        )
                    }

                    // Period chart
                    item {
                        PeriodChartView(periods = state.periods)
                    }

                    // Category toggle + donut
                    item {
                        CategorySection(
                            catType = state.catType,
                            onTypeSelected = { viewModel.setCatType(it) },
                            categories = state.categories,
                            totalAmount = viewModel.totalCategoryAmount()
                        )
                    }

                    // Category details table
                    item {
                        CategoryTableSection(
                            categories = state.categories,
                            totalAmount = viewModel.totalCategoryAmount(),
                            expandedIndex = expandedCategoryIndex,
                            onToggleExpand = { index ->
                                expandedCategoryIndex = if (expandedCategoryIndex == index) -1 else index
                            }
                        )
                    }

                    // Export section
                    item {
                        ExportSection(
                            isExporting = state.isExporting,
                            onExportCSV = { viewModel.exportCSV(context) },
                            onExportPDF = { viewModel.exportPDF(context) }
                        )
                    }

                    item { Spacer(modifier = Modifier.height(32.dp)) }
                }
            }

            // Error dialog
            if (state.showError) {
                AlertDialog(
                    onDismissRequest = { viewModel.dismissError() },
                    confirmButton = {
                        TextButton(onClick = { viewModel.dismissError() }) { Text("OK") }
                    },
                    title = { Text("Error", style = SpentyType.Headline) },
                    text = { Text(state.errorMessage, style = SpentyType.Body) }
                )
            }
        }
    }
}

@Composable
private fun PeriodFilterChips(
    activePreset: PeriodPreset,
    onPresetSelected: (PeriodPreset) -> Unit
) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(PeriodPreset.allPresets) { preset ->
            val isSelected = activePreset == preset
            FilterChip(
                selected = isSelected,
                onClick = { onPresetSelected(preset) },
                label = { Text(preset.label, style = SpentyType.Footnote) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SpentyPrimary,
                    selectedLabelColor = Color.White,
                    containerColor = MaterialTheme.colorScheme.surface,
                    labelColor = MaterialTheme.colorScheme.onSurface
                ),
                shape = RoundedCornerShape(20.dp),
                border = if (!isSelected) FilterChipDefaults.filterChipBorder(
                    enabled = true,
                    selected = false,
                    borderColor = MaterialTheme.colorScheme.outline
                ) else null
            )
        }
    }
}

@Composable
private fun CustomDateSection(
    startDate: Date,
    endDate: Date,
    onRefresh: () -> Unit
) {
    val dateFormat = remember { java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US) }

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Row(
            modifier = Modifier.padding(SpentyStyle.cardPadding),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("From", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(dateFormat.format(startDate), style = SpentyType.Body)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text("To", style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(dateFormat.format(endDate), style = SpentyType.Body)
            }
            IconButton(
                onClick = onRefresh,
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(SpentyPrimary)
            ) {
                Icon(
                    Icons.Filled.Refresh,
                    contentDescription = "Refresh",
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun SummaryCardsSection(
    totalIncome: Double,
    totalExpense: Double,
    net: Double,
    transactionCount: Int
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(
                title = "Total Income",
                value = formatCurrency(totalIncome),
                icon = Icons.Filled.ArrowCircleDown,
                iconColor = SpentySuccess,
                modifier = Modifier.weight(1f)
            )
            StatCard(
                title = "Total Expense",
                value = formatCurrency(abs(totalExpense)),
                icon = Icons.Filled.ArrowCircleUp,
                iconColor = SpentyError,
                modifier = Modifier.weight(1f)
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(
                title = "Net",
                value = formatCurrency(net),
                icon = Icons.Filled.SwapHoriz,
                iconColor = if (net >= 0) SpentySuccess else SpentyError,
                modifier = Modifier.weight(1f)
            )
            StatCard(
                title = "Transactions",
                value = "$transactionCount",
                icon = Icons.Filled.FormatListBulleted,
                iconColor = SpentyInfo,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun CategorySection(
    catType: ReportCategoryType,
    onTypeSelected: (ReportCategoryType) -> Unit,
    categories: List<ReportCategory>,
    totalAmount: Double
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Toggle
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            ReportCategoryType.allTypes.forEach { type ->
                val isSelected = catType == type
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isSelected) SpentyPrimary else Color.Transparent)
                        .clickable { onTypeSelected(type) }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        type.label,
                        style = SpentyType.Footnote.copy(fontWeight = FontWeight.Medium),
                        color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        DonutChartView(categories = categories, totalAmount = totalAmount)
    }
}

@Composable
private fun CategoryTableSection(
    categories: List<ReportCategory>,
    totalAmount: Double,
    expandedIndex: Int,
    onToggleExpand: (Int) -> Unit
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(SpentyStyle.cardPadding)) {
            Text(
                "Category Details",
                style = SpentyType.Headline,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(8.dp))

            if (categories.isEmpty()) {
                Text(
                    "No categories to display",
                    style = SpentyType.Footnote,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            } else {
                categories.forEachIndexed { index, category ->
                    CategoryRow(
                        category = category,
                        totalAmount = totalAmount,
                        isExpanded = expandedIndex == index,
                        onToggle = { onToggleExpand(index) }
                    )
                    if (index < categories.size - 1) {
                        HorizontalDivider(
                            modifier = Modifier.padding(top = 8.dp),
                            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryRow(
    category: ReportCategory,
    totalAmount: Double,
    isExpanded: Boolean,
    onToggle: () -> Unit
) {
    val percentage = if (totalAmount > 0) {
        abs(category.amount ?: 0.0) / totalAmount
    } else 0.0

    Column {
        // Header row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onToggle() }
                .padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    category.name ?: "Unknown",
                    style = SpentyType.Subheadline,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    "${category.transactionCount ?: 0} transactions",
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    formatCurrency(abs(category.amount ?: 0.0)),
                    style = SpentyType.AmountSmall,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    String.format("%.1f%%", percentage * 100),
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Icon(
                if (isExpanded) Icons.Filled.ExpandLess else Icons.Filled.ChevronRight,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // Progress bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(3.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(percentage.toFloat().coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(2.dp))
                    .background(SpentyPrimary)
            )
        }

        // Subcategories when expanded
        AnimatedVisibility(
            visible = isExpanded,
            enter = expandVertically(),
            exit = shrinkVertically()
        ) {
            val subs = category.subcategories ?: emptyList()
            Column {
                if (subs.isEmpty()) {
                    Row(
                        modifier = Modifier.padding(vertical = 8.dp, horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.size(14.dp), tint = SpentyPrimary)
                        Text("View all transactions", style = SpentyType.Footnote, color = SpentyPrimary)
                    }
                } else {
                    subs.forEach { sub ->
                        SubcategoryRow(sub, abs(category.amount ?: 0.0))
                    }
                    // View all row
                    Row(
                        modifier = Modifier.padding(vertical = 8.dp, horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.size(14.dp), tint = SpentyPrimary)
                        Text(
                            "View all in ${category.name ?: "category"}",
                            style = SpentyType.Caption1,
                            color = SpentyPrimary
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SubcategoryRow(sub: ReportSubcategory, categoryTotal: Double) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp, horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Canvas(modifier = Modifier.size(6.dp)) {
            drawCircle(color = SpentyPrimary.copy(alpha = 0.3f))
        }

        Spacer(modifier = Modifier.width(8.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                sub.subcategoryName ?: "Unknown",
                style = SpentyType.Footnote,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                "${sub.count ?: 0} transactions",
                style = SpentyType.Caption2,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                formatCurrency(abs(sub.total ?: 0.0)),
                style = SpentyType.Footnote.copy(fontWeight = FontWeight.Medium),
                color = MaterialTheme.colorScheme.onSurface
            )
            if (categoryTotal > 0) {
                val pct = abs(sub.total ?: 0.0) / categoryTotal * 100
                Text(
                    String.format("%.1f%%", pct),
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.width(8.dp))
        Icon(Icons.Filled.ChevronRight, contentDescription = null, modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ExportSection(
    isExporting: Boolean,
    onExportCSV: () -> Unit,
    onExportPDF: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OutlinedButton(
            onClick = onExportCSV,
            modifier = Modifier.weight(1f).height(50.dp),
            shape = SpentyStyle.secondaryButtonShape,
            border = SpentyStyle.secondaryButtonBorder(),
            colors = SpentyStyle.secondaryButtonColors(),
            enabled = !isExporting
        ) {
            if (isExporting) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = SpentyPrimary, strokeWidth = 2.dp)
                Spacer(modifier = Modifier.width(8.dp))
            } else {
                Icon(Icons.Filled.TableChart, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text("Export CSV", style = SpentyType.Headline)
        }

        Button(
            onClick = onExportPDF,
            modifier = Modifier.weight(1f).height(50.dp),
            shape = SpentyStyle.primaryButtonShape,
            colors = SpentyStyle.primaryButtonColors(),
            enabled = !isExporting
        ) {
            if (isExporting) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                Spacer(modifier = Modifier.width(8.dp))
            } else {
                Icon(Icons.Filled.PictureAsPdf, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text("Export PDF", style = SpentyType.Headline)
        }
    }
}

private fun formatCurrency(value: Double): String {
    return try {
        val format = NumberFormat.getCurrencyInstance(Locale.US)
        format.currency = Currency.getInstance("INR")
        format.maximumFractionDigits = 0
        format.format(value)
    } catch (e: Exception) {
        String.format("%.0f", value)
    }
}
