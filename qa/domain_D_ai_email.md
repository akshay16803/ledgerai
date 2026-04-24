# Domain D — AI Chat, Voice Mode, Gmail Sync & Strict AI Extraction

**Platform:** SpentyAI iOS (Swift / SwiftUI)
**Repository:** `/sessions/zen-vibrant-einstein/ledgerai` — `emergent` branch
**Date:** 2026-04-24
**Scope:** AI Chat regular + voice (EN / Hinglish / Hindi Devanagari), Gmail OAuth + sync, Strict AI transaction extraction, pending-review approval flow.

---

## Legend

- **Priority:** P0 = blocker (ship-stopper) · P1 = major · P2 = minor · P3 = polish
- **Bug severity if fails:** Critical / High / Medium / Low
- **DUT:** device under test — iPhone running the freshly-built SpentyAI binary via Xcode USB install (per team convention).
- **B1:** known regression from 2026-04-24 handoff — voice-mode raw asterisks + truncated response. D28 and D29 gate App Store submission.

## Pre-conditions that apply to the entire suite

- Fresh build installed from Xcode over USB (NOT TestFlight), DerivedData cleared before install.
- Device signed in as a real user with at least one connected Gmail (for sync tests) and at least 90 days of historical transactions in the backend.
- Backend reachable at `api.spentyai.com` (prod) or the staging URL the tester has been given.
- Microphone + Speech Recognition permissions denied at start (so permission tests exercise the grant path); individual tests will opt into granting.
- Locale = en-IN, but tests explicitly vary input language so locale should not mask voice-detection logic.
- "Tap voice icon" refers to the waveform icon in the top-right toolbar of AI Chat; "tap mic" refers to the in-line microphone button in the text input bar.
- After each test run, screenshots of any failures are attached to the QA ticket.

---

# Section 1 — AI Chat: Regular Mode

### D01 — Open AI Chat from More tab (cold start)
**Priority:** P0
**Pre-conditions:** Fresh install, user signed in, no prior chat history.
**Steps:**
1. Launch app.
2. Navigate to More tab.
3. Tap "AI Assistant" / "SpentyAI".
**Expected result:** Chat sheet presents with navigation title "AI Assistant", close button on top-left, waveform + speaker + ellipsis on top-right. Welcome section renders (sparkles circle, "SpentyAI Assistant" title, "Ask me anything…" subheadline). Suggested prompt chips load (up to 4, fetched from `/ai/chat/suggestions`; falls back to 4 defaults on failure). Input bar visible at the bottom with mic button, text field, and send button (send is disabled). Voice response toggle defaults to off (speaker-slash icon).
**Bug severity if fails:** Critical

### D02 — First message (cold) in English — markdown response
**Priority:** P0
**Pre-conditions:** D01 complete, no chat history.
**Steps:**
1. Type "What did I spend this month?" into the input.
2. Tap send (arrow-up button).
**Expected result:** User bubble appears immediately on the right in primary-color background. Typing indicator (3 pulsing dots) appears under an AI avatar bubble. After round-trip, the typing indicator is replaced by the assistant reply. Reply renders markdown correctly — **bold** amounts render bold (NOT with literal asterisks), line breaks respected, bullet lists render as bullets. Scroll auto-anchors so the TOP of the assistant bubble is visible (not the last line). Input is cleared; send button disabled again.
**Bug severity if fails:** Critical

### D03 — Warm follow-up message
**Priority:** P0
**Pre-conditions:** D02 complete — at least one assistant reply in the history.
**Steps:**
1. Type "What about last month?" and send.
**Expected result:** The backend receives the prior conversation (`conversation` array in `ChatRequest`), so the assistant answers with last-month numbers without re-asking for context. Chat scrolls to show the top of the new reply. Suggestion strip remains visible above the messages.
**Bug severity if fails:** High

### D04 — Hinglish text message (Roman-script Hindi)
**Priority:** P0
**Pre-conditions:** D01 complete.
**Steps:**
1. Type `kitna kharcha hua is month` and send.
**Expected result:** Assistant responds in Hinglish (Roman script), with correct amount in ₹ and correct month. Amounts rendered bold via markdown. No garbled characters; no falling back to pure English unless the backend can't understand (document actual behavior).
**Bug severity if fails:** High

### D05 — Hindi Devanagari text message
**Priority:** P0
**Pre-conditions:** D01 complete, Hindi keyboard enabled on the device.
**Steps:**
1. Type `इस महीने कितना खर्च हुआ` and send.
**Expected result:** Assistant reply is in Hindi Devanagari. Script renders correctly (no `□` boxes, no mojibake). Amounts formatted with ₹ symbol. Markdown bold still renders for key numbers.
**Bug severity if fails:** High

### D06 — Scroll-to-top behavior after AI reply
**Priority:** P0
**Pre-conditions:** At least 5 messages in history so there is scroll room.
**Steps:**
1. Send a message that triggers a long (>300-word) reply.
2. Observe scroll position the moment the reply renders.
**Expected result:** ScrollViewReader anchors to `lastId` with `.top` anchor (via `scrollToLastMessageTopTrigger`) — user sees the FIRST line of the new assistant bubble with a small breathing room, NOT the last line. User can then manually scroll down to continue reading.
**Bug severity if fails:** High

### D07 — Markdown: headers H1 / H2 / H3
**Priority:** P1
**Pre-conditions:** D01 complete.
**Steps:**
1. Send a prompt that provokes headers (e.g. "Give me a monthly breakdown with sections for income, expenses, and savings").
**Expected result:** `# Income`, `## Expenses`, `### Savings` render with progressively smaller but still-bold headings. No raw `#` characters visible.
**Bug severity if fails:** Medium

### D08 — Markdown: bold + italic + inline code
**Priority:** P1
**Pre-conditions:** D01 complete.
**Steps:**
1. Ask "Explain my top expense using **bold**, *italic*, and `inline code`".
**Expected result:** `**bold**` renders bold; `*italic*` renders italic; `` `inline code` `` renders in monospace styling. No raw asterisks or backticks visible.
**Bug severity if fails:** Medium

### D09 — Markdown: bullet list
**Priority:** P0
**Pre-conditions:** D01 complete.
**Steps:**
1. Send "Show top 5 expenses this month as a bullet list".
**Expected result:** Response renders as proper bullet list (visible bullets). No raw `-` or `*` prefix characters. Each bullet on its own line.
**Bug severity if fails:** High

### D10 — Markdown: numbered list
**Priority:** P1
**Pre-conditions:** D01 complete.
**Steps:**
1. Send "List 3 ways I can save money, numbered".
**Expected result:** Numbered list renders with `1.`, `2.`, `3.` as proper ordered-list numerals via AttributedString markdown interpretation.
**Bug severity if fails:** Medium

### D11 — Markdown: fenced code block
**Priority:** P2
**Pre-conditions:** D01 complete.
**Steps:**
1. Send "Write a sample CSV of my top 3 transactions in a code block".
**Expected result:** Triple-backtick block renders as monospaced block with distinct background (per `AttributedString(markdown:)` semantics). Text inside is selectable for copy.
**Bug severity if fails:** Low

