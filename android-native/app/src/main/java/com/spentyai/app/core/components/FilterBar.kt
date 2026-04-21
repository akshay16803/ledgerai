package com.spentyai.app.core.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyType

data class FilterOption(
    val id: String,
    val label: String
)

@Composable
fun FilterBar(
    options: List<FilterOption>,
    selectedId: String?,
    onSelectionChange: (String?) -> Unit,
    modifier: Modifier = Modifier,
    showAllOption: Boolean = true
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (showAllOption) {
            FilterChip(
                selected = selectedId == null,
                onClick = { onSelectionChange(null) },
                label = {
                    Text(
                        text = "All",
                        style = SpentyType.Subheadline
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SpentyPrimary.copy(alpha = 0.12f),
                    selectedLabelColor = SpentyPrimary
                ),
                border = FilterChipDefaults.filterChipBorder(
                    borderColor = MaterialTheme.colorScheme.outline,
                    selectedBorderColor = SpentyPrimary,
                    enabled = true,
                    selected = selectedId == null
                )
            )
        }

        options.forEach { option ->
            FilterChip(
                selected = selectedId == option.id,
                onClick = {
                    onSelectionChange(
                        if (selectedId == option.id) null else option.id
                    )
                },
                label = {
                    Text(
                        text = option.label,
                        style = SpentyType.Subheadline
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SpentyPrimary.copy(alpha = 0.12f),
                    selectedLabelColor = SpentyPrimary
                ),
                border = FilterChipDefaults.filterChipBorder(
                    borderColor = MaterialTheme.colorScheme.outline,
                    selectedBorderColor = SpentyPrimary,
                    enabled = true,
                    selected = selectedId == option.id
                )
            )
        }
    }
}
