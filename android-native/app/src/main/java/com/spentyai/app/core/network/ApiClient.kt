package com.spentyai.app.core.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.spentyai.app.BuildConfig
import com.spentyai.app.core.auth.TokenStore
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

class ApiClient(private val tokenStore: TokenStore) {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = true
        encodeDefaults = true
        namingStrategy = kotlinx.serialization.json.JsonNamingStrategy.SnakeCase
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

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

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
        } catch (e: kotlinx.serialization.SerializationException) {
            ApiResult.Failure(ApiError.DecodingError(e))
        } catch (e: Exception) {
            ApiResult.Failure(ApiError.NetworkError(e))
        }
    }
}
