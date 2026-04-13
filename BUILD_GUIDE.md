# LedgerAI Mobile — Build & Deployment Guide

## Prerequisites

### Android
- Android Studio with SDK (API 34+)
- Java 17+ (`java -version`)
- Set `ANDROID_HOME` environment variable

### iOS
- macOS with Xcode 15+
- CocoaPods (`sudo gem install cocoapods`)
- Apple Developer account (for TestFlight)

### Both Platforms
- Node.js 18+ (`node -v`)
- EAS CLI (`npm install -g eas-cli`)
- Expo account (`eas login`)

---

## Quick Start

### 1. Install Dependencies

```bash
cd apps/mobile
npm install
```

### 2. Build Android APK (Preview)

**Option A: Local Gradle build**
```bash
cd apps/mobile/android
./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
```

**Option B: EAS local build**
```bash
cd apps/mobile
eas build --platform android --profile preview --local --non-interactive
# APK output in current directory
```

**Option C: EAS cloud build**
```bash
cd apps/mobile
eas build --platform android --profile preview --non-interactive
# Downloads APK from Expo servers when complete
```

### 3. Build iOS + Submit to TestFlight

**Option A: EAS cloud build + submit (Recommended)**
```bash
cd apps/mobile
eas build --platform ios --profile preview --non-interactive
eas submit --platform ios --latest --profile production
```

**Option B: Local Xcode build**
```bash
cd apps/mobile/ios
pod install
xcodebuild -workspace LedgerAI.xcworkspace -scheme LedgerAI \
  -configuration Release -archivePath build/LedgerAI.xcarchive archive
xcodebuild -exportArchive -archivePath build/LedgerAI.xcarchive \
  -exportPath build/output -exportOptionsPlist ExportOptions.plist
xcrun altool --upload-app -f build/output/LedgerAI.ipa -t ios \
  -u "$APPLE_ID" -p "$APP_SPECIFIC_PASSWORD"
```

### 4. Build Both Platforms at Once

```bash
cd apps/mobile
eas build --platform all --profile preview --non-interactive
```

---

## EAS Configuration

The project already has `eas.json` configured with three profiles:

- **development**: Development client with internal distribution
- **preview**: Internal distribution (for testing)
- **production**: Auto-incrementing version for App Store/Play Store

### First-Time EAS Setup

```bash
# Login to Expo
eas login

# Link project (if not already linked)
eas init

# Configure iOS credentials (first time only)
eas credentials

# Build!
eas build --platform all --profile preview
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_IOS_CLIENT_ID=your_google_ios_client_id
GOOGLE_ANDROID_CLIENT_ID=your_google_android_client_id
```

These are configured in `app.json` under `extra` and accessed via `expo-constants`.

---

## Testing on Device

### Android
```bash
# Install APK via adb
adb install -r app-debug.apk

# Or use Expo dev client
npx expo start --dev-client
```

### iOS
- TestFlight: Wait for processing (15-30 min), then install from TestFlight app
- Dev client: `npx expo start --dev-client` and scan QR code

---

## Troubleshooting

### Android build fails with "SDK not found"
```bash
# Create local.properties in android/
echo "sdk.dir=$ANDROID_HOME" > apps/mobile/android/local.properties
```

### iOS pod install fails
```bash
cd apps/mobile/ios
rm -rf Pods Podfile.lock
pod install --repo-update
```

### EAS build fails with credentials
```bash
eas credentials --platform ios
# Follow prompts to set up certificates and provisioning profiles
```