### D12 — Markdown: link
**Priority:** P2
**Pre-conditions:** D01 complete.
**Steps:**
1. Provoke a response that includes `[Help Center](https://spentyai.com/help)`.
**Expected result:** Link renders as blue/underlined and is tappable; tapping opens Safari to the URL. Link text shown, raw markdown not visible.
**Bug severity if fails:** Low

### D13 — Long response (800+ words) — selectable, scrollable, no truncation
**Priority:** P0
**Pre-conditions:** D01 complete.
**Steps:**
1. Send "Give me a very detailed 1000-word breakdown of my financial year to date."
**Expected result:** Full response renders; no visible line-limit truncation; user can scroll through the chat to read the whole thing. Long-press anywhere inside the reply activates `textSelection(.enabled)` on `MarkdownText` — selection handles appear, user can copy a range. Scrolling back up re-shows prior messages without layout jitter.
**Bug severity if fails:** Critical

### D14 — Conversation memory referring to earlier context
**Priority:** P0
**Pre-conditions:** D02 answered with a month's spend. D03 answered with previous month.
**Steps:**
1. Send "Which was higher?"
**Expected result:** AI answers by comparing the two months from earlier context. Backend receives the full conversation array. AI does not ask "higher than what?".
**Bug severity if fails:** High

### D15 — Tap a suggested prompt chip (welcome section)
**Priority:** P1
**Pre-conditions:** Empty chat history, welcome section showing 4 suggestion cards.
**Steps:**
1. Tap one of the suggestion rows (e.g. "What did I spend this month?").
**Expected result:** The suggestion text immediately populates the input and is sent via `sendSuggestion()`. User bubble shows the exact suggestion string. Welcome section disappears; conversation begins.
**Bug severity if fails:** Medium

### D16 — Tap inline suggestion chip (after first message)
**Priority:** P1
**Pre-conditions:** At least one message sent.
**Steps:**
1. Horizontally scroll the capsule-chip strip above messages.
2. Tap one chip.
**Expected result:** Chip text is sent as a new user message. No duplicate send on double-tap (disabled state respected).
**Bug severity if fails:** Medium

### D17 — Send empty message
**Priority:** P1
**Pre-conditions:** Chat open, input is empty (or whitespace-only).
**Steps:**
1. Leave input empty.
2. Observe send button state.
3. Type spaces only, observe again.
**Expected result:** Send button disabled (30% opacity, shown by `canSend` computed) in both cases. Pressing return on the keyboard does nothing.
**Bug severity if fails:** Low

### D18 — Backend 500 error path
**Priority:** P1
**Pre-conditions:** Backend is forced to return 500 on `/ai/chat` (QA toggle or network Charles rewrite).
**Steps:**
1. Send any message.
**Expected result:** User bubble remains in the list. `isSending` returns to false. An alert titled "Error" shows the localized backend message or the fallback "Failed to get a response. Please try again." User can retry by sending the same text again. No crash, no stuck typing indicator.
**Bug severity if fails:** High

### D19 — Backend rate-limit (429)
**Priority:** P2
**Pre-conditions:** Backend returns 429.
**Steps:**
1. Send a message.
**Expected result:** Friendly error surfaced via `APIError.localizedDescription` in the Error alert. User message remains visible; retry is possible after the cooldown.
**Bug severity if fails:** Medium

### D20 — Offline behavior
**Priority:** P1
**Pre-conditions:** Turn on Airplane Mode.
**Steps:**
1. Open AI Chat.
2. Type and send "test offline".
**Expected result:** Send fails; error alert or banner shown; message is not duplicated when airplane mode is turned off. Typing indicator is cleared. (Document whether the input is disabled or the error is deferred until send.)
**Bug severity if fails:** Medium

### D21 — Clear history
**Priority:** P1
**Pre-conditions:** At least 3 messages in history.
**Steps:**
1. Tap ellipsis menu → "Clear History".
2. Confirm in the confirmation dialog.
**Expected result:** `DELETE /ai/chat/clear` is called. `messages` array empties; welcome section reappears. Next reload (`loadHistory`) returns an empty messages list (server-side delete succeeded).
**Bug severity if fails:** Medium

### D22 — Close and reopen — history persistence
**Priority:** P1
**Pre-conditions:** Send 2–3 messages.
**Steps:**
1. Tap Close.
2. Re-open AI Chat.
**Expected result:** `loadHistory()` runs in `.task`, messages re-populate from the server in chronological order (reversed on server to chronological on client), scroll jumps to bottom.
**Bug severity if fails:** Medium

### D23 — Speaker toggle ON (regular mode)
**Priority:** P1
**Pre-conditions:** D01 complete. Speaker icon currently shows slash (off).
**Steps:**
1. Tap speaker icon to toggle ON (waveform icon, primary color).
2. Send a text message.
**Expected result:** After the assistant reply arrives, `speechManager.speak()` is invoked. Audio plays through the main speaker (category `.playAndRecord` + `.defaultToSpeaker`). Markdown is stripped before TTS (no "asterisk asterisk" spoken). Text reply also renders in the chat log as usual.
**Bug severity if fails:** Medium

### D24 — Speaker toggle OFF mid-playback
**Priority:** P1
**Pre-conditions:** Speaker ON, TTS is actively playing a long response.
**Steps:**
1. Tap speaker icon to toggle OFF.
**Expected result:** `toggleVoiceResponse()` sets `isVoiceResponseEnabled=false` and calls `speechManager.stopSpeaking()` — audio cuts immediately; synthesizer.stopSpeaking(at: .immediate) is called.
**Bug severity if fails:** Medium

---

# Section 2 — AI Chat: VOICE Mode (fullscreen — the B1 surface area)

### D25 — Enter voice mode first time (permissions flow)
**Priority:** P0
**Pre-conditions:** Microphone + Speech Recognition permissions have never been granted.
**Steps:**
1. Tap the waveform-circle icon in the top-right toolbar.
**Expected result:** `toggleVoiceMode()` → `enterVoiceMode()` triggers iOS permission sheets for Microphone, then Speech Recognition. On grant of both: fullscreen voice view replaces the message list; pulsing concentric circles animate around the mic orb; status text reads "Listening..." (localized). On deny of either: error alert "Microphone and speech recognition permissions are required for voice mode." Voice mode does not activate.
**Bug severity if fails:** Critical

### D26 — English voice query
**Priority:** P0
**Pre-conditions:** Voice mode active, both permissions granted, silence for 1s, then speak.
**Steps:**
1. Say clearly: "How much did I spend this month?"
2. Tap the Send (arrow-up) circle in the bottom bar.
**Expected result:** Live transcription appears beneath the mic orb as the user speaks. On tap Send, `sendVoiceInput()` pushes the transcript as a message. Status changes to "Thinking...". On reply, the last assistant message is rendered in the scrollable MarkdownText panel (max height 260) and TTS plays (en-IN voice because no Devanagari). After TTS completes, `speechManager` re-starts listening automatically.
**Bug severity if fails:** Critical

