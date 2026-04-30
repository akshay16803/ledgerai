# ===========================================================================
#  SpentyAI Android - Production R8/ProGuard rules.
#  buildTypes.release.isMinifyEnabled=true and isShrinkResources=true,
#  so anything that relies on reflection MUST be kept here or it will
#  silently break in the signed release build.
# ===========================================================================

# Keep generic source-file / line numbers for crash reports.
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile

# ---------------------------------------------------------------------------
# Retrofit 2 + OkHttp + kotlinx-serialization-converter
# ---------------------------------------------------------------------------
-keepattributes Signature
-keepattributes Exceptions
-keepattributes *Annotation*
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeVisibleParameterAnnotations
-keepattributes EnclosingMethod
-keepattributes InnerClasses

-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response

-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

# Retrofit's Kotlin support reads continuations via reflection.
-keepclassmembers,allowshrinking,allowobfuscation class kotlin.coroutines.Continuation
-if interface * { @retrofit2.http.* <methods>; }
-keep,allowobfuscation interface <1>

-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ---------------------------------------------------------------------------
# Kotlinx Serialization
#   Synthetic `$serializer` companions and Companion fields are looked up
#   reflectively when @Serializable classes are decoded.
# ---------------------------------------------------------------------------
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep every $serializer Spenty generates, plus the Companion they pair with.
-keep,includedescriptorclasses class com.spentyai.app.**$$serializer { *; }
-keepclassmembers class com.spentyai.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.spentyai.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep all data / response models - they're only referenced via JSON parsing.
-keep class com.spentyai.app.core.models.** { *; }
-keep class com.spentyai.app.**.model.** { *; }
-keep class com.spentyai.app.**.models.** { *; }

# Keep our network endpoints interface (Retrofit + serializers depend on it).
-keep interface com.spentyai.app.core.network.** { *; }
-keep class com.spentyai.app.core.network.** { *; }

# ---------------------------------------------------------------------------
# Google Play Billing
#   Reflection-loaded by the billing library; without these, IAP flows
#   fail to bind to the Play Store service in release builds.
# ---------------------------------------------------------------------------
-keep class com.android.billingclient.** { *; }
-keep interface com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# ---------------------------------------------------------------------------
# Google Play Services Auth (Google Sign-In)
# ---------------------------------------------------------------------------
-keep class com.google.android.gms.** { *; }
-keep interface com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# ---------------------------------------------------------------------------
# AndroidX Security Crypto (EncryptedSharedPreferences)
#   Tink keysets are decoded reflectively at startup.
# ---------------------------------------------------------------------------
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.crypto.tink.**
-keep class androidx.security.crypto.** { *; }

# ---------------------------------------------------------------------------
# Jetpack Compose
#   Compose runtime + tooling pull constructors via reflection in some
#   tooling paths; the BOM ships its own consumer rules but we add safety
#   net for our @Composable bodies.
# ---------------------------------------------------------------------------
-keep class androidx.compose.runtime.** { *; }
-keep class androidx.compose.ui.tooling.** { *; }
-dontwarn androidx.compose.**

# ---------------------------------------------------------------------------
# Coil (image loading) - depends on OkHttp; mostly reflection-free, but
# keep its public classes to avoid surprise NoSuchMethodErrors in release.
# ---------------------------------------------------------------------------
-keep class coil.** { *; }
-dontwarn coil.**

# ---------------------------------------------------------------------------
# Coroutines
# ---------------------------------------------------------------------------
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# ---------------------------------------------------------------------------
# Application class + Activity entry point - keep their fully-qualified
# names so the manifest can still resolve them after R8 runs.
# ---------------------------------------------------------------------------
-keep class com.spentyai.app.SpentyApp { *; }
-keep class com.spentyai.app.MainActivity { *; }
