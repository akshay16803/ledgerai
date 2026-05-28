package com.spentyai.app.features.aichat

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentyPrimary
import com.spentyai.app.core.theme.SpentyStyle
import com.spentyai.app.core.theme.SpentyType
import com.spentyai.app.features.aiconsent.AIConsentDialog
import com.spentyai.app.features.aiconsent.AIConsentManager
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AIChatScreen(
    viewModel: AIChatViewModel,
    onClose: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    var showMenu by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // ── AI consent gate ──────────────────────────────────────────────────────
    // Required by Apple guideline 5.1.1(i) / 5.1.2(i) and Google Play's User
    // Data policy: before any data is sent to OpenAI we must show the user
    // exactly what is sent and get an explicit opt-in. Mirrors iOS
    // AIChatView.gateAI.
    var showConsentSheet by remember { mutableStateOf(false) }
    var pendingAIAction by remember { mutableStateOf<(() -> Unit)?>(null) }

    /** Run [action] now if consent is granted, otherwise stash and prompt. */
    val gateAI: ((() -> Unit) -> Unit) = { action ->
        android.util.Log.d("AIChat", "gateAI tapped (hasConsented=${AIConsentManager.hasConsented(context)})")
        if (AIConsentManager.hasConsented(context)) {
            action()
        } else {
            pendingAIAction = action
            showConsentSheet = true
        }
    }

    if (showConsentSheet) {
        AIConsentDialog(
            onDismiss = {
                showConsentSheet = false
                pendingAIAction = null
            },
            onGrant = {
                // Fire the action that triggered the prompt, then clear.
                pendingAIAction?.invoke()
                pendingAIAction = null
            }
        )
    }

    // Voice state
    val isVoiceModeActive by viewModel.isVoiceModeActive.collectAsState()
    val isVoiceResponseEnabled by viewModel.isVoiceResponseEnabled.collectAsState()
    val isListening by viewModel.speechManager.isListening.collectAsState()
    val isSpeaking by viewModel.speechManager.isSpeaking.collectAsState()
    val transcribedText by viewModel.speechManager.transcribedText.collectAsState()
    val hasMicPermission by viewModel.speechManager.hasMicrophonePermission.collectAsState()

    // Runtime RECORD_AUDIO permission launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        viewModel.speechManager.checkPermissions(context)
        if (granted) {
            scope.launch { viewModel.enterVoiceMode(context) }
        }
    }

    LaunchedEffect(Unit) {
        // Parallelize: a slow / hung suggestions endpoint must not block
        // history (or vice versa) — mirrors the iOS fix that prevented a
        // perceived "screen hang" when the AI tab was opened.
        launch { viewModel.loadSuggestions() }
        launch { viewModel.loadHistory() }
        viewModel.speechManager.checkPermissions(context)
    }

    // Live-mirror the in-app voice transcription into the TextField so
    // (a) the user sees their words appear as they speak and (b) the
    // Send button (which checks `state.input.isNotBlank()`) activates
    // naturally. Without this, transcription lived in a separate state
    // and tapping Send did nothing after speaking — mirrors the iOS fix.
    LaunchedEffect(transcribedText, isListening) {
        if (isListening && !isVoiceModeActive) {
            viewModel.onInputChange(transcribedText)
        }
    }

    LaunchedEffect(state.scrollToBottomTrigger) {
        if (state.messages.isNotEmpty()) {
            listState.animateScrollToItem(
                state.messages.size + if (state.isSending) 1 else 0
            )
        }
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

    // Clear confirmation
    if (state.showClearConfirmation) {
        AlertDialog(
            onDismissRequest = { viewModel.dismissClearConfirmation() },
            title = { Text("Clear chat history?", style = SpentyType.Headline) },
            text = {
                Text(
                    "This will permanently delete your entire conversation history with the AI assistant.",
                    style = SpentyType.Body
                )
            },
            confirmButton = {
                TextButton(onClick = { viewModel.clearHistory() }) {
                    Text("Clear History", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissClearConfirmation() }) {
                    Text("Cancel")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("AI Assistant", style = SpentyType.Headline) },
                navigationIcon = {
                    IconButton(onClick = {
                        if (isVoiceModeActive) viewModel.exitVoiceMode() else onClose()
                    }) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                },
                actions = {
                    // Voice response (speaker) toggle
                    IconButton(onClick = { viewModel.toggleVoiceResponse() }) {
                        Icon(
                            imageVector = if (isVoiceResponseEnabled) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
                            contentDescription = if (isVoiceResponseEnabled) "Disable voice response" else "Enable voice response",
                            tint = if (isVoiceResponseEnabled) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Voice mode toggle
                    IconButton(onClick = {
                        scope.launch {
                            if (isVoiceModeActive) {
                                viewModel.exitVoiceMode()
                            } else {
                                if (hasMicPermission) {
                                    viewModel.enterVoiceMode(context)
                                } else {
                                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            }
                        }
                    }) {
                        Icon(
                            imageVector = Icons.Default.GraphicEq,
                            contentDescription = if (isVoiceModeActive) "Exit voice mode" else "Enter voice mode",
                            tint = if (isVoiceModeActive) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Overflow menu
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(
                                Icons.Default.MoreVert,
                                contentDescription = "More",
                                tint = SpentyPrimary
                            )
                        }
                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Clear History", color = MaterialTheme.colorScheme.error) },
                                onClick = {
                                    showMenu = false
                                    viewModel.showClearConfirmation()
                                }
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

        // ── Voice mode full-screen overlay ────────────────────────────────────
        if (isVoiceModeActive) {
            VoiceModeOverlay(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                isListening = isListening,
                isSpeaking = isSpeaking,
                isSending = state.isSending,
                transcribedText = transcribedText,
                lastAiMessage = state.messages.lastOrNull { it.role.name == "ASSISTANT" }?.content,
                onSend = { gateAI { scope.launch { viewModel.sendVoiceInput(context) } } },
                onToggleMic = {
                    // toggleMicrophone auto-sends when stopping with non-empty
                    // transcript — gate the stop path so consent is captured
                    // before the request goes out. Starting the mic is fine
                    // without a gate (no data is sent yet).
                    if (viewModel.speechManager.isListening.value) {
                        gateAI {
                            scope.launch { viewModel.toggleMicrophone(context) }
                        }
                    } else {
                        scope.launch { viewModel.toggleMicrophone(context) }
                    }
                },
                onExit = { viewModel.exitVoiceMode() }
            )
            return@Scaffold
        }

        // ── Normal chat layout ─────────────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
        ) {
            // Message list
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 8.dp)
            ) {
                if (state.messages.isEmpty() && !state.isSending) {
                    item {
                        WelcomeSection(state.suggestions) { suggestion ->
                            gateAI { viewModel.sendSuggestion(suggestion) }
                        }
                    }
                }

                if (state.messages.isNotEmpty()) {
                    item {
                        SuggestionStrip(state.suggestions) { suggestion ->
                            gateAI { viewModel.sendSuggestion(suggestion) }
                        }
                    }
                }

                items(state.messages, key = { it.id }) { message ->
                    ChatBubble(message = message)
                }

                if (state.isSending) {
                    item { TypingIndicator() }
                }

                item { Spacer(modifier = Modifier.height(4.dp)) }
            }

            // Live transcription preview strip (shown while listening + text exists)
            AnimatedVisibility(
                visible = isListening && transcribedText.isNotEmpty(),
                enter = fadeIn() + slideInVertically { it },
                exit = fadeOut()
            ) {
                TranscriptionPreviewStrip(transcribedText = transcribedText)
            }

            // Input bar
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            InputBar(
                input = state.input,
                onInputChange = viewModel::onInputChange,
                onSend = { gateAI { viewModel.sendMessage(context) } },
                // Allow Send when EITHER the visible input has text OR the
                // live speech transcript has words — covers the race where
                // the user taps Send before the LaunchedEffect live-mirror
                // has propagated transcribedText into uiState.input.
                // sendMessage() then rescues from transcribedText if input
                // is still empty when it actually reads it.
                canSend = (state.input.isNotBlank() || transcribedText.isNotBlank()) && !state.isSending,
                isListening = isListening,
                onToggleMic = {
                    scope.launch {
                        if (hasMicPermission) {
                            // toggleMicrophone may auto-send transcribed text;
                            // gate it so the consent sheet appears first.
                            if (viewModel.speechManager.isListening.value) {
                                gateAI {
                                    scope.launch { viewModel.toggleMicrophone(context) }
                                }
                            } else {
                                viewModel.toggleMicrophone(context)
                            }
                        } else {
                            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    }
                }
            )
        }
    }
}

// ─── Voice Mode Overlay ───────────────────────────────────────────────────────

@Composable
private fun VoiceModeOverlay(
    modifier: Modifier = Modifier,
    isListening: Boolean,
    isSpeaking: Boolean,
    isSending: Boolean,
    transcribedText: String,
    lastAiMessage: String?,
    onSend: () -> Unit,
    onToggleMic: () -> Unit,
    onExit: () -> Unit
) {
    val statusText = when {
        isSpeaking -> "Speaking…"
        isListening -> "Listening…"
        isSending  -> "Thinking…"
        else       -> "Tap to speak"
    }

    Column(
        modifier = modifier
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        // Pulsing mic circle
        PulsingMicCircle(isListening = isListening)

        // Status label
        Text(
            text = statusText,
            style = SpentyType.Title3,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Live transcription text
        AnimatedVisibility(visible = transcribedText.isNotEmpty()) {
            Text(
                text = "\"$transcribedText\"",
                style = SpentyType.Body,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Last AI response (scrollable)
        if (!lastAiMessage.isNullOrBlank()) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = lastAiMessage,
                    style = SpentyType.Callout,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        } else {
            Spacer(modifier = Modifier.weight(1f))
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Bottom action row: Send | Mute/Unmute | Exit
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Send button — also disable while a request is in flight so the
            // user can't queue duplicates by double-tapping during the response.
            val canSend = transcribedText.isNotEmpty() && !isSending
            IconButton(
                onClick = onSend,
                enabled = canSend,
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(
                        if (canSend) SpentyPrimary else SpentyPrimary.copy(alpha = 0.3f)
                    )
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send",
                    tint = Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }

            // Mic toggle (red when listening)
            IconButton(
                onClick = onToggleMic,
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(if (isListening) SpentyError else MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Icon(
                    imageVector = if (isListening) Icons.Default.MicOff else Icons.Default.Mic,
                    contentDescription = if (isListening) "Stop listening" else "Start listening",
                    tint = if (isListening) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(28.dp)
                )
            }

            // Exit voice mode
            IconButton(
                onClick = onExit,
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(SpentyError.copy(alpha = 0.15f))
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Exit voice mode",
                    tint = SpentyError,
                    modifier = Modifier.size(22.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

// ─── Pulsing Mic Circle ───────────────────────────────────────────────────────

@Composable
private fun PulsingMicCircle(isListening: Boolean) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = if (isListening) 1.18f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 700, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier.size(140.dp)
    ) {
        // Outer pulse ring
        if (isListening) {
            Box(
                modifier = Modifier
                    .size(140.dp)
                    .scale(pulseScale)
                    .clip(CircleShape)
                    .background(SpentyPrimary.copy(alpha = 0.15f))
            )
        }

        // Inner circle with mic icon
        Box(
            modifier = Modifier
                .size(100.dp)
                .clip(CircleShape)
                .background(if (isListening) SpentyPrimary else SpentyPrimary.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Mic,
                contentDescription = "Microphone",
                tint = if (isListening) Color.White else SpentyPrimary,
                modifier = Modifier.size(44.dp)
            )
        }
    }

    Spacer(modifier = Modifier.height(24.dp))
}

// ─── Transcription Preview Strip ──────────────────────────────────────────────

@Composable
private fun TranscriptionPreviewStrip(transcribedText: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SpentyPrimary.copy(alpha = 0.06f))
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.Mic,
            contentDescription = null,
            tint = SpentyPrimary,
            modifier = Modifier.size(14.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = transcribedText,
            style = SpentyType.Footnote,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
    }
}

// ─── Welcome Section ─────────────────────────────────────────────────────────

@Composable
private fun WelcomeSection(
    suggestions: List<String>,
    onSuggestionClick: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(40.dp))

        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(CircleShape)
                .background(SpentyPrimary.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.AutoAwesome,
                contentDescription = null,
                modifier = Modifier.size(32.dp),
                tint = SpentyPrimary
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "SpentyAI Assistant",
            style = SpentyType.Title2,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Ask me anything about your finances, or let me help you create transactions, invoices, and bills.",
            style = SpentyType.Subheadline,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 12.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))

        suggestions.forEach { suggestion ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 5.dp)
                    .shadow(2.dp, RoundedCornerShape(12.dp))
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .clickable { onSuggestionClick(suggestion) }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.AutoAwesome,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = SpentyPrimary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = suggestion,
                    style = SpentyType.Subheadline,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                    maxLines = 1
                )
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))
    }
}

// ─── Suggestion Strip ─────────────────────────────────────────────────────────

@Composable
private fun SuggestionStrip(
    suggestions: List<String>,
    onSuggestionClick: (String) -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(vertical = 8.dp)
    ) {
        items(suggestions) { suggestion ->
            Text(
                text = suggestion,
                style = SpentyType.Caption1.copy(fontWeight = FontWeight.Medium),
                color = SpentyPrimary,
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(SpentyPrimary.copy(alpha = 0.08f))
                    .clickable { onSuggestionClick(suggestion) }
                    .padding(horizontal = 12.dp, vertical = 7.dp)
            )
        }
    }
}

// ─── Input Bar ────────────────────────────────────────────────────────────────

@Composable
private fun InputBar(
    input: String,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
    canSend: Boolean,
    isListening: Boolean,
    onToggleMic: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.95f))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.Bottom
    ) {
        // Mic button (left of text field) — labeled so users discover voice input.
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            IconButton(
                onClick = onToggleMic,
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(if (isListening) SpentyError else SpentyPrimary.copy(alpha = 0.12f))
            ) {
                Icon(
                    imageVector = if (isListening) Icons.Default.MicOff else Icons.Default.Mic,
                    contentDescription = if (isListening) "Stop listening" else "Speak to AI",
                    tint = if (isListening) Color.White else SpentyPrimary,
                    modifier = Modifier.size(18.dp)
                )
            }
            Text(
                text = if (isListening) "Stop" else "Speak",
                style = SpentyType.Caption.copy(fontSize = 9.sp),
                color = if (isListening) SpentyError else SpentyPrimary,
                modifier = Modifier.padding(top = 2.dp)
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        OutlinedTextField(
            value = input,
            onValueChange = onInputChange,
            placeholder = { Text("Ask SpentyAI...", style = SpentyType.Body) },
            modifier = Modifier.weight(1f),
            maxLines = 5,
            shape = RoundedCornerShape(22.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.outline,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                cursorColor = SpentyPrimary
            )
        )

        Spacer(modifier = Modifier.width(8.dp))

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            IconButton(
                onClick = onSend,
                enabled = canSend,
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(if (canSend) SpentyPrimary else SpentyPrimary.copy(alpha = 0.3f))
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send",
                    modifier = Modifier.size(18.dp),
                    tint = Color.White
                )
            }
            Text(
                text = "Send",
                style = SpentyType.Caption.copy(fontSize = 9.sp),
                color = if (canSend) SpentyPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp)
            )
        }
    }
}
