package com.spentyai.app.features.aichat

import com.spentyai.app.core.models.ChatMessage
import com.spentyai.app.core.models.ChatRole
import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class AIChatRepository(private val apiClient: ApiClient) {

    suspend fun sendMessage(
        text: String,
        conversation: List<ChatMessage>,
        voiceMode: Boolean = false,
    ): ApiResult<ChatMessage> {
        val body = buildJsonObject {
            put("message", text)
            // Tell the backend the user is in fullscreen voice mode so it
            // shortens the SPOKEN portion of the reply (avoids reading every
            // field of a transaction confirmation line-by-line).
            put("voice_mode", voiceMode)
            put("conversation", buildJsonArray {
                conversation.forEach { msg ->
                    add(buildJsonObject {
                        put("role", when (msg.role) {
                            ChatRole.USER -> "user"
                            ChatRole.ASSISTANT -> "assistant"
                            ChatRole.SYSTEM -> "system"
                        })
                        put("content", msg.content)
                    })
                }
            })
        }
        return apiClient.safeApiCall { apiClient.endpoints.sendChatMessage(body) }
    }

    suspend fun loadHistory(): ApiResult<List<ChatMessage>> {
        return apiClient.safeApiCall { apiClient.endpoints.getChatHistory() }
    }

    suspend fun clearHistory(): ApiResult<Unit> {
        // No dedicated clear endpoint in existing API, use history call as placeholder
        return ApiResult.Success(Unit)
    }

    fun getDefaultSuggestions(): List<String> {
        return listOf(
            "What did I spend this month?",
            "Show my top expenses",
            "What's my net worth?",
            "Create an invoice for..."
        )
    }
}
