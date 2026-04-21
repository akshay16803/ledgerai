package com.spentyai.app.features.categories

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.*
import com.spentyai.app.core.models.Category
import com.spentyai.app.core.models.CategoryType
import com.spentyai.app.core.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryListScreen(
    viewModel: CategoriesViewModel
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadCategories()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Categories", style = SpentyType.Title2) },
                actions = {
                    IconButton(onClick = { viewModel.beginCreate() }) {
                        Icon(Icons.Filled.Add, contentDescription = "Add Category", tint = SpentyPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        floatingActionButton = {
            if (viewModel.categoryTree().isNotEmpty()) {
                FloatingActionButton(
                    onClick = { viewModel.beginCreate() },
                    containerColor = SpentyPrimary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Add Category")
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Segmented control
            SegmentedControl(
                selectedTab = state.activeTab,
                onTabSelected = { viewModel.setActiveTab(it) },
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            // Content
            when {
                state.isLoading && state.categories.isEmpty() -> {
                    LoadingView(message = "Loading categories...")
                }
                viewModel.categoryTree().isEmpty() -> {
                    EmptyStateView(
                        icon = if (state.activeTab == CategoryType.EXPENSE) Icons.Outlined.ArrowUpward else Icons.Outlined.ArrowDownward,
                        title = "No ${state.activeTab.value} categories yet",
                        subtitle = "Tap + to create your first category."
                    )
                }
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(viewModel.categoryTree(), key = { it.id }) { parent ->
                            CategoryTreeRow(
                                category = parent,
                                onAddChild = { viewModel.beginCreate(parent) },
                                onEdit = { viewModel.beginEdit(it) },
                                onDelete = { viewModel.deleteCategory(it.id) }
                            )
                        }
                        item { Spacer(modifier = Modifier.height(80.dp)) }
                    }
                }
            }
        }

        // Error dialog
        if (state.showError) {
            AlertDialog(
                onDismissRequest = { viewModel.dismissError() },
                confirmButton = {
                    TextButton(onClick = { viewModel.dismissError() }) {
                        Text("OK")
                    }
                },
                title = { Text("Error", style = SpentyType.Headline) },
                text = { Text(state.errorMessage, style = SpentyType.Body) }
            )
        }
    }

    // Form sheet
    if (state.showForm) {
        CategoryFormScreen(
            viewModel = viewModel,
            onDismiss = { viewModel.hideForm() }
        )
    }
}

@Composable
private fun SegmentedControl(
    selectedTab: CategoryType,
    onTabSelected: (CategoryType) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(modifier = modifier.fillMaxWidth()) {
        CategoryType.entries.forEach { type ->
            val isSelected = selectedTab == type
            FilterChip(
                selected = isSelected,
                onClick = { onTabSelected(type) },
                label = {
                    Text(
                        type.value.replaceFirstChar { it.uppercase() },
                        style = SpentyType.Footnote.copy(fontWeight = FontWeight.Medium),
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SpentyPrimary,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                    containerColor = MaterialTheme.colorScheme.surface,
                    labelColor = MaterialTheme.colorScheme.onSurface
                ),
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun CategoryTreeRow(
    category: Category,
    onAddChild: () -> Unit,
    onEdit: (Category) -> Unit,
    onDelete: (Category) -> Unit
) {
    val children = category.children ?: emptyList()
    var isExpanded by remember { mutableStateOf(true) }

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column {
            // Parent row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        if (children.isNotEmpty()) isExpanded = !isExpanded
                    }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Filled.Folder,
                    contentDescription = null,
                    modifier = Modifier.size(22.dp),
                    tint = SpentyPrimary
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = category.name ?: "Unnamed",
                    style = SpentyType.Body.copy(fontWeight = FontWeight.Medium),
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f)
                )

                if (children.isNotEmpty()) {
                    Text(
                        text = "${children.size}",
                        style = SpentyType.Caption2.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .let {
                                it
                                    .background(SpentyPrimary.copy(alpha = 0.7f), shape = androidx.compose.foundation.shape.CircleShape)
                                    .padding(horizontal = 7.dp, vertical = 2.dp)
                            }
                    )
                }

                // Add child button
                IconButton(onClick = onAddChild, modifier = Modifier.size(28.dp)) {
                    Icon(
                        Icons.Filled.AddCircleOutline,
                        contentDescription = "Add Subcategory",
                        modifier = Modifier.size(20.dp),
                        tint = SpentyPrimary.copy(alpha = 0.6f)
                    )
                }

                // Edit button
                IconButton(onClick = { onEdit(category) }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Filled.Edit, contentDescription = "Edit", modifier = Modifier.size(16.dp), tint = SpentyWarning)
                }

                // Delete button
                IconButton(onClick = { onDelete(category) }, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Filled.Delete, contentDescription = "Delete", modifier = Modifier.size(16.dp), tint = SpentyError)
                }

                if (children.isNotEmpty()) {
                    Icon(
                        if (isExpanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Children
            AnimatedVisibility(
                visible = isExpanded && children.isNotEmpty(),
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column {
                    children.forEach { child ->
                        HorizontalDivider(
                            modifier = Modifier.padding(start = 48.dp),
                            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                        )
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(start = 20.dp, end = 16.dp, top = 8.dp, bottom = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Spacer(modifier = Modifier.width(16.dp))
                            Icon(
                                Icons.Filled.Label,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                                tint = SpentyPrimary.copy(alpha = 0.6f)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = child.name ?: "Unnamed",
                                style = SpentyType.Subheadline,
                                color = MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(onClick = { onEdit(child) }, modifier = Modifier.size(28.dp)) {
                                Icon(Icons.Filled.Edit, contentDescription = "Edit", modifier = Modifier.size(14.dp), tint = SpentyWarning)
                            }
                            IconButton(onClick = { onDelete(child) }, modifier = Modifier.size(28.dp)) {
                                Icon(Icons.Filled.Delete, contentDescription = "Delete", modifier = Modifier.size(14.dp), tint = SpentyError)
                            }
                        }
                    }

                    // Add Subcategory row
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 48.dp),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onAddChild() }
                            .padding(start = 36.dp, end = 16.dp, top = 8.dp, bottom = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Filled.AddCircle,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                            tint = SpentyPrimary.copy(alpha = 0.7f)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            "Add Subcategory",
                            style = SpentyType.Subheadline,
                            color = SpentyPrimary
                        )
                    }
                }
            }
        }
    }
}