### D27 — Hinglish voice query — auto-detect to en-IN
**Priority:** P0
**Pre-conditions:** Voice mode active.
**Steps:**
1. Say "kitna kharcha hua is month" (Hindi words in Roman-script, no Devanagari).
**Expected result:** Transcription is Roman-script Hinglish (the recognizer locale is `en-IN` so Hindi words may come through as phonetic English). Assistant reply plays via `AVSpeechSynthesisVoice(language: "en-IN")` — Indian English accent, NOT pure American English. `detectSpeechLanguage` returns `"en-IN"` because no Unicode code points are in the Devanagari block (0x0900–0x097F).
**Bug severity if fails:** High

### D28 — **B1-A: Voice response renders markdown BOLD, not raw asterisks**
**Priority:** P0 — **BLOCKS App Store submission**
**Pre-conditions:** Voice mode active, DerivedData cleared before build install.
**Steps:**
1. Speak "Show my top 3 expenses."
2. Wait for assistant reply to render in the voice-mode response panel.
3. Visually inspect the rendered text and capture a screenshot.
**Expected result:** The response panel uses `MarkdownText(content)` (confirmed in `AIChatView.swift` voice-mode view, ≈ line where `MarkdownText(content)` is inside the ScrollView). `**Transaction Type**` renders bold — NO literal asterisks on either side of the word. Section headers, bullet lists all render as formatted markdown. Only the audio stream strips markdown; the visible text uses AttributedString markdown.
**Bug severity if fails:** Critical — cannot ship

### D29 — **B1-B: Voice response area scrolls, does not truncate**
**Priority:** P0 — **BLOCKS App Store submission**
**Pre-conditions:** Voice mode active, DerivedData cleared.
**Steps:**
1. Ask a question that provokes a 5+ sentence reply (e.g. "Give me a full monthly report").
2. Look at the response area beneath the mic orb.
**Expected result:** Response is wrapped in `ScrollView { ... }` and constrained to `frame(maxHeight: 260)`; the user can swipe/scroll inside the 260-pt box to read the entire reply. Text does NOT cut off mid-word (e.g. "expense..."). No `lineLimit` applied to `MarkdownText`. Scroll indicator appears while scrolling.
**Bug severity if fails:** Critical — cannot ship

### D30 — Hindi Devanagari voice query — hi-IN voice
**Priority:** P0
**Pre-conditions:** Voice mode active. (Note: the `SFSpeechRecognizer` is locked to `en-IN` in code, so Hindi Devanagari speech-to-TEXT accuracy may be poor. This test exercises the TTS path by typing Devanagari in a follow-up if STT fails — see steps.)
**Steps:**
1. If STT can pick it up: say `इस महीने कितना खर्च हुआ`.
2. Fallback (if STT mangles it): exit voice mode, type the Devanagari question, re-enable speaker, send from regular mode.
**Expected result:** Whether via voice or text, when the REPLY contains Devanagari code points, `detectSpeechLanguage` returns `"hi-IN"` and `AVSpeechSynthesisVoice(language: "hi-IN")` is selected. Playback uses Hindi voice (noticeably different phonetics from en-IN). Enhanced / premium voice is preferred when available.
**Bug severity if fails:** High

### D31 — Bullet list renders as bullets (voice mode)
**Priority:** P0
**Pre-conditions:** Voice mode active.
**Steps:**
1. Ask "List my top 3 categories as bullets."
**Expected result:** Response panel renders each line with a bullet glyph (courtesy `AttributedString(markdown:)` full interpretation). NO literal `- ` prefix visible on each line. TTS reads out the items without saying "dash".
**Bug severity if fails:** Critical (same class as B1)

### D32 — Stop TTS mid-playback via speaker toggle
**Priority:** P1
**Pre-conditions:** TTS actively playing in voice mode.
**Steps:**
1. While assistant is speaking, tap the Mute button (mic-slash toggle) OR exit voice mode.
**Expected result:** `stopSpeaking()` called, `synthesizer.stopSpeaking(at: .immediate)` cuts audio within < 200 ms. `isSpeaking` returns to false. No residual echoing.
**Bug severity if fails:** Medium

### D33 — Send second voice prompt while TTS is playing
**Priority:** P1
**Pre-conditions:** TTS playing. Voice mode active.
**Steps:**
1. Unmute mic mid-playback and speak a new question.
2. Tap Send.
**Expected result:** `sendMessage()` is called; the auto-restart listener loop waits for current TTS `isSpeaking` to go false before re-arming the mic, so the new reply's TTS does not overlap the prior one (verified via the `while speechManager.isSpeaking { ... }` loop in `AIChatViewModel.sendMessage`). If user taps mic during current TTS, new utterance preempts correctly (synthesizer re-queues, but `speak()` does not explicitly stop prior — document actual behavior and log as bug if overlapping audio heard).
**Bug severity if fails:** Medium

### D34 — Lock screen during voice playback
**Priority:** P2
**Pre-conditions:** TTS playing in voice mode.
**Steps:**
1. Press the iPhone power button to lock the screen.
2. Wait 10 seconds, unlock.
**Expected result:** Document actual observed behavior: because audio session category is `.playAndRecord` without `.mixWithOthers`, audio will stop on lock unless background audio entitlement is configured. Verify that on unlock, the voice UI returns to a coherent state (not stuck in "Speaking..." if audio is dead). If audio continues on lock, confirm lock-screen Now Playing controls work.
**Bug severity if fails:** Low (document-only — behavior)

### D35 — No microphone permission
**Priority:** P1
**Pre-conditions:** Microphone permission denied at the OS level (Settings → SpentyAI → Microphone OFF).
**Steps:**
1. Tap the waveform icon to enter voice mode.
**Expected result:** `requestPermissions()` returns false for mic; `hasMicrophonePermission` stays false; the guard in `enterVoiceMode` surfaces error: "Microphone and speech recognition permissions are required for voice mode." Voice mode does not activate. User is NOT silently dropped back into text mode without feedback. (Bonus: tapping again while permission is denied should re-prompt — currently the system will only show the request once per install; the app should ideally guide the user to Settings. Document.)
**Bug severity if fails:** Medium

### D36 — No speech recognition permission
**Priority:** P1
**Pre-conditions:** Mic permission granted, Speech Recognition permission denied.
**Steps:**
1. Tap the waveform icon.
**Expected result:** Same error alert, voice mode does not enter; listening never starts.
**Bug severity if fails:** Medium

### D37 — Voice transcription fails on poor signal
**Priority:** P2
**Pre-conditions:** Low-volume / very noisy environment.
**Steps:**
1. Enter voice mode, whisper indistinctly, tap Send.
**Expected result:** `speechManager.transcribedText` may be empty or garbage. If empty: `sendVoiceInput()` restarts listening (per the guard on empty trimmed text) and does NOT send a blank message. If garbage: message goes to backend and AI responds (possibly with a clarification). Send button is disabled when transcription is empty (`disabled(viewModel.speechManager.transcribedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)`).
**Bug severity if fails:** Medium

