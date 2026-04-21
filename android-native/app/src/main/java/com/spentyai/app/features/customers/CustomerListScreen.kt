package com.spentyai.app.features.customers

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.PersonOff
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.EmptyStateView
import com.spentyai.app.core.components.LoadingView
import com.spentyai.app.core.components.SpentySearchBar
import com.spentyai.app.core.components.formatCurrency
import com.spentyai.app.core.models.Customer
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerListScreen(
    viewModel: CustomersViewModel,
    onNavigateToDetail: (Customer) -> Unit,
    onNavigateToForm: (Customer?) -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val filtered by viewModel.filteredCustomers.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { viewModel.loadCustomers() }

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Customers", style = SpentyType.Title2) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onNavigateToForm(null) },
                containerColor = SpentyPrimary,
                contentColor = Color.White
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Add Customer")
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = { viewModel.loadCustomers() },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            if (state.isLoading && state.customers.isEmpty()) {
                LoadingView(message = "Loading customers...")
            } else if (filtered.isEmpty()) {
                EmptyStateView(
                    icon = Icons.Filled.PersonOff,
                    title = "No Customers Yet",
                    subtitle = if (state.searchText.isEmpty()) "Tap the + button to add your first customer."
                              else "No customers match your search."
                ) {
                    if (state.searchText.isEmpty()) {
                        TextButton(onClick = { onNavigateToForm(null) }) {
                            Text("Add Customer", color = SpentyPrimary, style = SpentyType.Headline)
                        }
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(bottom = 80.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    item {
                        SpentySearchBar(
                            query = state.searchText,
                            onQueryChange = { viewModel.updateSearch(it) },
                            placeholder = "Search by name or email",
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }
                    items(filtered, key = { it.id }) { customer ->
                        CustomerRow(
                            customer = customer,
                            onClick = { onNavigateToDetail(customer) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CustomerRow(customer: Customer, onClick: () -> Unit) {
    ElevatedCard(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        shape = SpentyStyle.cardShape,
        colors = SpentyStyle.cardColors(),
        elevation = SpentyStyle.cardElevation()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = customer.name,
                style = SpentyType.Headline
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                FinancialLabel("Invoiced", customer.totalInvoiced)
                FinancialLabel("Paid", customer.totalPaid)
                FinancialLabel("Due", customer.outstandingBalance, highlight = true)
            }
        }
    }
}

@Composable
private fun FinancialLabel(title: String, amount: Double, highlight: Boolean = false) {
    Column {
        Text(title, style = SpentyType.Caption1, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            formatCurrency(amount),
            style = SpentyType.Caption1.copy(fontWeight = if (highlight) FontWeight.SemiBold else FontWeight.Normal),
            color = if (highlight && amount > 0) SpentyError else MaterialTheme.colorScheme.onSurface
        )
    }
}
