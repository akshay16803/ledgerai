# SpentyAI Android — Production-Readiness Handoff
Generated: 2026-05-01

This pass shipped what could be fixed in code (proguard, manifest, backup
rules, network security config, permission trim). The items below need
**manual action** outside the repo before the AAB can be uploaded to Play
Console.

---

## Done in code (commit `chore(android/release): production-readiness ...`)

- [x] **Permissions trim** — removed `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE`,
      `WRITE_EXTERNAL_STORAGE` from `AndroidManifest.xml`. They were declared
      but no Kotlin code paths request them — the app uses `PickVisualMedia`
      (system PhotoPicker) which needs no storage permissions.
- [x] **Optional hardware features** — added `<uses-feature camera/microphone
      required="false">` so emulators / no-camera tablets can still install.
- [x] **Network security config** — added `res/xml/network_security_config.xml`
      enforcing `cleartextTrafficPermitted="false"` for everything; only
      `api.spentyai.com` is explicitly trusted via system CAs. Debug builds
      get a `<debug-overrides>` that also trusts user CAs (mitmproxy etc).
- [x] **Backup rules** (Android <=11) — `res/xml/backup_rules.xml` excludes
      `secure_prefs.xml`, OkHttp cache, and the local SQLite DB so a fresh
      install on a new device does NOT silently log the new user in as the
      old user.
- [x] **Data extraction rules** (Android 12+ requirement) —
      `res/xml/data_extraction_rules.xml` mirrors `backup_rules.xml` and
      covers both `<cloud-backup>` and `<device-transfer>`.
- [x] **ProGuard rules** — `proguard-rules.pro` now keeps Retrofit, OkHttp,
      kotlinx-serialization $serializers + Companions, ALL
      `com.spentyai.app.**.model(s)` packages, Play Billing, Play Services
      Auth, Tink/security-crypto, Compose runtime, Coil, and the
      Application/MainActivity entry points.
- [x] **AndroidManifest** — wired `networkSecurityConfig`, `fullBackupContent`,
      `dataExtractionRules` into `<application>`.

`build.gradle.kts` was reviewed and left as-is:
- `applicationId = com.spentyai.app` ✓
- `versionCode = 1`, `versionName = "1.0.0"` ✓
- `minSdk = 24`, `targetSdk = 34`, `compileSdk = 34` ✓ (Play requirement met)
- `release.signingConfig` reads from env vars (`KEYSTORE_PATH`,
  `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`) — does NOT use debug keys.
- `release.isMinifyEnabled = true`, `isShrinkResources = true` ✓.

---

## TODO — user must do these manually

### 1. Generate the upload keystore (one-time)

```bash
cd ~/Downloads/ledgerai-emergent/android-native
keytool -genkey -v \
    -keystore spentyai-upload.jks \
    -alias spentyai \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000
```

Save the keystore file and passwords in 1Password / a secure secret store.
**If you lose the keystore, you can never publish an update under this
package name without going through Play App Signing key reset.** Do NOT
commit `spentyai-upload.jks` to git — `.gitignore` already excludes it
under `android-native/.gitignore`'s `*.jks` pattern (verify before
committing in case a different name was used).

### 2. Wire the keystore into your local build environment

Add to `~/.zshrc` (or your shell rc):

```bash
export KEYSTORE_PATH="$HOME/Downloads/ledgerai-emergent/android-native/spentyai-upload.jks"
export KEYSTORE_PASSWORD="<store password>"
export KEY_ALIAS="spentyai"
export KEY_PASSWORD="<key password>"
```

For CI: store the keystore as a base64-encoded GitHub secret and decode
it into the runner before `./gradlew bundleRelease`.

### 3. Verify release build is signed and minified

```bash
cd ~/Downloads/ledgerai-emergent/android-native
./gradlew clean :app:bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
unzip -l app/build/outputs/bundle/release/app-release.aab | head
# Verify it contains classes.dex (R8-output) and not the debug keystore.
keytool -list -v -keystore "$KEYSTORE_PATH" -alias "$KEY_ALIAS"
```

### 4. App icon — confirm SpentyAI green logo is real

`mipmap-anydpi-v26/ic_launcher.xml` exists with adaptive-icon
`background = @drawable/ic_launcher_background` /
`foreground = @drawable/ic_launcher_foreground`. Both drawables are
present, but **eyeball them in Android Studio's Resource Manager** to
confirm the foreground is the actual SpentyAI green-`$` mark and not a
placeholder. If it's a placeholder, replace
`drawable/ic_launcher_foreground.xml` with the exported vector from
the iOS icon set. The legacy `mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher.png`
PNGs should also be regenerated to match.

### 5. Play Console asset checklist

Required uploads before submission:
- Feature graphic (1024x500 PNG, no alpha)
- App icon (512x512 PNG, no alpha) — separate from launcher icon
- 2-8 phone screenshots (1080x1920 minimum)
- Privacy Policy URL: `https://www.spentyai.com/privacy.html`
- Data safety form — declare what you collect: account email,
  transaction text, device permissions (camera, microphone)
- Content rating questionnaire
- Target audience age: 18+
- Ads: **No**
- In-app purchases: **Yes** (Play Billing wired)

### 6. Dependency-bloat review (no action needed today)

Reviewed `app/build.gradle.kts`. No duplicate image libraries (only
Coil — Glide / Picasso are NOT present). Compose BOM, Retrofit, OkHttp,
kotlinx-serialization, Coil, Play Billing, Play Services Auth, Security
Crypto. Nothing to remove. Approximate AAB size estimate: 12-15 MB
post-R8.

### 7. Application class — debug-only init audit

`SpentyApp.onCreate()` only initialises `TokenStore`, `ApiClient`,
`AuthManager`. No `StrictMode`, no `LeakCanary`, no `Timber.DebugTree` —
nothing debug-only is leaking into release. ✓

### 8. Splash / Launch theme

`Theme.SpentyAI` is used both for the activity and as the launch theme.
Consider splitting into `Theme.SpentyAI.Splash` (with
`postSplashScreenTheme`) for cleaner cold-start UX, but this is a
polish item, not a Play-store blocker.

---

## Smoke-test the release build before uploading

1. `./gradlew :app:assembleRelease`
2. `adb install -r app/build/outputs/apk/release/app-release.apk`
3. Cold-start the app. Confirm:
   - Login screen renders (no R8-stripped class crash)
   - Google Sign-In completes (Play Services Auth keep rules work)
   - Dashboard loads (kotlinx-serialization $serializers kept)
   - Open Billing screen, verify products fetch (Play Billing keep rules)
   - Trigger AI Chat voice input (RECORD_AUDIO permission flow)
   - Take a receipt photo from a transaction (CAMERA permission flow)
4. Force-close + relaunch. Confirm no auto-login as the wrong user
   (backup rules working).
