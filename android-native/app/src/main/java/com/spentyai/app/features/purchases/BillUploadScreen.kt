package com.spentyai.app.features.purchases

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.spentyai.app.core.components.formatCurrency
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentySuccess
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.features.invoices.SectionCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillUploadScreen(
    viewModel: PurchasesViewModel,
    onNavigateBack: () -> Unit
) {
    var isUploading by remember { mutableStateOf(false) }
    var uploadedFileName by remember { mutableStateOf<String?>(null) }
    var parseError by remember { mutableStateOf<String?>(null) }

    // For now, this is a placeholder UI matching the iOS design.
    // Actual upload/parse integration requires multipart upload support.
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            uploadedFileName = "bill_upload"
            isUploading = true
            // In a real implementation, we'd read the file content and call
            // the upload API endpoint. For now, simulate the flow.
            isUploading = false
            parseError = "Bill parsing requires server-side AI processing. Upload feature coming soon."
        }
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success) {
            isUploading = true
            isUploading = false
            parseError = "Bill parsing requires server-side AI processing. Upload feature coming soon."
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Upload Bill", style = SpentyType.Headline) },
                navigationIcon = { IconButton(onClick = onNavigateBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            if (isUploading) {
                // Uploading state
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.cardShape,
                    colors = SpentyStyle.cardColors()
                ) {
                    Column(
                        modifier = Modifier.padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(48.dp),
                            color = SpentyPrimary,
                            strokeWidth = 4.dp
                        )
                        Text("Parsing bill...", style = SpentyType.Headline)
                        Text(
                            "AI is extracting data from your bill. This may take a moment.",
                            style = SpentyType.Subheadline,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                        if (uploadedFileName != null) {
                            Text(
                                uploadedFileName!!,
                                style = SpentyType.Caption1,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            } else if (parseError != null) {
                // Error / placeholder state
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.cardShape,
                    colors = SpentyStyle.cardColors()
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            Icons.Filled.Description,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = SpentyPrimary.copy(alpha = 0.5f)
                        )
                        Text(parseError!!, style = SpentyType.Body, textAlign = TextAlign.Center)
                        OutlinedButton(
                            onClick = { parseError = null },
                            shape = SpentyStyle.secondaryButtonShape,
                            border = SpentyStyle.secondaryButtonBorder()
                        ) {
                            Text("Try Again", color = SpentyPrimary)
                        }
                    }
                }
            } else {
                // Upload prompt
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = SpentyStyle.cardShape,
                    colors = SpentyStyle.cardColors()
                ) {
                    Column(
                        modifier = Modifier.padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Icon(
                            Icons.Filled.Description,
                            contentDescription = null,
                            modifier = Modifier.size(72.dp),
                            tint = SpentyPrimary.copy(alpha = 0.5f)
                        )
                        Text("Upload a Bill", style = SpentyType.Title3)
                        Text(
                            "Upload a photo or PDF of a purchase bill. AI will extract the vendor, items, and amounts automatically.",
                            style = SpentyType.Subheadline,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Button(
                            onClick = { filePickerLauncher.launch("image/*") },
                            modifier = Modifier.fillMaxWidth(),
                            colors = SpentyStyle.primaryButtonColors(),
                            shape = SpentyStyle.primaryButtonShape
                        ) {
                            Icon(Icons.Filled.CameraAlt, contentDescription = null, tint = Color.White)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Choose Photo", style = SpentyType.Headline, color = Color.White)
                        }

                        OutlinedButton(
                            onClick = { filePickerLauncher.launch("application/pdf") },
                            modifier = Modifier.fillMaxWidth(),
                            shape = SpentyStyle.secondaryButtonShape,
                            border = SpentyStyle.secondaryButtonBorder()
                        ) {
                            Icon(Icons.Filled.FileUpload, contentDescription = null, tint = SpentyPrimary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Choose File", style = SpentyType.Headline, color = SpentyPrimary)
                        }
                    }
                }
            }
        }
    }
}
