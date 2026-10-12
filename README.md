# Frota Online — front-end

Ionic 9 + Angular 22 (standalone, zoneless, signals), mobile first. Follows the endpoint flow and the
visual design of the API guide (`docs/index.html` in the back-end repository).

## Requirements
- Node >= 22.22.3 (required by Angular CLI 22). Note: "22.22.0" is a Node version; the Angular used is 22.2.x.
- The API running at `https://localhost:62577` (see `proxy.conf.json`).

## Run
```bash
npm install
npm start          # dev server with /api proxied to the API
npm run build      # production build in dist/
```

## Configuration
- `src/environments/environment*.ts` → `apiBaseUrl` (default `/api/v1`).
- The API has no CORS configuration. In development the proxy avoids it. In production, serve the app
  from the same origin as the API (reverse proxy) or enable CORS on the API; a Capacitor build needs CORS too.

## Structure
- `core/` models (DTOs), `http` (ApiClient, ApiError, interceptors with single-flight token refresh), `auth`, `api` (one service per area), `ui`, `util`.
- `shared/` presentational components and validators.
- `features/` `auth`, `terms`, `customer`, `driver`, `admin`, `account`, `shell` (tabs).
- Roles: Customer, Driver, Admin each get their own tab shell; detail screens are pushed over the tabs.

## Extension points
- `SessionPersistence`: localStorage by default; override with a secure-storage implementation on native.
- `FileUploader` (`features/driver/profile/file-uploader.ts`): signed-URL upload. `POST /driver/documents/upload-url`
  gives `storageKey`, `uploadUrl` and the exact `headers`; the bytes go with a `PUT` made by `fetch` (not HttpClient, so
  the API token never reaches the storage host); then `POST /driver/documents` registers the key. Where the API answers
  `409 storage.not_configured` (local development) it falls back to registering a client-made key and says so on screen.

## Maps, routes and deliveries
- Map: **Leaflet** on **OpenStreetMap** tiles (no API key), in `shared/components/map-view.component.ts`. Leaflet is
  loaded on first use (lazy chunk), so screens without a map do not pay for it. Keep the OSM attribution.
  The public tile server is for light use; use a hosted tile provider in production.
- CEP: `core/api/zip-lookup.service.ts` fills street, district, city and state from ViaCEP when the CEP has 8 digits.
- Geocoding: the API does not geocode. `core/api/geocoding.service.ts` asks **Nominatim** only when the customer taps
  "Localizar no mapa" (at most 1 request per second, per its usage policy) and sends `latitude` and `longitude` together.
  Use a hosted geocoder for production volume.
- Addresses can be edited (`PUT`, only if no freight ever used them; otherwise `address.in_use` offers "save as new") and deleted (`address.in_active_use` blocks one in an open freight or running delivery).
- Route preview: `POST /freights/route-preview` runs in the freight wizard as soon as the addresses are chosen.
  `distanceMeters`/`durationSeconds` null with an empty `path` is not an error: pins plus a straight line are drawn.
- Driver board shows `routeDistanceMeters`/`routeDurationSeconds` and approximate pins (about 1 km, never the street).
- Delivery flow (driver): start, complete stops in order (note, place, proof), incident, cancel, confirm payment, fee statement.
  Customer tracking polls every 5 seconds while the delivery is running (no push/websocket in the API yet).

## Notifications
- Bell with the unread count in every tab shell (`core/api/notification-badge.service.ts`, polled every 30 s), opening
  `/notifications`: inbox (all or unread only, "load more", mark one or all as read) and the two switches
  (`pushEnabled` for everyone, `newFreightAlerts` for drivers). Tapping an item opens its target by role
  (`core/ui/notification-view.ts`: `Freight`, `Proposal`, `Delivery`, `DriverProfile`, `Fee`, `Subscription`).
- Push (FCM) is **not wired in the app**: `PUT /devices` and `DELETE /devices` exist in `NotificationsService` but need
  a Firebase project (web config, service worker, or a Capacitor push plugin) to obtain the token. Until then the inbox
  and the badge work by polling.

