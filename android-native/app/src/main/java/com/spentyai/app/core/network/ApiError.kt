package com.spentyai.app.core.network

import kotlinx.serialization.Serializable

@Serializable
data class ApiErrorResponse(
    val error: String? = null,
    val message: String? = null,
    val detail: String? = null
)

sealed class ApiError : Exception() {
    data class HttpError(val code: Int, val errorBody: String?) : ApiError() {
        override val message: String
            get() = "HTTP $code: ${errorBody ?: "Unknown error"}"
    }

    data class NetworkError(val throwable: Throwable) : ApiError() {
        override val message: String
            get() = throwable.localizedMessage ?: "Network error"
    }

    data class DecodingError(val throwable: Throwable) : ApiError() {
        override val message: String
            get() = "Failed to decode response: ${throwable.localizedMessage}"
    }

    object Unauthorized : ApiError() {
        override val message: String
            get() = "Unauthorized. Please sign in again."
    }

    object NoConnection : ApiError() {
        override val message: String
            get() = "No internet connection."
    }

    data class Unknown(override val message: String = "An unknown error occurred") : ApiError()
}

sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Failure(val error: ApiError) : ApiResult<Nothing>()

    val isSuccess: Boolean get() = this is Success
    val isFailure: Boolean get() = this is Failure

    fun getOrNull(): T? = when (this) {
        is Success -> data
        is Failure -> null
    }

    fun getOrThrow(): T = when (this) {
        is Success -> data
        is Failure -> throw error
    }

    fun <R> map(transform: (T) -> R): ApiResult<R> = when (this) {
        is Success -> Success(transform(data))
        is Failure -> this
    }
}