### D38 — Interruption: phone call arrives mid-listen
**Priority:** P2
**Pre-conditions:** Voice mode listening.
**Steps:**
1. Have someone call the test phone.
**Expected result:** iOS audio-session interruption stops recording; the view does not crash. When the call ends, user can tap the mic button to resume listening. Transcribed text captured before the call is preserved (`transcribedText` is not cleared by the interruption).
**Bug severity if fails:** Low

### D39 — Voice → text fallback (cancel mid-listen)
**Priority:** P1
**Pre-conditions:** Voice mode, listening, transcription has partial text.
**Steps:**
1. Tap the X (exit) button to leave voice mode.
**Expected result:** `exitVoiceMode()` stops listening, stops speaking, clears transcription, hides voice UI, returns to message list + input bar. Keyboard is NOT automatically opened. The partial transcription is DISCARDED by design (resetTranscription called). If the user wants to keep text, they should have tapped Send instead. Document whether that is acceptable or whether the partial should flow into the text field — currently it does not.
**Bug severity if fails:** Medium

### D40 — Mic toggle inside voice mode (mute / unmute)
**Priority:** P1
**Pre-conditions:** Voice mode active, listening.
**Steps:**
1. Tap the mic-slash button (labeled "Mute").
2. Tap it again (labeled "Unmute").
**Expected result:** First tap: `stopListening()` cancels recognition task, tears down audio engine tap, pulsing rings disappear. Second tap: `resetTranscription()` then `startListening()` — rings return, live transcription can resume.
**Bug severity if fails:** Medium

### D41 — Auto-re-listen loop after AI reply (voice mode)
**Priority:** P1
**Pre-conditions:** Voice mode active, speaker default ON.
**Steps:**
1. Send a prompt.
2. Wait for AI reply + TTS to complete.
**Expected result:** After `speechManager.isSpeaking` flips to false, the 500 ms + 200 ms polling loop in `sendMessage` (inside voice-mode branch) triggers `resetTranscription()` + `startListening()`. Rings re-appear automatically; the user can speak the next question without tapping anything.
**Bug severity if fails:** Medium

### D42 — Exit voice mode while TTS is playing
**Priority:** P1
**Pre-conditions:** Voice mode, TTS speaking.
**Steps:**
1. Tap X.
**Expected result:** TTS cuts immediately; listening stops; view switches back to text chat; no audio continues in the background; the last assistant message remains in the chat log for reading.
**Bug severity if fails:** Medium

### D43 — Enhanced voice fallback
**Priority:** P3
**Pre-conditions:** Device does NOT have any `.enhanced` or `.premium` en-IN or hi-IN voice downloaded.
**Steps:**
1. Trigger TTS in both English and Hindi.
**Expected result:** The lookup `speechVoices().first(where: { $0.quality == .enhanced || $0.quality == .premium })` returns nil; code falls back to `AVSpeechSynthesisVoice(language: voiceLang)`; audio still plays with the default system voice for that locale. Do NOT crash; do NOT silent-fail.
**Bug severity if fails:** Low

---

# Section 3 — Email Sync: Gmail Connection

### D44 — Connect Gmail via OAuth (first time)
**Priority:** P0
**Pre-conditions:** No Gmail account connected. User signed in. Email Sync screen open.
**Steps:**
1. Tap the Gmail "Gmail" button (primary style, since `gmailAccounts.isEmpty`).
2. OAuth web view presents; sign in with a Gmail test account; grant scopes.
**Expected result:** `POST /email/gmail/connect` returns `authUrl`. `ASWebAuthenticationSession` opens; after consent, callback to `spentyai://…` fires. `justConnectedProvider = "gmail"` triggers success animation (green checkmark, "Gmail connected"), followed ~2.5 s later by the Sync Date Picker sheet. Gmail account row appears showing email, connected-at timestamp, "Never synced" status badge.
**Bug severity if fails:** Critical

### D45 — OAuth cancelled by user
**Priority:** P1
**Pre-conditions:** D44 in progress.
**Steps:**
1. On the OAuth screen, tap Cancel / dismiss.
**Expected result:** `ASWebAuthenticationSessionError.canceledLogin` is detected — the view model does NOT surface an error alert (filtered out by `!= ASWebAuthenticationSessionError.canceledLogin.rawValue`). No account is added; `isConnecting` returns to false.
**Bug severity if fails:** Medium

### D46 — OAuth returns with `error=` query param
**Priority:** P1
**Pre-conditions:** Simulate backend callback containing `?error=access_denied`.
**Steps:**
1. Run OAuth but force the error parameter in the redirect.
**Expected result:** Error banner "Connection failed: access denied" shows (underscores replaced with spaces). Account is not added.
**Bug severity if fails:** Medium

### D47 — Disconnect Gmail
**Priority:** P1
**Pre-conditions:** At least one Gmail account connected.
**Steps:**
1. Tap Disconnect on the account row.
2. Confirm in the dialog.
**Expected result:** `DELETE /email/gmail/disconnect` is called with the email. Account is removed from the `gmailAccounts` array; success toast "Gmail disconnected successfully" auto-dismisses after 3 s. Synced transactions remain (dialog copy confirms this). Stats re-fetched.
**Bug severity if fails:** Medium

### D48 — Reconnect after disconnect
**Priority:** P2
**Pre-conditions:** Disconnected Gmail via D47.
**Steps:**
1. Tap "Gmail" to reconnect.
2. Complete OAuth.
**Expected result:** Same as D44. Pending-review transactions from the prior connection are not re-extracted; new sync starts from the sync-from-date selected in the picker.
**Bug severity if fails:** Medium

### D49 — Token expired — needs reconnect banner
**Priority:** P1
**Pre-conditions:** Backend reports `needsReconnect=true` for an account (simulate via backend flag).
**Steps:**
1. Open Email Sync.
**Expected result:** Warning banner on that account row: "Token expired, please reconnect" (localized). Status badge shows exclamation + "Needs reconnect". A Reconnect button appears; tapping it invokes the OAuth flow for the correct provider.
**Bug severity if fails:** Medium

### D50 — Sync from a specific start date (2026-04-15)
**Priority:** P0
**Pre-conditions:** Gmail connected but `syncFromDate` is nil (fresh connection).
**Steps:**
1. OAuth flow completes; date picker sheet auto-opens.
2. Tap "Pick a custom date" to expand the graphical date picker.
3. Select **April 15, 2026**.
4. Tap Start Sync; confirm the alert.
**Expected result:** `POST /email/gmail/sync` (or `POST /email/sync/gmail/start`) is called with `syncFromDate` = `2026-04-15T00:00:00Z` (ISO 8601). Backend scans only emails from that date forward. Progress UI shows phase transitions: Connecting → Fetching emails → AI is analyzing → Complete. Totals in stats grid increment.
**Bug severity if fails:** Critical

