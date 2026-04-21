package com.spentyai.app.features.settings

import androidx.compose.foundation.background
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Numbers
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType

private val indianStates = listOf(
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
    "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh",
    "Lakshadweep", "Puducherry"
)

private val countries = listOf(
    "India", "United States", "United Kingdom", "Canada",
    "Australia", "Germany", "France", "Singapore",
    "United Arab Emirates", "Japan", "Other"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BusinessProfileScreen(
    viewModel: SettingsViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    if (state.showSaveSuccess) {
        AlertDialog(
            onDismissRequest = {
                viewModel.dismissSaveSuccess()
                onNavigateBack()
            },
            title = { Text("Saved", style = SpentyType.Headline) },
            text = { Text("Your business profile has been updated.", style = SpentyType.Body) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.dismissSaveSuccess()
                    onNavigateBack()
                }) {
                    Text("OK", color = SpentyPrimary)
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Business Profile", style = SpentyType.Headline) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (state.isSaving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp).padding(end = 16.dp),
                            color = SpentyPrimary,
                            strokeWidth = 2.dp
                        )
                    } else {
                        TextButton(
                            onClick = { viewModel.saveSettings() },
                            enabled = !state.isSaving
                        ) {
                            Text(
                                "Save",
                                style = SpentyType.Body.copy(fontWeight = FontWeight.SemiBold),
                                color = SpentyPrimary
                            )
                        }
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
                .background(MaterialTheme.colorScheme.background)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
        ) {
            // Firm Details
            SectionLabel("Firm Details")
            IconTextField(
                icon = Icons.Default.Business,
                value = state.settings.firmName ?: "",
                onValueChange = { viewModel.updateField { s -> s.copy(firmName = it.ifEmpty { null }) } },
                label = "Firm Name"
            )

            // Tax Identifiers
            SectionLabel("Tax Identifiers")
            IconTextField(
                icon = Icons.Default.Numbers,
                value = state.settings.firmGstin ?: "",
                onValueChange = { viewModel.updateField { s -> s.copy(firmGstin = it.ifEmpty { null }) } },
                label = "GSTIN"
            )
            Spacer(modifier = Modifier.height(12.dp))
            IconTextField(
                icon = Icons.Default.CreditCard,
                value = state.settings.firmPan ?: "",
                onValueChange = { viewModel.updateField { s -> s.copy(firmPan = it.ifEmpty { null }) } },
                label = "PAN"
            )

            // Location
            SectionLabel("Location")

            // State picker
            DropdownField(
                icon = Icons.Default.Map,
                label = "State",
                selectedValue = state.settings.firmState ?: "",
                options = indianStates,
                onValueChange = { viewModel.updateField { s -> s.copy(firmState = it.ifEmpty { null }) } }
            )
            Spacer(modifier = Modifier.height(12.dp))

            // Country picker
            DropdownField(
                icon = Icons.Default.Public,
                label = "Country",
                selectedValue = state.settings.businessCountry ?: "",
                options = countries,
                onValueChange = { viewModel.updateField { s -> s.copy(businessCountry = it.ifEmpty { null }) } }
            )
            Spacer(modifier = Modifier.height(12.dp))

            // Address
            IconTextField(
                icon = Icons.Default.LocationOn,
                value = state.settings.firmAddress ?: "",
                onValueChange = { viewModel.updateField { s -> s.copy(firmAddress = it.ifEmpty { null }) } },
                label = "Business Address",
                maxLines = 4
            )

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold),
        color = SpentyPrimary,
        modifier = Modifier.padding(top = 20.dp, bottom = 12.dp, start = 4.dp)
    )
}

@Composable
private fun IconTextField(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    maxLines: Int = 1
) {
    Row(
        verticalAlignment = if (maxLines > 1) Alignment.Top else Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier
                .size(24.dp)
                .padding(top = if (maxLines > 1) 16.dp else 0.dp),
            tint = SpentyPrimary
        )
        Spacer(modifier = Modifier.width(12.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(label) },
            modifier = Modifier.fillMaxWidth(),
            maxLines = maxLines,
            colors = SpentyStyle.inputColors(),
            shape = SpentyStyle.inputShape
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownField(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    selectedValue: String,
    options: List<String>,
    onValueChange: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = SpentyPrimary
        )
        Spacer(modifier = Modifier.width(12.dp))
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded },
            modifier = Modifier.fillMaxWidth()
        ) {
            OutlinedTextField(
                value = selectedValue.ifEmpty { "Select $label" },
                onValueChange = {},
                readOnly = true,
                label = { Text(label) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth(),
                colors = SpentyStyle.inputColors(),
                shape = SpentyStyle.inputShape
            )
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            onValueChange(option)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}
