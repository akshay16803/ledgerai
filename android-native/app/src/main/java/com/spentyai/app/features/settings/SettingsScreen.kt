package com.spentyai.app.features.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.CurrencyExchange
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.PersonOff
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Button
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.LoadingView
import com.spentyai.app.R
import com.spentyai.app.core.i18n.LanguageManager
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.core.theme.SpentyWarning

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToBusinessProfile: () -> Unit,
    onNavigateToCurrencySettings: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadSettings()
    }

    // Error dialog
    if (state.showError) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissError() },
            title = { Text("Error", style = SpentyType.Headline) },
            text = { Text(state.errorMessage, style = SpentyType.Body) },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissError() }) {
                    Text("OK", color = SpentyPrimary)
                }
            }
        )
    }

    // Sign out confirm
    if (state.showSignOutConfirm) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissSignOutConfirm() },
            title = { Text("Sign Out?", style = SpentyType.Headline) },
            text = {
                Text(
                    "You'll need to sign in again to access your data.",
                    style = SpentyType.Body
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.dismissSignOutConfirm()
                        viewModel.signOut()
                    },
                    colors = SpentyStyle.destructiveButtonColors()
                ) {
                    Text("Sign Out")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissSignOutConfirm() }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Delete account confirm
    if (state.showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissDeleteConfirm() },
            title = { Text("Delete Account", style = SpentyType.Headline) },
            text = {
                Text(
                    "This action is permanent. All your data will be erased and cannot be recovered.",
                    style = SpentyType.Body
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.dismissDeleteConfirm()
                        viewModel.deleteAccount()
                    },
                    colors = SpentyStyle.destructiveButtonColors()
                ) {
                    Text("Delete My Account")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissDeleteConfirm() }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Reset warning (step 1)
    if (state.showResetWarning) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissResetWarning() },
            title = { Text("Reset All Data?", style = SpentyType.Headline) },
            text = {
                Text(
                    "This will erase all your transactions, accounts, invoices, bills, customers, vendors, receipts, and reports.\n\n" +
                            "Any connected email accounts will be disconnected and all synced data removed.\n\n" +
                            "Your account and settings will stay -- but everything else goes back to zero.\n\n" +
                            "This cannot be undone.",
                    style = SpentyType.Body
                )
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.onResetWarningConfirm() },
                    colors = SpentyStyle.destructiveButtonColors()
                ) {
                    Text("I Understand, Continue")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissResetWarning() }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Reset confirm input (step 2)
    if (state.showResetConfirmInput) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissResetConfirmInput() },
            title = { Text("Type RESET to Confirm", style = SpentyType.Headline) },
            text = {
                Column {
                    Text(
                        "To make sure this isn't an accident, type RESET in the box below.",
                        style = SpentyType.Body
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = state.resetConfirmText,
                        onValueChange = { viewModel.onResetConfirmTextChanged(it) },
                        label = { Text("Type RESET") },
                        singleLine = true,
                        colors = SpentyStyle.inputColors(),
                        shape = SpentyStyle.inputShape,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.resetData() },
                    enabled = state.resetConfirmText == "RESET",
                    colors = SpentyStyle.destructiveButtonColors()
                ) {
                    Text("Reset My Data")
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissResetConfirmInput() }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Reset success (step 3)
    if (state.showResetSuccess) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissResetSuccess() },
            title = { Text("Data Reset Complete", style = SpentyType.Headline) },
            text = {
                Text(
                    "All your data has been cleared. Default accounts and categories have been set up for you -- you're starting fresh!",
                    style = SpentyType.Body
                )
            },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissResetSuccess() }) {
                    Text("OK", color = SpentyPrimary)
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings", style = SpentyType.Title3) },
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
        if (state.isLoading && state.settings.firmName == null) {
            LoadingView(message = "Loading settings...")
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .background(MaterialTheme.colorScheme.background)
                    .verticalScroll(rememberScrollState())
            ) {
                Spacer(modifier = Modifier.height(8.dp))

                // Business Profile Section
                SectionHeader(title = "Business", icon = Icons.Default.Business)
                SettingsCard {
                    SettingsNavigationRow(
                        icon = Icons.Default.Business,
                        iconColor = SpentyPrimary,
                        title = "Business Profile",
                        subtitle = state.settings.firmName ?: "Set up your business details",
                        onClick = onNavigateToBusinessProfile
                    )
                }

                // Currency & Locale Section
                SectionHeader(title = "Regional", icon = Icons.Default.CurrencyExchange)
                SettingsCard {
                    val currencySubtitle = buildString {
                        val parts = listOfNotNull(state.settings.baseCurrency, state.settings.dateFormat)
                        if (parts.isEmpty()) append("Set currency and date format")
                        else append(parts.joinToString(" / "))
                    }
                    SettingsNavigationRow(
                        icon = Icons.Default.CurrencyExchange,
                        iconColor = SpentyWarning,
                        title = "Currency & Locale",
                        subtitle = currencySubtitle,
                        onClick = onNavigateToCurrencySettings
                    )
                }

                // Language Section (Hindi/English toggle)
                SectionHeader(title = "Language", icon = Icons.Default.Language)
                SettingsCard {
                    LanguageToggleSection()
                }

                // Invoice Customization Section
                SectionHeader(title = "Invoice Customization", icon = Icons.Default.Image)
                SettingsCard {
                    Column(modifier = Modifier.padding(16.dp)) {
                        // Logo
                        Text(
                            "Business Logo",
                            style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        if (state.settings.logoUrl != null) {
                            Text(
                                "Logo uploaded",
                                style = SpentyType.Caption1,
                                color = SpentyPrimary
                            )
                        } else {
                            UploadPlaceholder("Upload Logo")
                        }

                        Spacer(modifier = Modifier.height(16.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        Spacer(modifier = Modifier.height(16.dp))

                        // Signature
                        Text(
                            "Signature",
                            style = SpentyType.Subheadline.copy(fontWeight = FontWeight.Medium)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        if (state.settings.signatureUrl != null) {
                            Text(
                                "Signature uploaded",
                                style = SpentyType.Caption1,
                                color = SpentyPrimary
                            )
                        } else {
                            UploadPlaceholder("Upload Signature")
                        }
                    }
                }

                // Account Section
                SectionHeader(title = "Account", icon = Icons.AutoMirrored.Filled.ExitToApp)
                SettingsCard {
                    // Sign Out
                    AccountRow(
                        icon = Icons.AutoMirrored.Filled.ExitToApp,
                        iconColor = SpentyWarning,
                        title = "Sign Out",
                        textColor = MaterialTheme.colorScheme.onSurface,
                        onClick = { viewModel.showSignOutConfirm() }
                    )
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 56.dp),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                    )
                    // Reset Data
                    AccountRow(
                        icon = Icons.Default.RestartAlt,
                        iconColor = Color(0xFFFF9500),
                        title = "Reset Data",
                        subtitle = "Start fresh -- removes all your data",
                        textColor = Color(0xFFFF9500),
                        onClick = { viewModel.showResetWarning() },
                        enabled = !state.isResetting
                    )
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 56.dp),
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                    )
                    // Delete Account
                    AccountRow(
                        icon = Icons.Default.PersonOff,
                        iconColor = SpentyError,
                        title = "Delete Account",
                        textColor = SpentyError,
                        onClick = { viewModel.showDeleteConfirm() }
                    )
                }

                // Footer
                Text(
                    text = "Reset Data wipes your transactions and records but keeps your account. Delete Account removes everything permanently.",
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                )

                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, icon: ImageVector) {
    Row(
        modifier = Modifier.padding(start = 20.dp, top = 20.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(14.dp),
            tint = SpentyPrimary
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = title,
            style = SpentyType.Caption1.copy(fontWeight = FontWeight.SemiBold),
            color = SpentyPrimary
        )
    }
}

@Composable
private fun SettingsCard(content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
    ) {
        content()
    }
}