### D51 — Preset "Last 7 days" selection
**Priority:** P1
**Pre-conditions:** Sync date picker open.
**Steps:**
1. Tap "Last 7 days" preset.
2. Tap Start Sync.
**Expected result:** `pendingSyncDate` is set to 7 days ago. Selected-date summary "Scanning from: <date>" updates live. Sync starts from that date.
**Bug severity if fails:** Medium

### D52 — Preset "Last 30 days" (default)
**Priority:** P1
**Pre-conditions:** Sync date picker freshly opened.
**Steps:**
1. Observe default selection.
**Expected result:** "Last 30 days" is pre-selected (the default `pendingSyncDate = today - 30 days`). Checkmark badge shows on that row. Summary reflects date 30 days prior.
**Bug severity if fails:** Low

### D53 — Preset "Last 90 days"
**Priority:** P1
**Pre-conditions:** Sync date picker open.
**Steps:**
1. Tap "Last 90 days".
**Expected result:** `pendingSyncDate` = today - 90 days; summary updates.
**Bug severity if fails:** Low

### D54 — Preset "Last 6 months"
**Priority:** P1
**Pre-conditions:** Sync date picker open.
**Steps:**
1. Tap "Last 6 months".
**Expected result:** `pendingSyncDate` = today - 180 days; summary updates.
**Bug severity if fails:** Low

### D55 — Future date not allowed in custom picker
**Priority:** P2
**Pre-conditions:** Sync date picker open, custom picker expanded.
**Steps:**
1. Try to select a date after today.
**Expected result:** Disallowed by `in: ...Date()` range. Future dates grayed out in the graphical picker.
**Bug severity if fails:** Low

### D56 — Cancel sync date picker
**Priority:** P2
**Pre-conditions:** Picker open.
**Steps:**
1. Tap Cancel in the nav bar.
**Expected result:** `cancelSyncDatePicker()` called; `showSyncDatePicker=false`, `pendingSyncAccount=nil`. Sheet dismisses; no sync started; account row still shows "Never synced".
**Bug severity if fails:** Low

### D57 — Sync progress UI shows live counts
**Priority:** P0
**Pre-conditions:** Sync actively running, 5 s polling active.
**Steps:**
1. Observe the progress card, account-level stats grid, and AI analyzed/total bar.
**Expected result:** `syncPhase` transitions from `.fetchingEmails` → `.processingAI`; message updates "Fetching emails... N found so far", "AI is analyzing X emails...". Stat cards (Emails, Analyzed, Transactions, Pending approval) increment as the poll loop refreshes every 5 s. Progress bar `analyzed/total` approaches 1.0 and turns green on completion.
**Bug severity if fails:** High

### D58 — Sync complete state
**Priority:** P0
**Pre-conditions:** Sync running, backend finishes.
**Steps:**
1. Wait until backend `isProcessing=false`, `aiPending=0`.
**Expected result:** `syncPhase=.complete` with green checkmark and "All emails processed" message; stat bar turns green with checkmark "AI complete". After 3 s, phase returns to `.idle` and banner disappears. Polling stops.
**Bug severity if fails:** High

### D59 — Sync cancellation — background the app mid-sync
**Priority:** P2
**Pre-conditions:** Sync running.
**Steps:**
1. Background the app during fetch phase.
2. Wait 30 s.
3. Foreground the app.
**Expected result:** Polling is paused while backgrounded; `onDisappear` calls `stopPolling()`. On foreground, `loadAll()` in `.task` reloads stats and resumes polling because `isAnySyncing` is true. Partial results from the backend remain (transactions already extracted stay in pending review).
**Bug severity if fails:** Medium

### D60 — Sync error (backend 5xx)
**Priority:** P1
**Pre-conditions:** Backend `/email/sync` returns 500.
**Steps:**
1. Tap Sync.
**Expected result:** `syncPhase=.failed` with red X and error message. Error banner appears at top ("Sync failed: <message>"). After 3 s, phase returns to idle. Retry is possible by tapping Sync again.
**Bug severity if fails:** High

### D61 — Gmail quota / rate-limit error from Google
**Priority:** P2
**Pre-conditions:** Backend returns a Gmail API error (`userRateLimitExceeded`).
**Steps:**
1. Tap Sync.
**Expected result:** Friendly surfaced error via `handleError`. User can retry after a cooldown (document recommended cooldown).
**Bug severity if fails:** Medium

### D62 — Retry failed AI processing
**Priority:** P1
**Pre-conditions:** Stats show `aiFailed > 0`.
**Steps:**
1. Tap "Retry Failed Emails" in the retry card.
**Expected result:** `POST /email/sync/retry-pending` called. Toast "Processing N pending emails". Polling restarts; AI re-processes those emails. `aiFailed` count decreases as emails re-process successfully.
**Bug severity if fails:** Medium

### D63 — Multiple Gmail accounts
**Priority:** P2
**Pre-conditions:** One Gmail already connected.
**Steps:**
1. Tap "Add another Gmail".
2. Complete OAuth with a different Gmail.
**Expected result:** Two account rows render; each has its own sync controls, sync-from-date, and stats. Sync on one account does not affect the other.
**Bug severity if fails:** Medium

### D64 — Stats grid empty state (connected, zero emails)
**Priority:** P2
**Pre-conditions:** Gmail connected, `totalSynced=0`, not currently syncing.
**Steps:**
1. Observe the Sync Overview card.
**Expected result:** Empty envelope icon, copy "No emails processed yet", "Tap sync to start" hint. Stat grid NOT rendered.
**Bug severity if fails:** Low

### D65 — Pull-to-refresh on Email Sync view
**Priority:** P2
**Pre-conditions:** Email Sync open.
**Steps:**
1. Swipe down to refresh.
**Expected result:** `.refreshable { await viewModel.loadAll() }` re-fetches stats, gmail/outlook status, SMS status concurrently. `lastRefreshedAt` updates; "Updated 2s ago" label refreshes.
**Bug severity if fails:** Low

---

# Section 4 — Strict AI Extraction (uses Gmail sync from 2026-04-15)

> **Rules under test (from `_build_email_analysis_prompt` in `backend/server.py`):**
> - **STEP 1:** Only set `is_transaction=true` when the email describes an actual money movement. Statement summaries, OTPs, marketing, balance reminders, mandate-registration notices → `is_transaction=false`.
> - **STEP 4:** Match to existing categories — leave blank if uncertain (but best-guess allowed per user feedback).
> - **STEP 5:** `is_recurring=true` ONLY with direct evidence: "subscription", "auto-renew", "next billing date", "monthly plan", "standing instruction", "NACH", "UPI AutoPay". Everything else → false. When in doubt → false. Populate `recurrence_date` + `recurring_frequency` only when true.
> - Vendor-based fallback: the vendor-detection helper (lines ≈ 6560–6600 in server.py) may promote `is_recurring=true` for known subscription brands like Netflix, Spotify, Apple, Amazon Prime.

