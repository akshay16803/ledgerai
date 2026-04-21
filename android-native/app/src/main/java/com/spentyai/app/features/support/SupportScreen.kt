package com.spentyai.app.features.support

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.QuestionMark
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupportScreen(
    viewModel: SupportViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadFAQ()
    }

    // Error dialog
    state.errorMessage?.let { error ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissError() },
            title = { Text("Error", style = SpentyType.Headline) },
            text = { Text(error, style = SpentyType.Body) },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissError() }) {
                    Text("OK", color = SpentyPrimary)
                }
            }
        )
    }

    // Success dialog
    if (state.isSubmitted) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissSuccess() },
            title = { Text("Ticket Submitted", style = SpentyType.Headline) },
            text = {
                Text(
                    "We've received your support request and will get back to you shortly.",
                    style = SpentyType.Body
                )
            },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissSuccess() }) {
                    Text("OK", color = SpentyPrimary)
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Support", style = SpentyType.Title3) },
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 16.dp)
        ) {
            // Header
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(SpentyPrimary.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Headphones,
                        contentDescription = null,
                        modifier = Modifier.size(36.dp),
                        tint = SpentyPrimary
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text("How can we help?", style = SpentyType.Title2)
                Text(
                    "Submit a ticket or browse our FAQ below.",
                    style = SpentyType.Subheadline,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            // Ticket Form
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(4.dp, RoundedCornerShape(16.dp))
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.background)
                    .padding(20.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Email, contentDescription = null, tint = SpentyPrimary, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Submit a Ticket", style = SpentyType.Headline, color = SpentyPrimary)
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Subject
                Text("Subject", style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium))
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(
                    value = state.subject,
                    onValueChange = { viewModel.onSubjectChange(it) },
                    placeholder = { Text("Brief description of your issue") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = SpentyStyle.inputColors(),
                    shape = SpentyStyle.inputShape,
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Category
                Text("Category", style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium))
                Spacer(modifier = Modifier.height(6.dp))
                CategoryDropdown(
                    selected = state.category,
                    onSelect = { viewModel.onCategoryChange(it) }
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Priority
                Text("Priority", style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium))
                Spacer(modifier = Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    TicketPriority.entries.forEach { p ->
                        val isSelected = state.priority == p
                        Text(
                            text = p.displayName,
                            style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(
                                    if (isSelected) SpentyPrimary
                                    else MaterialTheme.colorScheme.surface
                                )
                                .clickable { viewModel.onPriorityChange(p) }
                                .padding(vertical = 10.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Message
                Text("Message", style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium))
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(
                    value = state.message,
                    onValueChange = { viewModel.onMessageChange(it) },
                    placeholder = { Text("Describe your issue in detail...") },
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                    colors = SpentyStyle.inputColors(),
                    shape = SpentyStyle.inputShape,
                    maxLines = 6
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Submit
                Button(
                    onClick = { viewModel.submitTicket() },
                    enabled = state.isFormValid && !state.isSubmitting,
                    colors = SpentyStyle.primaryButtonColors(),
                    shape = SpentyStyle.primaryButtonShape,
                    modifier = SpentyStyle.primaryButtonModifier
                ) {
                    if (state.isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(
                        if (state.isSubmitting) "Submitting..." else "Submit Ticket",
                        style = SpentyType.Headline,
                        color = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // FAQ Section
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.QuestionMark, contentDescription = null, tint = SpentyPrimary, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Frequently Asked Questions", style = SpentyType.Headline, color = SpentyPrimary)
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (state.isLoadingFAQ) {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = SpentyPrimary)
                }
            } else if (state.faqItems.isEmpty()) {
                Text(
                    "No FAQ items available.",
                    style = SpentyType.Subheadline,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                    textAlign = TextAlign.Center
                )
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(MaterialTheme.colorScheme.surface)
                ) {
                    state.faqItems.forEachIndexed { index, item ->
                        FAQRow(
                            item = item,
                            isExpanded = state.expandedFaqId == item.id,
                            onToggle = { viewModel.toggleFaq(item.id) }
                        )
                        if (index < state.faqItems.lastIndex) {
                            HorizontalDivider(
                                modifier = Modifier.padding(horizontal = 16.dp),
                                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun CategoryDropdown(
    selected: TicketCategory,
    onSelect: (TicketCategory) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Box {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(MaterialTheme.colorScheme.background)
                .clickable { expanded = true }
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = selected.displayName,
                style = SpentyType.Body,
                modifier = Modifier.weight(1f)
            )
            Icon(
                Icons.Default.ExpandMore,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            TicketCategory.entries.forEach { cat ->
                DropdownMenuItem(
                    text = { Text(cat.displayName) },
                    onClick = {
                        onSelect(cat)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun FAQRow(
    item: FAQItem,
    isExpanded: Boolean,
    onToggle: () -> Unit
) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onToggle)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = item.question ?: "",
                style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium),
                modifier = Modifier.weight(1f)
            )
            Icon(
                Icons.Default.ExpandMore,
                contentDescription = null,
                modifier = Modifier
                    .size(20.dp)
                    .rotate(if (isExpanded) 180f else 0f),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        AnimatedVisibility(
            visible = isExpanded,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut()
        ) {
            Text(
                text = item.answer ?: "",
                style = SpentyType.Subheadline,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)
            )
        }
    }
}
