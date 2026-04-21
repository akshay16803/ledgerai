package com.spentyai.app.features.accounts

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.*
import com.spentyai.app.core.models.AccountSubType
import com.spentyai.app.core.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubTypeManagerScreen(
    viewModel: AccountsViewModel,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    var selectedType by remember { mutableStateOf("asset") }
    var showDeleteConfirm by remember { mutableStateOf<AccountSubType?>(null) }

    val filteredSubTypes = viewModel.subTypesForType(selectedType)

    LaunchedEffect(Unit) {
        if (state.subTypes.isEmpty()) {
            viewModel.loadSubTypes()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sub-Types", style = SpentyType.Headline) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Type tabs
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
            ) {
                items(AccountsViewModel.ACCOUNT_TYPES) { type ->
                    val isSelected = selectedType == type
                    FilterChip(
                        selected = isSelected,
                        onClick = {
                            selectedType = type
                            viewModel.updateNewSubTypeAccountType(type)
                        },
                        label = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = iconForAccountType(type),
                                    contentDescription = null,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    type.replaceFirstChar { it.uppercase() },
                                    style = SpentyType.Footnote.copy(fontWeight = FontWeight.Medium)
                                )
                            }
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = SpentyPrimary,
                            selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                            containerColor = MaterialTheme.colorScheme.surface,
                            labelColor = MaterialTheme.colorScheme.onSurface
                        ),
                        shape = RoundedCornerShape(20.dp)
                    )
                }
            }

            // Add bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = state.newSubTypeName,
                    onValueChange = { viewModel.updateNewSubTypeName(it) },
                    placeholder = { Text("New sub-type name") },
                    modifier = Modifier.weight(1f),
                    shape = SpentyStyle.inputShape,
                    colors = SpentyStyle.inputColors(),
                    textStyle = SpentyType.Body,
                    singleLine = true
                )

                IconButton(
                    onClick = { viewModel.createSubType() },
                    enabled = state.newSubTypeName.trim().isNotEmpty()
                ) {
                    Icon(
                        Icons.Filled.AddCircle,
                        contentDescription = "Add",
                        modifier = Modifier.size(32.dp),
                        tint = if (state.newSubTypeName.trim().isNotEmpty())
                            SpentyPrimary
                        else
                            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                    )
                }
            }

            // List
            when {
                state.isLoadingSubTypes && state.subTypes.isEmpty() -> {
                    LoadingView(message = "Loading sub-types...")
                }
                filteredSubTypes.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            Icons.Filled.Label,
                            contentDescription = null,
                            modifier = Modifier.size(32.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "No sub-types for ${selectedType.replaceFirstChar { it.uppercase() }}",
                            style = SpentyType.Subheadline,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            "Add one above to get started.",
                            style = SpentyType.Caption1,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth().weight(1f),
                        contentPadding = PaddingValues(horizontal = 16.dp)
                    ) {
                        items(filteredSubTypes, key = { it.id }) { subType ->
                            SubTypeRow(
                                subType = subType,
                                isEditing = state.editingSubType?.id == subType.id,
                                editingName = state.editingSubTypeName,
                                selectedType = selectedType,
                                onEditNameChange = { viewModel.updateEditingSubTypeName(it) },
                                onSave = { viewModel.updateSubType(subType.id) },
                                onCancel = { viewModel.setEditingSubType(null) },
                                onEdit = { viewModel.setEditingSubType(subType) },
                                onDelete = { showDeleteConfirm = subType }
                            )
                            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                        }
                    }
                }
            }
        }

        // Error banner
        ErrorBanner(
            message = state.errorMessage ?: "",
            isVisible = state.errorMessage != null,
            onDismiss = { viewModel.dismissError() },
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )
    }

    // Delete confirmation
    showDeleteConfirm?.let { target ->
        ConfirmDialog(
            title = "Delete Sub-Type",
            message = "Are you sure you want to delete \"${target.name ?: "this sub-type"}\"?",
            confirmText = "Delete",
            isDestructive = true,
            onConfirm = {
                viewModel.deleteSubType(target.id)
                showDeleteConfirm = null
            },
            onDismiss = { showDeleteConfirm = null }
        )
    }
}

@Composable
private fun SubTypeRow(
    subType: AccountSubType,
    isEditing: Boolean,
    editingName: String,
    selectedType: String,
    onEditNameChange: (String) -> Unit,
    onSave: () -> Unit,
    onCancel: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    if (isEditing) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            OutlinedTextField(
                value = editingName,
                onValueChange = onEditNameChange,
                modifier = Modifier.weight(1f),
                shape = SpentyStyle.inputShape,
                colors = SpentyStyle.inputColors(),
                textStyle = SpentyType.Body,
                singleLine = true
            )
            IconButton(onClick = onSave) {
                Icon(Icons.Filled.CheckCircle, contentDescription = "Save", tint = SpentyPrimary, modifier = Modifier.size(24.dp))
            }
            IconButton(onClick = onCancel) {
                Icon(Icons.Filled.Cancel, contentDescription = "Cancel", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(24.dp))
            }
        }
    } else {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (!subType.icon.isNullOrEmpty()) {
                Icon(
                    imageVector = Icons.Filled.Label,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = AccountsViewModel.colorForAccountType(selectedType)
                )
                Spacer(modifier = Modifier.width(8.dp))
            }

            Text(
                text = subType.name ?: "Unnamed",
                style = SpentyType.Body,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f)
            )

            IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Filled.Edit, contentDescription = "Edit", modifier = Modifier.size(18.dp), tint = SpentyInfo)
            }
            IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Filled.Delete, contentDescription = "Delete", modifier = Modifier.size(18.dp), tint = SpentyError)
            }
        }
    }
}