### D-E1 — Netflix renewal → recurring = true
**Priority:** P0
**Pre-conditions:** Gmail connected, sync from 2026-04-15 complete. Inbox contains a Netflix email subject "Your Netflix subscription renews on May 2" or equivalent.
**Steps:**
1. After sync, open Pending Review.
2. Locate the Netflix extraction.
**Expected result:** `is_transaction=true`; `is_recurring=true`; `recurrence_date` = 2 (day of month); `recurring_frequency="monthly"`; `category` = Entertainment (or similar — a guess is allowed); `transaction_type="expense"`; vendor = "Netflix"; amount matches email total. Shows in pending review with a recurring badge.
**Bug severity if fails:** Critical

### D-E2 — Random UPI debit to a person → recurring = false
**Priority:** P0
**Pre-conditions:** Inbox has a UPI debit email (e.g. "₹500 debited to xyz@upi — to Ramesh Kumar").
**Steps:**
1. Inspect the extracted pending transaction.
**Expected result:** `is_recurring=false` (NO explicit subscription keywords). `category` MAY be guessed (e.g. "Other Expenses" or "Transfer") — AI is allowed to guess. The email must NOT be marked recurring just because the user pays this person regularly. `transaction_type="expense"`; amount + description parsed correctly.
**Bug severity if fails:** Critical — violates core rule #1

