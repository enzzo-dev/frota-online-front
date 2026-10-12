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

## Native build (iOS / Android)
Push notifications and Apple Pay need the native shell. It must provide, on `window`:
- `FrotaPush`: `register(): Promise<{ token, platform } | null>` and `onPush(listener): () => void`.
- `FrotaWallet`: `tokenize(amount): Promise<{ cardToken, paymentMethodId } | null>`.

Without them the app still works in a browser: push falls back to polling and Apple Pay stays disabled.