## Payments (Asaas), subscription and uploads
- Customer: after the delivery is completed, `/customer/deliveries/:id` offers **Pagar com Pix** (CPF/CNPJ of the payer,
  masked as typed): `POST /deliveries/{id}/pix` returns copy-and-paste code, QR code, expiry and the split
  (`driverReceives`/`platformFee`). The screen keeps polling until the payment turns `Paid`. Paying the driver directly
  and waiting for his confirmation still works (`payments.driver_without_payout_account`).
- Driver: **Assinatura e recebimento** (`/driver/billing`, from Account): plans (`GET /driver/subscription`),
  subscribe (opens `paymentUrl`), cancel, and the payout `walletId` (`PUT /driver/payout-account`). Fees page: **Pagar por
  Pix** (`POST /driver/fees/pix`), the balance clears by itself when paid.
- Errors of the new codes (`subscription.vehicle_limit`, `subscription.required`, `fee.below_minimum`,
  `payments.not_configured`, `storage.not_configured`, ...) are mapped in `core/http/error-messages.ts`.
- Admin: driver review has **Abrir** on each file (`GET /admin/drivers/{id}/files/{fileId}/url`, link valid for 10 minutes).
- Input masks (`appMask` directive, `core/util/masks.ts`): phone `(11) 99999-8888` and CPF/CNPJ (alphanumeric CNPJ included).
  The API still receives clean values.
- Card and Apple Pay (customer, `features/customer/delivery-payment.component.ts`): the payment panel of a delivered freight
  has three methods. **Pix** as before. **Cartão**: saved cards (`GET/DELETE /customer/cards`) or a new one, with a live card
  that turns over on the CVV (`shared/components/credit-card.component.ts`, brand, Luhn and expiry checks in
  `core/util/card.ts`); `POST /deliveries/{id}/card`. The number and CVV are cleared from memory right after the request. A
  `Pending` result keeps the page polling until the webhook settles it; `Failed` offers another try. **Apple Pay**:
  `POST /deliveries/{id}/wallet`. The token comes from the iOS shell through `window.FrotaWallet` (`tokenize(amount)`, see
  `core/payments/wallet-token.provider.ts`); in a browser the option stays disabled ("só no app iOS").
- Driver: **Assinatura e recebimento** also connects the Mercado Pago account (`/driver/wallet-account`): opens the
  authorization link and polls until the callback saves the connection; can disconnect.
- Free freight (driver without a plan may take **one** freight; enforced by the API when the proposal is sent and when the customer
  approves it; a cancelled delivery gives it back). The API does not report the state, so
  `core/api/free-freight.service.ts` derives it: no paid period and no non-cancelled delivery -> `available`; with one -> `used`.
  `shared/components/free-freight-banner.component.ts` explains it on the freight board, Minhas propostas (plus a warning when
  several open proposals compete for the single free freight) and the plans screen. The proposal sheet warns before sending
  ("este pode ser o seu frete grátis" / "seu frete grátis já foi usado") and `subscription.required` offers "Ver planos".
  Whether the rule is on at all is the server's `Subscriptions__RequiredToPropose`; the app never blocks the button on its own.
- The admin "settle fee" screen was left out: the Pix flow settles fees by itself.

### What the API still lacks
- No endpoint for "the delivery of this freight": the app matches `GET /deliveries` by `freightRequestId`.
- No live driver position for the customer; no websocket (polling, plus FCM push once the app registers a device).
- No filter of new-freight alerts by region (alerts go to every compatible driver).
- CORS is not configured (see Configuration).

## Privacy (LGPD)
`/privacy` (Account → "Privacidade e meus dados") uses `GET /me/data` to download everything held about the
user as JSON, and `POST /me/deletion` (password + confirm) to anonymize the account. After a successful deletion
the local session is discarded without calling the API, since the server already removed the sessions.
