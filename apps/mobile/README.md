# SealSend native host app

Expo SDK57 / React Native shared iOS and Android candidate. Native controls and integrations; guests continue replying through the existing web invitations. This is a local candidate, not a store release or Expo Go compatibility promise.

From repository root:

```sh
npm ci
npm ci --prefix apps/mobile
npm run mobile:typecheck
npm run mobile:test
npm run mobile:export
npm run test:mobile:http
```

Use Node22.13+ (local verification uses Node26), Xcode26.4+ and Android SDK36. `npm --prefix apps/mobile start` starts Metro. Generated `ios`, `android`, `.expo` and `dist` are rebuildable and ignored. `npm run prebuild --prefix apps/mobile` generates native projects; local `build:ios:local`/`build:android:local` require sufficient disk, native dependencies and platform setup. Android local release may use development signing; it is not a store-signed AAB. Bundle IDs `com.ashbi.sealsend` are provisional until owner registration is confirmed.

The gateway is `https://sealsend.app/api/mobile/v1`, default disabled by `ENABLE_NATIVE_MOBILE_API=false`. Activation requires reviewed backend release and post-deployment verification; the existing production app does not automatically support this candidate. In development only, `EXPO_PUBLIC_API_URL=http://127.0.0.1:3130` (iOS simulator/web) or `http://10.0.2.2:3130` (Android emulator) can reach synthetic local QA. Production builds only accept `https://sealsend.app`. Never use real guests in isolated tests or put credentials in public Expo variables.

Credentials live in device SecureStore. Web preview keeps credentials in memory only. Attendee data is not stored offline. Only an unconfirmed create payload is retained temporarily in encrypted secure storage, until confirmation or sign-out. Sign-in uses email OTP and server-expiring/revocable sessions. Scanner validates the selected event's public slug and personal 24-character `t` token; backend verifies event ownership and token membership. Mutations have a single local lock and no automatic retry. A pending create key and original payload persist in SecureStore; retries use a host-scoped server record to recover the same event after a lost response or restart. Apply the additive mutation-table migration before enabling the gateway. Check-in suppresses repeat audit/webhook effects and blocks further changes until ambiguous results are refreshed.

See [research](../../docs/mobile/RESEARCH.md) and [readiness](../../docs/mobile/READINESS.md). Full web feature parity, universal links, push notifications, media/social tooling, native exports and billing are not claimed in v0.1.

SealSend-specific code follows the repository AGPL-3.0-only license. The generated Expo scaffold notice is retained in LICENSE.