@Composable
private fun SettingsNavigationRow(
    icon: ImageVector,
    iconColor: Color,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(7.dp))
                .background(iconColor),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = Color.White
            )
        }
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = SpentyType.Body,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = subtitle,
                style = SpentyType.Caption1,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1
            )
        }
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun AccountRow(
    icon: ImageVector,
    iconColor: Color,
    title: String,
    subtitle: String? = null,
    textColor: Color = MaterialTheme.colorScheme.onSurface,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(7.dp))
                .background(iconColor),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = Color.White
            )
        }
        Spacer(modifier = Modifier.width(14.dp))
        Column {
            Text(text = title, style = SpentyType.Body, color = textColor)
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = SpentyType.Caption2,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun UploadPlaceholder(label: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(SpentyPrimary.copy(alpha = 0.06f))
            .clickable { /* photo picker will be integrated here */ }
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.Image,
            contentDescription = null,
            tint = SpentyPrimary,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(10.dp))
        Text(text = label, style = SpentyType.Subheadline, color = SpentyPrimary)
    }
}

@Composable
private fun LanguageToggleSection() {
    val context = LocalContext.current
    val activity = context as? android.app.Activity

    // currentLang is read once per composition; switching the language
    // recreates the activity below, which forces a fresh composition with
    // the new locale-wrapped Resources.
    val currentLang = remember { LanguageManager.currentLanguage(context) }

    Column(modifier = Modifier.padding(vertical = 4.dp)) {
        LanguageRow(
            label = stringResource(R.string.language_english),
            selected = currentLang == LanguageManager.LANG_EN,
            onClick = {
                if (currentLang != LanguageManager.LANG_EN) {
                    LanguageManager.setLanguage(context, LanguageManager.LANG_EN)
                    activity?.recreate()
                }
            }
        )
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
        LanguageRow(
            label = stringResource(R.string.language_hindi),
            selected = currentLang == LanguageManager.LANG_HI,
            onClick = {
                if (currentLang != LanguageManager.LANG_HI) {
                    LanguageManager.setLanguage(context, LanguageManager.LANG_HI)
                    activity?.recreate()
                }
            }
        )
        Text(
            stringResource(R.string.language_change_info),
            style = SpentyType.Caption1,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )
    }
}

@Composable
private fun LanguageRow(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = SpentyType.Body,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )
        RadioButton(selected = selected, onClick = onClick)
    }
}
