# Frota Online — front-end

Ionic 9 + Angular 22 (standalone, zoneless, signals), mobile first. It talks to the Frota Online API (separate repository).

## Requirements
- Node >= 22.22.3 (required by Angular CLI 22) and npm.
- The API running. In development the dev server proxies `/api` to `https://localhost:62577` (see `proxy.conf.json`; change the `target` if your API listens elsewhere).

## Run
```bash
npm install
npm start          # dev server with /api proxied to the API
npm run build      # production build in dist/
npm test           # unit tests
```

After pulling changes that touch `package.json`, run `npm install` again.

## Configuration
- `src/environments/environment.development.ts` (dev server) and `environment.ts` (production build): `apiBaseUrl`, default `/api/v1`.
- Same origin: serve the built app and the API behind one reverse proxy and keep `/api/v1`.
- Another origin (or a Capacitor build): set `apiBaseUrl` to the absolute API URL and enable CORS on the API.
  The API has no CORS policy yet.

## Native build (Android / iOS)
The app is wrapped with Capacitor 8 (`capacitor.config.ts`, web build read from `dist/frota-online-front/browser`).
The native Android project is in `android/`. The Capacitor plugins in use are `@capacitor/app` (Android back gesture) and `@capacitor/geolocation` (driver position).

Rule of thumb: **every time the web code changes, build it and run `cap sync`** so the native project gets the new files. Run `cap sync` again after installing or removing a Capacitor plugin.

### Requirements
| For | You need |
| --- | --- |
| Both | Node >= 22.22.3, `npm install` done |
| Android | Android Studio with the Android SDK, and **Java 21** (the JDK that ships with Android Studio, `jbr`). Gradle 8.14 does not run on Java 25 |
| iOS | A Mac with Xcode and CocoaPods, and an Apple Developer account to run on a real device or publish |

### Which API the app talks to
The `apiBaseUrl` of the environment used by the build is baked into the app:
- `ng build --configuration development` uses `src/environments/environment.development.ts` (your tunnel or LAN API).
- `ng build` / `npm run build` (production) uses `src/environments/environment.ts`.

A phone cannot reach `localhost` of your computer: use a public URL (dev tunnel), the LAN IP of the computer, or the deployed API, and enable CORS for the origin `https://localhost` (Android) and `capacitor://localhost` (iOS).

### Android
```bash
# 1. Build the web app and copy it into the Android project
npm install
npx ng build --configuration development     # or: npm run build (production)
npx cap sync android

# 2. Open in Android Studio (Run button) ...
npx cap open android

# ... or build and install from the terminal on a connected phone / emulator
npx cap run android --list                   # list targets
npx cap run android --target <id>            # sync + build + install + launch
```

Live reload on the phone (same Wi-Fi as the computer):
```bash
npm start -- --host 0.0.0.0                  # terminal 1: dev server
npx cap run android -l --host <PC-IP> --port 4200   # terminal 2
```
USB instead of Wi-Fi: `npx cap run android -l --forwardPorts 4200:4200` (uses `adb reverse`).

Wireless debugging (Android 11+): phone Settings > Developer options > Wireless debugging, then `adb pair <IP>:<pairing-port>` and `adb connect <IP>:<port>`. `adb` lives in `%LOCALAPPDATA%\Android\Sdk\platform-tools` on Windows. Check with `adb devices`.

**Debug APK** (installable by hand, not for the store):
```bash
npx ng build --configuration development
npx cap sync android
cd android
./gradlew assembleDebug          # Windows: .\gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Release APK / AAB** (production API):
```bash
npm run build
npx cap sync android
cd android
./gradlew assembleRelease        # APK -> app/build/outputs/apk/release/
./gradlew bundleRelease          # AAB (Google Play) -> app/build/outputs/bundle/release/
```
Releases must be signed. Create a keystore once and keep it (and its passwords) safe and out of git:
```bash
keytool -genkey -v -keystore frota-online.keystore -alias frota -keyalg RSA -keysize 2048 -validity 10000
```
Then either sign in Android Studio (Build > Generate Signed Bundle / APK) or let Capacitor do it:
```bash
npx cap build android --androidreleasetype APK --keystorepath ../frota-online.keystore --keystorealias frota
# AAB for the Play Store: --androidreleasetype AAB
```
Before publishing, change the app id (`appId` in `capacitor.config.ts` and `applicationId` in `android/app/build.gradle`, currently `com.example.app`) and raise `versionCode` / `versionName` in `android/app/build.gradle` on every release.

Permissions declared in `android/app/src/main/AndroidManifest.xml`: internet, location (driver tracking) and camera (stop proof photo).

If Gradle fails:
- `Unsupported class file major version 69`: Gradle is running on Java 25. Point it to Java 21: `org.gradle.java.home=C:/Program Files/Android/Android Studio/jbr` in `~/.gradle/gradle.properties`.
- `Access is denied` on files under `.gradle`: stop the daemons (`./gradlew --stop`), close Android Studio, delete `~/.gradle/caches` and try again; keep the Gradle home out of OneDrive.
- `ng` or `adb` not recognized: use `npx ng ...` and add the SDK `platform-tools` folder to `PATH`.

### iOS (needs a Mac)
The iOS platform is not in the repository yet. Add it once:
```bash
npm install @capacitor/ios
npx cap add ios
```
Then, every time:
```bash
npm run build                    # or: npx ng build --configuration development
npx cap sync ios
npx cap open ios                 # opens Xcode
```
In Xcode:
1. Select the `App` target > Signing & Capabilities, pick your Team and set a unique Bundle Identifier.
2. Add to `ios/App/App/Info.plist` the usage texts the app needs: `NSLocationWhenInUseUsageDescription` (driver position), `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` (stop proof).
3. Choose a simulator or your iPhone and press Run (or `npx cap run ios --list` then `npx cap run ios --target <id>`).

Archive for TestFlight / App Store: Product > Archive > Distribute App, or from the terminal:
```bash
npx cap build ios --scheme App --xcode-team-id <TEAM_ID> --xcode-export-method app-store-connect
```
Live reload also works on iOS: `npx cap run ios -l --host <MAC-IP> --port 4200` with `npm start -- --host 0.0.0.0` running.

### Native bridges
Push notifications and Apple Pay need the native shell. It must provide, on `window`:
- `FrotaPush`: `register(): Promise<{ token, platform } | null>` and `onPush(listener): () => void`.
- `FrotaWallet`: `tokenize(amount): Promise<{ cardToken, paymentMethodId } | null>`.

Without them the app still works in a browser: push falls back to polling and Apple Pay stays disabled.
