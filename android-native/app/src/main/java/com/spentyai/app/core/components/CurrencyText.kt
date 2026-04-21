package com.spentyai.app.core.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import com.spentyai.app.core.theme.SpentyError
import com.spentyai.app.core.theme.SpentySuccess
import com.spentyai.app.core.theme.SpentyType
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

enum class CurrencySize {
    LARGE, MEDIUM, SMALL
}

@Composable
fun CurrencyText(
    amount: Double,
    currencyCode: String = "USD",
    size: CurrencySize = CurrencySize.SMALL,
    colorBySign: Boolean = false,
    modifier: Modifier = Modifier,
    overrideColor: Color? = null
) {
    val textStyle: TextStyle = when (size) {
        CurrencySize.LARGE -> SpentyType.AmountLarge
        CurrencySize.MEDIUM -> SpentyType.AmountMedium
        CurrencySize.SMALL -> SpentyType.AmountSmall
    }

    val color = overrideColor ?: when {
        colorBySign && amount > 0 -> SpentySuccess
        colorBySign && amount < 0 -> SpentyError
        else -> MaterialTheme.colorScheme.onSurface
    }

    val formatted = formatCurrency(amount, currencyCode)

    Text(
        text = formatted,
        style = textStyle,
        color = color,
        modifier = modifier
    )
}

fun formatCurrency(amount: Double, currencyCode: String = "USD"): String {
    return try {
        val format = NumberFormat.getCurrencyInstance(Locale.US)
        format.currency = Currency.getInstance(currencyCode)
        format.maximumFractionDigits = 2
        format.minimumFractionDigits = 2
        format.format(amount)
    } catch (e: Exception) {
        "$${String.format("%.2f", amount)}"
    }
}
