"""
Mobile App Store Submission Readiness

## What's shipped vs what's configuration

### Shipped (code / assets on disk)
- Expo Router v4 file-based routing (`app/`)
- Expo SecureStore + Biometrics (Face ID / fingerprint login)
- Expo Notifications (APNs + FCM) with deep-link routing
- EAS build profiles (dev / preview / production) in `eas.json`
- iOS bundle ID: `com.conic.app`
- Android package: `com.conic.app`
- App icons, splash screen, adaptive icon in `assets/images/`

### Required config (not code)
These are secrets / external account values that must be supplied before
`eas submit` will succeed. None belong in this repo.

| Item | Where | Notes |
|---|---|---|
| EAS project ID | `app.json` + `eas.json` | Created by `eas init`; sets `projectId` |
| Apple App Store Connect API key ID + Team ID | `eas.json` submit.production.ios | appleId, ascAppId, appleTeamId |
| Google Play service account JSON | `eas.json` submit.production.android.serviceAccountKeyPath | path to `google-service-account.json` |
| Apple push notification certs | configured via `eas credentials` | automatic for dev; managed for production |
| Google FCM API key | configured via `eas credentials` | automatic for dev; managed for production |
| OTA update URL | `app.json` updates.url | `https://u.expo.dev/<projectId>` |

### Submission workflow (out of scope for this repo)
1. `eas init` — register the EAS project, write `projectId` into app.json.
2. `eas credentials` — provision Apple certs + Google FCM credentials.
3. Fill placeholder values in `eas.json` submit.production:
   - iOS: appleId, ascAppId, appleTeamId (real values from App Store Connect).
   - Android: serviceAccountKeyPath pointing to a real Google service account JSON.
4. Prepare store listing assets (description, screenshots, category, privacy policy URL).
5. `eas build --platform all --profile production` then `eas submit --platform ios` and `eas submit --platform android`.

### Config files of record
- `apps/mobile/app.json` — bundle identifiers, permissions, deep links, OTA URL, EAS projectId.
- `apps/mobile/eas.json` — build profiles + submit configuration for iOS and Android.
- `.env.example` — `EXPO_PUBLIC_API_URL`, `EAS_PROJECT_ID`, and the mobile store secrets section.
"""
