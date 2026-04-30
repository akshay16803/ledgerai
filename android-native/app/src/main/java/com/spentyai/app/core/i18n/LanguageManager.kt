package com.spentyai.app.core.i18n

import android.content.Context
import android.content.res.Configuration
import androidx.compose.runtime.compositionLocalOf
import java.util.Locale

/**
 * Language preference + locale wrapping for SpentyAI Android.
 *
 * Mirrors the API surface of iOS `LocalizationManager.shared`:
 *   - `currentLanguage` ("en" / "hi"), persisted in SharedPreferences
 *   - `isHindi` convenience flag
 *   - `toggle()` switches between en and hi
 *
 * The actual swap happens by:
 *   1. Persisting the new code to `lang_prefs`.
 *   2. `MainActivity.attachBaseContext` re-wraps the base Context with a
 *      Configuration whose `locales` list starts with the chosen locale,
 *      which makes `stringResource(R.string.x)` pull from the right
 *      `values-xx/strings.xml` automatically.
 *   3. Caller invokes `Activity.recreate()` so any composition picks the
 *      new resource bundle.
 *
 * No dependency on androidx.appcompat - pure platform APIs only.
 */
object LanguageManager {

    private const val PREFS = "lang_prefs"
    private const val KEY_LANGUAGE = "app_language"

    const val LANG_EN = "en"
    const val LANG_HI = "hi"

    fun currentLanguage(context: Context): String {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getString(KEY_LANGUAGE, LANG_EN) ?: LANG_EN
    }

    fun isHindi(context: Context): Boolean = currentLanguage(context) == LANG_HI

    fun setLanguage(context: Context, code: String) {
        val normalized = if (code == LANG_HI) LANG_HI else LANG_EN
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LANGUAGE, normalized)
            .apply()
    }

    fun toggle(context: Context) {
        setLanguage(context, if (isHindi(context)) LANG_EN else LANG_HI)
    }

    /**
     * Wraps `base` so its Resources / Configuration use the chosen locale.
     * Call from `Activity.attachBaseContext(newBase)` BEFORE super.onCreate.
     */
    fun wrap(base: Context): Context {
        val code = currentLanguage(base)
        val locale = Locale(code)
        Locale.setDefault(locale)

        val config = Configuration(base.resources.configuration)
        config.setLocale(locale)
        config.setLocales(android.os.LocaleList(locale))
        return base.createConfigurationContext(config)
    }
}

/**
 * CompositionLocal that exposes the current language to Composables that
 * want to react inside a single composition (e.g. show the language toggle
 * label as the *opposite* of the current language). For most call-sites
 * `stringResource(R.string.x)` is enough — Android resolves the right
 * `values-xx/` automatically once the Activity context is wrapped.
 */
val LocalAppLanguage = compositionLocalOf { LanguageManager.LANG_EN }