### D-E3 — Credit card bill payment → transaction_type=transfer
**Priority:** P0
**Pre-conditions:** Inbox has a "Credit card bill paid" confirmation from a bank (e.g. HDFC).
**Steps:**
1. Inspect extraction.
**Expected result:** `transaction_type="transfer"` (NOT expense — the money moved from bank to credit card, both user's own accounts). `from_account` linked to bank; `to_account` linked to credit card (if both accounts known). `is_recurring=false` unless email explicitly says auto-pay / standing instruction.
**Bug severity if fails:** High

### D-E4 — Monthly bank statement summary email → no transaction
**Priority:** P0
**Pre-conditions:** Inbox has a monthly statement notice ("Your March statement is ready — balance ₹45,210, total debits ₹23,000").
**Steps:**
1. Check Pending Review; check backend analyzed emails.
**Expected result:** `is_transaction=false` (statement summary, not a money movement). NOTHING is created in pending review for this email. The email IS recorded as analyzed (`aiAnalyzed` counter increments) but `transactionsCreated` does not.
**Bug severity if fails:** Critical — creates noise that clutters pending review

### D-E5 — OpenAI top-up receipt → guessable category, recurring = false
**Priority:** P1
**Pre-conditions:** Inbox has an OpenAI ("platform.openai.com") top-up or ChatGPT billing email for a one-time credit recharge (NOT subscription language).
**Steps:**
1. Inspect extraction.
**Expected result:** `category` may be "Technology" or "Software" or "Subscriptions" (guessing allowed). `is_recurring=false` because the email does not say "auto-recharge" or "monthly". `transaction_type="expense"`. If a different OpenAI email says "auto-recharge enabled" → `is_recurring=true` + frequency set.
**Bug severity if fails:** High

### D-E6 — UPI refund → transaction_type=income
**Priority:** P1
**Pre-conditions:** Inbox has a UPI refund email (e.g. Amazon refund ₹1,299).
**Steps:**
1. Inspect extraction.
**Expected result:** `transaction_type="income"` (money received). Description includes "Refund" or "Reversal". `is_recurring=false`. If original expense exists and is detectable by transaction ID or reference number, the refund SHOULD link to it (document whether the backend does this; flag as enhancement if not).
**Bug severity if fails:** High

### D-E7 — Zomato / Swiggy order → Food & Dining
**Priority:** P1
**Pre-conditions:** Inbox has a Zomato or Swiggy order confirmation.
**Steps:**
1. Inspect extraction.
**Expected result:** `category="Food & Dining"` (guess allowed). `is_recurring=false` (food orders are not recurring even if frequent). `transaction_type="expense"`. Amount = order total including taxes + delivery.
**Bug severity if fails:** Medium

### D-E8 — Amazon order shipped / ordered → Shopping
**Priority:** P1
**Pre-conditions:** Inbox has an Amazon order confirmation for a non-subscription item.
**Steps:**
1. Inspect extraction.
**Expected result:** `category="Shopping"` (guess). `is_recurring=false`. `amount` = order total (NOT shipping-only or refund-only). `vendor="Amazon"`. Multiple items in one order → ONE transaction with the grand total.
**Bug severity if fails:** Medium

### D-E9 — Uber / Ola ride receipt → Transport
**Priority:** P1
**Pre-conditions:** Inbox has an Uber or Ola ride receipt.
**Steps:**
1. Inspect extraction.
**Expected result:** `category="Transport"` (guess). `is_recurring=false` even if user rides daily. `transaction_type="expense"`. Amount = fare total.
**Bug severity if fails:** Medium

### D-E10 — Electricity bill paid via UPI → Utilities, not recurring
**Priority:** P1
**Pre-conditions:** Inbox has a bill-payment success email (BESCOM / Adani / MSEB) — single payment, no NACH mention.
**Steps:**
1. Inspect extraction.
**Expected result:** `category="Utilities"` (guess). `is_recurring=false` because the email does NOT say "standing instruction" or "auto-pay". If the email explicitly says "auto-pay enabled" or "recurring payment", then `is_recurring=true`.
**Bug severity if fails:** High (recurring rule violation)

### D-E11 — Unknown Indian vendor (obscure merchant) → null or best-guess
**Priority:** P1
**Pre-conditions:** Inbox has a UPI debit from a merchant name the AI has never seen (e.g. "Sri Venkateswara Traders").
**Steps:**
1. Inspect extraction.
**Expected result:** `category=null` or `category="Other Expenses"` (best-guess allowed; null also acceptable if AI is uncertain). `is_recurring=false`. `vendor` set to the merchant name as-is. User can correct both during approval.
**Bug severity if fails:** Medium

### D-E12 — Salary credit → income, recurring only if explicit
**Priority:** P0
**Pre-conditions:** Inbox has a salary credit email (e.g. "₹85,000 credited — Salary for April from ACME Corp").
**Steps:**
1. Inspect extraction.
**Expected result:** `transaction_type="income"`; `category="Salary"` or similar (guess). `is_recurring=true` ONLY IF the email explicitly says "monthly salary" / "salary credit" in a way that implies monthly recurrence. If the email is ambiguous ("₹85,000 credited from ACME"), `is_recurring=false`. User can flip to recurring manually during approval.
**Bug severity if fails:** High

### D-E13 — Promotional email with fake amount → no transaction
**Priority:** P0
**Pre-conditions:** Inbox has a marketing email like "You saved ₹500! Shop now".
**Steps:**
1. Sync; inspect pending review.
**Expected result:** `is_transaction=false`; NO pending transaction created. The ₹500 in the email is a promo, not a money movement. If AI incorrectly extracts it, it's a major false-positive bug.
**Bug severity if fails:** Critical (false-positive pollutes user data)

### D-E14 — Forwarded email chain with multiple transactions
**Priority:** P2
**Pre-conditions:** Inbox has a forwarded chain containing two separate transaction confirmations (e.g. forwarded UPI debits).
**Steps:**
1. Sync; inspect pending review.
**Expected result:** The AI extracts each transaction separately (multiple pending items for that single email), OR extracts only the most recent / most-prominent one — document the actual behavior. All extracted transactions are `pending_review`. User can approve/reject each independently.
**Bug severity if fails:** Medium

### D-E15 — Hindi / Devanagari email body with transaction info
**Priority:** P1
**Pre-conditions:** Inbox has an email body in Devanagari mentioning amount + vendor (e.g. bank notification in Hindi).
**Steps:**
1. Sync; inspect extraction.
**Expected result:** Amount (e.g. ₹1,250) and vendor name correctly parsed regardless of script. `description` may retain Devanagari characters. `category` guessed sensibly. `is_transaction=true` if the email describes a real money movement.
**Bug severity if fails:** High

### D-E16 — Duplicate email (re-sync) must NOT duplicate transactions
**Priority:** P0
**Pre-conditions:** One successful sync produced a transaction for email X.
**Steps:**
1. Trigger sync again with same date range (or push the backend to re-process email X).
2. Inspect pending review and transactions.
**Expected result:** The same `email_id` is idempotent — backend skips re-extraction (based on `email_id` uniqueness key). No duplicate pending-review item. No duplicate posted transaction. Approved transaction count unchanged.
**Bug severity if fails:** Critical (duplicate data is data corruption)

### D-E17 — Currency format variants: "Rs." vs "INR" vs "₹"
**Priority:** P1
**Pre-conditions:** Inbox has three emails, each with a different currency notation for the same amount (e.g. "Rs. 1,500", "INR 1500", "₹1,500").
**Steps:**
1. Sync; inspect each extraction.
**Expected result:** All three yield `amount=1500.0` (or 1500) with `currency="INR"`. Thousands separators handled. No `amount=null` or parse failures.
**Bug severity if fails:** High

### D-E18 — OTP email → no transaction
**Priority:** P1
**Pre-conditions:** Inbox has an OTP email ("Your OTP is 123456 for a ₹2,499 payment").
**Steps:**
1. Sync; inspect.
**Expected result:** `is_transaction=false`. OTP emails are explicitly excluded by STEP 1 of the prompt. The ₹2,499 is NOT extracted as a transaction (the actual success confirmation will come separately).
**Bug severity if fails:** High

### D-E19 — Mandate / auto-pay registration email
**Priority:** P1
**Pre-conditions:** Inbox has a "Mandate registered for ₹599 monthly" email (e.g. UPI AutoPay setup confirmation, no actual debit yet).
**Steps:**
1. Sync; inspect.
**Expected result:** `is_transaction=false`, `is_mandate=true`, mandate_* fields populated (amount, frequency, vendor). No transaction in pending review. A mandate record is created separately (check Mandates section of the app).
**Bug severity if fails:** Medium

### D-E20 — Balance reminder / low balance alert
**Priority:** P2
**Pre-conditions:** Inbox has a "Your balance is low: ₹1,500 remaining" email.
**Steps:**
1. Sync; inspect.
**Expected result:** `is_transaction=false`. No extraction.
**Bug severity if fails:** Medium

### D-E21 — Amazon Prime renewal (known subscription brand fallback)
**Priority:** P1
**Pre-conditions:** Inbox has an Amazon Prime renewal email for ₹1,499/year.
**Steps:**
1. Sync; inspect.
**Expected result:** `is_recurring=true` (vendor-detection helper at `~line 6570` promotes known subscription brands like Amazon Prime even if keywords are sparse). `recurring_frequency="yearly"`. `category="Entertainment"` or "Subscriptions". Recurrence date derived from renewal date.
**Bug severity if fails:** High

### D-E22 — One-off insurance premium → not recurring
**Priority:** P2
**Pre-conditions:** Inbox has a one-time insurance premium receipt (no auto-renew language).
**Steps:**
1. Sync; inspect.
**Expected result:** Per the rule "one-off EMIs, insurance one-time premiums → `is_recurring=false`". Category = "Insurance" (guess allowed).
**Bug severity if fails:** Medium

### D-E23 — Recurring SIP / mutual fund debit with NACH language
**Priority:** P1
**Pre-conditions:** Inbox has a "₹5,000 debited via NACH for SIP — next due 5th of every month" email.
**Steps:**
1. Sync; inspect.
**Expected result:** `is_recurring=true` (NACH is explicit per STEP 5 rules); `recurrence_date=5`; `recurring_frequency="monthly"`; category = "Investments".
**Bug severity if fails:** High

### D-E24 — Zero-amount / failed-payment email
**Priority:** P2
**Pre-conditions:** Inbox has a "Payment failed — please retry" email with amount shown.
**Steps:**
1. Sync; inspect.
**Expected result:** `is_transaction=false` (money did not move). No extraction.
**Bug severity if fails:** Medium

### D-E25 — Amount-only email without vendor context (ambiguous)
**Priority:** P2
**Pre-conditions:** Inbox has a minimal SMS-forwarded email "Alert: ₹3,500 debited" with no merchant.
**Steps:**
1. Sync; inspect.
**Expected result:** Per the strict rule, when in doubt, leave fields blank. `category=null` or "Other Expenses"; `vendor=null`; `is_recurring=false`. `is_transaction=true` (money moved) so it goes to pending review for user to enrich.
**Bug severity if fails:** Medium

### D-E26 — Email with multiple amounts (order + discount + total)
**Priority:** P2
**Pre-conditions:** Inbox has an e-comm email showing subtotal ₹1,200, discount ₹200, delivery ₹40, total ₹1,040.
**Steps:**
1. Sync; inspect.
**Expected result:** `amount=1040` (grand total), NOT 1200 or 40. Parsing picks the final "Total" / "Grand Total" line.
**Bug severity if fails:** High

### D-E27 — Email containing only pre-authorization hold
**Priority:** P2
**Pre-conditions:** Inbox has a "₹500 temporarily held for fuel purchase" email.
**Steps:**
1. Sync; inspect.
**Expected result:** Document actual behavior: holds are not settled transactions. Ideally `is_transaction=false`, but document if AI extracts the hold as a transaction (flag as enhancement).
**Bug severity if fails:** Low

---

# Section 5 — Approval Flow for AI-extracted Transactions

### D66 — Pending review list renders all extracted
**Priority:** P0
**Pre-conditions:** Sync produced ≥ 5 pending transactions.
**Steps:**
1. Tap "Pending approval" card.
**Expected result:** `PendingReviewView` opens; `loadPendingReview()` fetches; all pending items shown with description, amount, category guess, date, source chip. Select-all checkbox available. Each item has edit, source-view, approve, reject affordances.
**Bug severity if fails:** Critical

### D67 — Tap pending → edit category → approve
**Priority:** P0
**Pre-conditions:** D66 complete, at least one pending item exists.
**Steps:**
1. Tap a pending transaction.
2. Tap Edit.
3. Change category; save.
4. Tap Approve.
**Expected result:** `PUT /email/pending/<id>` persists the new category. On approve, `POST /email/pending/<id>/approve` flips the transaction to `status=approved`; it leaves the pending list and appears in the main Transactions screen with the user-edited category retained. `selectedTransactionIds` removes this id.
**Bug severity if fails:** Critical

### D68 — Edit amount during approval
**Priority:** P1
**Pre-conditions:** Pending item with auto-extracted amount.
**Steps:**
1. Tap Edit → change the amount → save.
**Expected result:** Amount updates. Approved transaction reflects the user-edited amount, not the AI-extracted one.
**Bug severity if fails:** High

### D69 — Edit account during approval
**Priority:** P1
**Pre-conditions:** Pending item with or without `accountId`.
**Steps:**
1. Edit → choose an account → save.
**Expected result:** Account linked; approved transaction shows the correct account; dashboard balance recomputes.
**Bug severity if fails:** Medium

### D70 — Edit transaction type (expense → income) during approval
**Priority:** P1
**Pre-conditions:** Pending item AI marked as expense but user knows it's income.
**Steps:**
1. Edit → change type to income → save → approve.
**Expected result:** Transaction type saved; dashboard recomputes income vs expense correctly.
**Bug severity if fails:** High

### D71 — User toggles is_recurring ON during approval — preserved
**Priority:** P0
**Pre-conditions:** AI marked a transaction `is_recurring=false`; user knows it's recurring.
**Steps:**
1. Edit → toggle recurring ON → choose frequency → save.
2. Approve.
**Expected result:** User's recurring choice is persisted AS-IS. AI's original guess is overridden. On re-sync or re-analysis, the user's value must NOT be silently flipped back by the AI.
**Bug severity if fails:** Critical (violates feedback rule: user edit > AI guess)

### D72 — User toggles is_recurring OFF (AI over-tagged)
**Priority:** P0
**Pre-conditions:** AI marked something recurring but it isn't (e.g. false vendor match).
**Steps:**
1. Edit → toggle recurring OFF → save → approve.
**Expected result:** User's OFF choice persists. On future syncs, AI must not re-promote this to recurring.
**Bug severity if fails:** Critical

### D73 — Reject a pending transaction
**Priority:** P0
**Pre-conditions:** Pending item exists (e.g. a false-positive from a promo email).
**Steps:**
1. Swipe or tap Reject on the item.
**Expected result:** `POST /email/pending/<id>/reject` called. Item removed from pending list. Not created as a transaction. Stats `pendingReview` decreases; `transactionsCreated` unchanged. Optionally the reject reason is logged for future AI feedback.
**Bug severity if fails:** High

### D74 — Bulk approve all
**Priority:** P1
**Pre-conditions:** ≥ 5 pending items.
**Steps:**
1. Tap Select All.
2. Tap Bulk Approve.
**Expected result:** `POST /email/pending/bulk-approve` with all IDs. All items move to approved; pending list empties; toast "Approved N transactions" shows. Partial-failure case: items that fail server-side remain in the list with an error indicator; approved ones are removed.
**Bug severity if fails:** Medium

### D75 — Bulk approve with some edits — user edits preserved
**Priority:** P1
**Pre-conditions:** User edited 2 of 5 items before bulk-selecting them.
**Steps:**
1. Bulk approve all 5.
**Expected result:** The 2 edited items retain the user's edits; the 3 un-edited use AI values. No user data is overwritten by bulk approve.
**Bug severity if fails:** High

### D76 — Bulk reject all
**Priority:** P2
**Pre-conditions:** ≥ 3 pending items.
**Steps:**
1. Select All, Bulk Reject.
**Expected result:** All items removed; none become transactions; toast "Rejected N transactions".
**Bug severity if fails:** Medium

### D77 — View source of pending transaction
**Priority:** P1
**Pre-conditions:** Pending item has a `sourceId`.
**Steps:**
1. Tap "View Source" on the item.
**Expected result:** `GET /email/source/<id>` fetches the original email body. Source sheet shows subject, from, date, full HTML or stripped text. User can visually verify AI's extraction against the source.
**Bug severity if fails:** Medium

### D78 — Pending list empty state
**Priority:** P2
**Pre-conditions:** Zero pending.
**Steps:**
1. Open Pending Review.
**Expected result:** Empty state copy ("All caught up!" or equivalent). No crashes; Select All disabled.
**Bug severity if fails:** Low

### D79 — Pending items never affect dashboard / cashflow
**Priority:** P0
**Pre-conditions:** 10 pending items, 50 approved transactions.
**Steps:**
1. Open Dashboard, Cashflow, Reports.
**Expected result:** All numbers computed from `status=approved` only. Pending amounts are NOT included in This Month spend, Net Worth, or any projection. (This enforces the MEMORY rule "Only approved transactions in all calculations".)
**Bug severity if fails:** Critical (violates MEMORY rule — pending must never affect calcs)

### D80 — Approved transaction appears on Transactions screen
**Priority:** P0
**Pre-conditions:** Approve a pending item from D67.
**Steps:**
1. Navigate to Transactions.
**Expected result:** Newly approved transaction shows at the top (by date). Category, amount, account, recurring flag all match the approved state. Edit / delete from Transactions still works normally.
**Bug severity if fails:** High

### D81 — Re-sync does not re-create an already-approved transaction
**Priority:** P0
**Pre-conditions:** Email X was extracted, edited, and approved yesterday.
**Steps:**
1. Trigger another sync for the same date range today.
**Expected result:** Backend idempotency on `email_id` prevents re-extraction. The already-approved transaction stays untouched; no new pending item is generated for email X.
**Bug severity if fails:** Critical

### D82 — Re-sync does not re-create an already-rejected transaction
**Priority:** P1
**Pre-conditions:** User rejected the extraction for email Y.
**Steps:**
1. Re-sync.
**Expected result:** Email Y's extraction is NOT resurrected. Ideally backend remembers the reject state and skips re-extraction OR re-extracts to pending but not to approved.
**Bug severity if fails:** High

---

# Appendix — Coverage matrix

| Area | Test IDs | Count |
|---|---|---|
| AI Chat regular mode | D01–D24 | 24 |
| AI Chat voice mode (B1 area) | D25–D43 | 19 |
| Email Sync / Gmail connection | D44–D65 | 22 |
| Strict AI extraction | D-E1 – D-E27 | 27 |
| Approval flow | D66–D82 | 17 |
| **Total** | | **109** |

## Release gate

- All P0 tests must pass before App Store submission.
- **D28 (B1-A) and D29 (B1-B) must pass** — these are the 2026-04-24 handoff blockers.
- **D71, D72, D-E1, D-E2, D-E4, D-E13, D-E16, D81 must pass** — these enforce the strict-recurring and pending-review rules from user feedback that determine AI correctness on real user data.
- Any P1 failure triggers a fix-and-retest cycle before sign-off.
