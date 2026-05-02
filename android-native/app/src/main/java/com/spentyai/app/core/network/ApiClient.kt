package com.spentyai.app.core.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.spentyai.app.BuildConfig
import com.spentyai.app.core.auth.TokenStore
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNamingStrategy
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.ResponseBody.Companion.toResponseBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

class ApiClient(private val tokenStore: TokenStore) {

    @OptIn(ExperimentalSerializationApi::class)
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
        encodeDefaults = true
        // Most endpoints (accounts, transactions, categories, …) return snake_case
        // JSON. SnakeCase strategy transforms @SerialName("accountId") to also accept
        // "account_id" as an alternative name. A small number of endpoints respond
        // with camelCase JSON (e.g. /api/statements/list returning statementId,
        // accountName, …). For those models, @JsonNames is added on each property to
        // also recognize the camelCase variant — so both styles deserialize safely.
        namingStrategy = JsonNamingStrategy.SnakeCase
    }

    private val authInterceptor = Interceptor { chain ->
        val requestBuilder = chain.request().newBuilder()
            .addHeader("Content-Type", "application/json")
            .addHeader("Accept", "application/json")
            .addHeader("X-Platform", "android")

        val token = tokenStore.getToken()
        if (token != null) {
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }

        chain.proceed(requestBuilder.build())
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BODY
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
    }

    /**
     * Normalize all JSON response keys to snake_case before kotlinx-serialization
     * sees them. The backend returns mixed casing — most endpoints use snake_case
     * (`account_id`, `transaction_type`, …) but a few return camelCase
     * (`statementId`, `accountName`, …). Our global JSON config uses
     * `JsonNamingStrategy.SnakeCase` which only handles the snake_case shape.
     * Without this interceptor, every camelCase response field silently fails
     * to map (Statement.id is empty → LazyColumn key collision crash, plus
     * tap-to-detail produces an invalid `statement_detail/` route).
     *
     * The interceptor walks the JSON tree once per response and rewrites every
     * object key from camelCase to snake_case while leaving values untouched.
     */
    private val jsonKeyNormalizer = Interceptor { chain ->
        val response = chain.proceed(chain.request())
        val body = response.body ?: return@Interceptor response
        val mt = body.contentType()
        // Apply only to JSON responses
        if (mt?.subtype?.contains("json", ignoreCase = true) != true) return@Interceptor response
        val raw = body.string()
        if (raw.isBlank()) {
            return@Interceptor response.newBuilder().body("".toResponseBody(mt)).build()
        }
        val rewritten = try {
            val element = json.parseToJsonElement(raw)
            normalizeKeys(element).toString()
        } catch (e: Exception) {
            // If parsing fails (non-JSON / malformed), pass through untouched.
            raw
        }
        response.newBuilder().body(rewritten.toResponseBody(mt)).build()
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(jsonKeyNormalizer)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    companion object {
        private fun camelToSnake(input: String): String {
            // Already snake_case (or single word) — leave unchanged.
            if (input.none { it.isUpperCase() }) return input
            val sb = StringBuilder(input.length + 4)
            for ((i, ch) in input.withIndex()) {
                if (ch.isUpperCase()) {
                    if (i > 0 && input[i - 1] != '_') sb.append('_')
                    sb.append(ch.lowercaseChar())
                } else {
                    sb.append(ch)
                }
            }
            return sb.toString()
        }

        private fun normalizeKeys(element: JsonElement): JsonElement = when (element) {
            is JsonObject -> buildJsonObject {
                for ((key, value) in element) {
                    put(camelToSnake(key), normalizeKeys(value))
                }
            }
            is JsonArray -> JsonArray(element.map { normalizeKeys(it) })
            else -> element
        }
    }

    private val retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL + "/")
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val endpoints: ApiEndpoints = retrofit.create(ApiEndpoints::class.java)

    suspend fun <T> safeApiCall(call: suspend () -> Response<T>): ApiResult<T> {
        return try {
            val response = call()
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null) {
                    ApiResult.Success(body)
                } else {
                    ApiResult.Failure(ApiError.Unknown("Empty response body"))
                }
            } else {
                when (response.code()) {
                    401 -> {
                        tokenStore.clearToken()
                        ApiResult.Failure(ApiError.Unauthorized)
                    }
                    else -> {
                        val errorBody = response.errorBody()?.string()
                        ApiResult.Failure(ApiError.HttpError(response.code(), errorBody))
                    }
                }
            }
        } catch (e: java.net.UnknownHostException) {
            ApiResult.Failure(ApiError.NoConnection)
        } catch (e: java.net.ConnectException) {
            ApiResult.Failure(ApiError.NoConnection)
        } catch (e: java.net.SocketTimeoutException) {
            ApiResult.Failure(ApiError.Unknown("Request timed out. Please try again."))
        } catch (e: kotlinx.serialization.SerializationException) {
            ApiResult.Failure(ApiError.DecodingError(e))
        } catch (e: Exception) {
            ApiResult.Failure(ApiError.NetworkError(e))
        }
    }
}
