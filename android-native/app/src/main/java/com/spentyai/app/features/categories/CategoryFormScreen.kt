package com.spentyai.app.features.categories

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.models.CategoryType
import com.spentyai.app.core.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryFormScreen(
    viewModel: CategoriesViewModel,
    onDismiss: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val isEditing = state.editingCategory != null
    val isSubcategory = state.selectedParent != null

    var name by remember { mutableStateOf(state.editingCategory?.name ?: "") }
    var selectedParentId by remember { mutableStateOf<String?>(state.editingCategory?.parentId ?: state.selectedParent?.id) }
    var isSaving by remember { mutableStateOf(false) }

    var expandedParent by remember { mutableStateOf(false) }
    val topLevelCategories = viewModel.topLevelCategories()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.background,
        dragHandle = null
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            when {
                                isEditing -> "Edit Category"
                                isSubcategory -> "New Subcategory"
                                else -> "New Category"
                            },
                            style = SpentyType.Headline
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Filled.Close, contentDescription = "Cancel")
                        }
                    },
                    actions = {
                        TextButton(
                            onClick = {
                                val trimmed = name.trim()
                                if (trimmed.isEmpty()) return@TextButton
                                isSaving = true
                                if (state.editingCategory != null) {
                                    viewModel.updateCategory(state.editingCategory!!.id, trimmed)
                                } else {
                                    viewModel.createCategory(trimmed, state.activeTab, selectedParentId)
                                }
                                onDismiss()
                            },
                            enabled = name.trim().isNotEmpty() && !isSaving
                        ) {
                            Text(
                                if (isEditing) "Save" else "Add",
                                style = SpentyType.Headline.copy(fontWeight = FontWeight.SemiBold),
                                color = if (name.trim().isNotEmpty()) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
                )
            },
            containerColor = MaterialTheme.colorScheme.background
        ) { innerPadding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Name
                Text("Name", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    placeholder = {
                        Text(if (isSubcategory) "Subcategory name" else "Category name")
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    textStyle = SpentyType.Body,
                    singleLine = true
                )

                // Parent picker
                Text("Parent", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.onSurfaceVariant)
                ExposedDropdownMenuBox(
                    expanded = expandedParent,
                    onExpandedChange = { expandedParent = !expandedParent }
                ) {
                    val parentName = topLevelCategories.firstOrNull { it.id == selectedParentId }?.name
                        ?: "None (top-level)"

                    OutlinedTextField(
                        value = parentName,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Parent category") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedParent) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        shape = SpentyStyle.inputShape,
                        colors = SpentyStyle.inputColors()
                    )
                    ExposedDropdownMenu(expanded = expandedParent, onDismissRequest = { expandedParent = false }) {
                        DropdownMenuItem(
                            text = { Text("None (top-level)") },
                            onClick = { selectedParentId = null; expandedParent = false }
                        )
                        topLevelCategories.forEach { parent ->
                            DropdownMenuItem(
                                text = { Text(parent.name ?: "Unnamed") },
                                onClick = { selectedParentId = parent.id; expandedParent = false }
                            )
                        }
                    }
                }

                Text(
                    "Leave empty to create a top-level category.",
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Type (read-only)
                Text("Type", style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Type", style = SpentyType.Body, color = MaterialTheme.colorScheme.onSurface)
                    Text(
                        state.activeTab.value.replaceFirstChar { it.uppercase() },
                        style = SpentyType.Body,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}
