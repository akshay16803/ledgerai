package com.spentyai.app.features.featurerequests

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.EmptyStateView
import com.spentyai.app.core.components.LoadingView
import com.spentyai.app.core.models.FeatureRequest
import com.spentyai.app.core.models.FeatureRequestStatus
import com.spentyai.app.core.theme.SpentyInfo
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentySuccess
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeatureRequestsScreen(
    viewModel: FeatureRequestsViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToForm: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadRequests()
    }

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

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Feature Requests", style = SpentyType.Title3) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateToForm) {
                        Icon(Icons.Default.Add, contentDescription = "New", tint = SpentyPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        floatingActionButton = {
            if (state.requests.isNotEmpty()) {
                FloatingActionButton(
                    onClick = onNavigateToForm,
                    containerColor = SpentyPrimary,
                    contentColor = Color.White
                ) {
                    Icon(Icons.Default.Add, contentDescription = "New Request")
                }
            }
        }
    ) { padding ->
        when {
            state.isLoading && state.requests.isEmpty() -> {
                LoadingView(message = "Loading requests...")
            }
            state.requests.isEmpty() -> {
                EmptyStateView(
                    icon = Icons.Default.Lightbulb,
                    title = "No Requests Yet",
                    subtitle = "Be the first to suggest a feature!",
                    modifier = Modifier.padding(padding),
                    action = {
                        Button(
                            onClick = onNavigateToForm,
                            colors = SpentyStyle.primaryButtonColors(),
                            shape = SpentyStyle.primaryButtonShape
                        ) {
                            Text("Submit a Request")
                        }
                    }
                )
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item { Spacer(modifier = Modifier.height(4.dp)) }
                    items(state.requests, key = { it.id }) { request ->
                        RequestRow(
                            request = request,
                            onVote = { viewModel.voteForRequest(request.id) }
                        )
                    }
                    item { Spacer(modifier = Modifier.height(80.dp)) }
                }
            }
        }
    }
}

@Composable
private fun RequestRow(
    request: FeatureRequest,
    onVote: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(12.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Vote button
        Column(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(SpentyPrimary.copy(alpha = 0.1f))
                .clickable(onClick = onVote)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                Icons.Default.ArrowUpward,
                contentDescription = "Vote",
                modifier = Modifier.size(16.dp),
                tint = SpentyPrimary
            )
            Text(
                text = "${request.votes}",
                style = SpentyType.Caption2.copy(fontWeight = FontWeight.SemiBold),
                color = SpentyPrimary
            )
        }

        // Content
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = request.title,
                style = SpentyType.Body.copy(fontWeight = FontWeight.SemiBold)
            )
            if (request.description.isNotEmpty()) {
                Text(
                    text = request.description,
                    style = SpentyType.Caption1,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2
                )
            }
            Spacer(modifier = Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                request.category?.let { cat ->
                    Text(
                        text = cat,
                        style = SpentyType.Caption2.copy(fontWeight = FontWeight.Medium),
                        color = SpentyPrimary,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(SpentyPrimary.copy(alpha = 0.1f))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
                StatusLabel(request.status)
            }
        }
    }
}

@Composable
private fun StatusLabel(status: FeatureRequestStatus) {
    val (displayName, color) = when (status) {
        FeatureRequestStatus.OPEN -> "Open" to SpentyWarning
        FeatureRequestStatus.PLANNED -> "Planned" to SpentyWarning
        FeatureRequestStatus.IN_PROGRESS -> "In Progress" to SpentyInfo
        FeatureRequestStatus.COMPLETED -> "Completed" to SpentySuccess
        FeatureRequestStatus.DECLINED -> "Declined" to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Text(
        text = displayName,
        style = SpentyType.Caption2.copy(fontWeight = FontWeight.Medium),
        color = color,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 8.dp, vertical = 3.dp)
    )
}
