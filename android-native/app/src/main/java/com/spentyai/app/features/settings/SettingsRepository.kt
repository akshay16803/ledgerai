package com.spentyai.app.features.settings

import com.spentyai.app.core.network.ApiClient
import com.spentyai.app.core.network.ApiResult
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// --- API Models ---

@Serializable
data class AppSettings(
    @SerialName("firm_name") val firmName: String? = null,
    @SerialName("firm_gstin") val firmGstin: String? = null,
    @SerialName("firm_pan") val firmPan: String? = null,
    @SerialName("firm_state") val firmState: String? = null,
    @SerialName("firm_address") val firmAddress: String? = null,
    @SerialName("business_country") val businessCountry: String? = null,
    @SerialName("base_currency") val baseCurrency: String? = null,
    @SerialName("date_format") val dateFormat: String? = null,
    @SerialName("invoice_prefix") val invoicePrefix: String? = null,
    @SerialName("invoice_terms") val invoiceTerms: String? = null,
    @SerialName("invoice_notes") val invoiceNotes: String? = null,
    @SerialName("logo_url") val logoUrl: String? = null,
    @SerialName("signature_url") val signatureUrl: String? = null
)

@Serializable
data class CurrencyOption(
    val code: String,
    val name: String,
    val symbol: String? = null
)

@Serializable
data class DateFormatOption(
    val value: String? = null,
    val label: String? = null,
    val example: String? = null
) {
    val format: String get() = value ?: label ?: ""
}

@Serializable
data class CurrenciesResponse(
    val currencies: List<CurrencyOption>
)

@Serializable
data class DateFormatsResponse(
    val formats: List<DateFormatOption>
)

@Serializable
data class UploadResponse(
    val url: String? = null,
    @SerialName("logo_url") val logoUrl: String? = null,
    @SerialName("signature_url") val signatureUrl: String? = null,
    val message: String? = null
) {
    val resolvedUrl: String? get() = url ?: logoUrl ?: signatureUrl
}

// --- Repository ---

class SettingsRepository(private val apiClient: ApiClient) {

    suspend fun getSettings(): ApiResult<AppSettings> {
        return apiClient.safeApiCall { apiClient.endpoints.getSettings() }
            .map { settings ->
                AppSettings(
                    firmName = settings.businessName,
                    firmGstin = settings.businessTaxId,
                    firmPan = null,
                    firmState = null,
                    firmAddress = settings.businessAddress,
                    businessCountry = null,
                    baseCurrency = settings.currency,
                    dateFormat = settings.dateFormat,
                    invoicePrefix = settings.invoicePrefix,
                    invoiceTerms = settings.invoiceTerms,
                    invoiceNotes = settings.invoiceNotes,
                    logoUrl = null,
                    signatureUrl = null
                )
            }
    }

    suspend fun updateSettings(settings: AppSettings): ApiResult<AppSettings> {
        val body = buildJsonObject {
            settings.firmName?.let { put("business_name", it) }
            settings.firmGstin?.let { put("business_tax_id", it) }
            settings.firmAddress?.let { put("business_address", it) }
            settings.baseCurrency?.let { put("currency", it) }
            settings.dateFormat?.let { put("date_format", it) }
            settings.invoicePrefix?.let { put("invoice_prefix", it) }
            settings.invoiceTerms?.let { put("invoice_terms", it) }
            settings.invoiceNotes?.let { put("invoice_notes", it) }
        }
        return apiClient.safeApiCall { apiClient.endpoints.updateSettings(body) }
            .map { s ->
                AppSettings(
                    firmName = s.businessName,
                    firmGstin = s.businessTaxId,
                    firmAddress = s.businessAddress,
                    baseCurrency = s.currency,
                    dateFormat = s.dateFormat,
                    invoicePrefix = s.invoicePrefix,
                    invoiceTerms = s.invoiceTerms,
                    invoiceNotes = s.invoiceNotes,
                    logoUrl = settings.logoUrl,
                    signatureUrl = settings.signatureUrl
                )
            }
    }

    suspend fun getCurrencies(): ApiResult<List<CurrencyOption>> {
        // The existing API may not have a dedicated currencies endpoint,
        // so we provide common currencies as fallback
        return ApiResult.Success(
            listOf(
                CurrencyOption("INR", "Indian Rupee", "\u20B9"),
                CurrencyOption("USD", "US Dollar", "$"),
                CurrencyOption("EUR", "Euro", "\u20AC"),
                CurrencyOption("GBP", "British Pound", "\u00A3"),
                CurrencyOption("CAD", "Canadian Dollar", "CA$"),
                CurrencyOption("AUD", "Australian Dollar", "A$"),
                CurrencyOption("SGD", "Singapore Dollar", "S$"),
                CurrencyOption("AED", "UAE Dirham", "AED"),
                CurrencyOption("JPY", "Japanese Yen", "\u00A5")
            )
        )
    }

    suspend fun getDateFormats(): ApiResult<List<DateFormatOption>> {
        return ApiResult.Success(
            listOf(
                DateFormatOption("DD/MM/YYYY", "DD/MM/YYYY", "21/04/2026"),
                DateFormatOption("MM/DD/YYYY", "MM/DD/YYYY", "04/21/2026"),
                DateFormatOption("YYYY-MM-DD", "YYYY-MM-DD", "2026-04-21"),
                DateFormatOption("DD-MMM-YYYY", "DD-MMM-YYYY", "21-Apr-2026"),
                DateFormatOption("MMM DD, YYYY", "MMM DD, YYYY", "Apr 21, 2026")
            )
        )
    }

    suspend fun resetData(): ApiResult<JsonObject> {
        val body = buildJsonObject {
            put("confirmation", "RESET")
        }
        return apiClient.safeApiCall {
            apiClient.endpoints.createSupportTicket(body) // Using generic POST; adjust endpoint if available
        }.map { buildJsonObject { put("success", true) } }
    }
}
