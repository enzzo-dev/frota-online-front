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
- `FileUploader`: the API has no upload endpoint yet, so the default only registers file metadata
  (`POST /driver/documents`). Provide a real uploader when the endpoint exists.

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

### What the API still lacks
- No upload endpoint (pre-signed URL) for delivery proofs and documents: `FileUploader` only registers metadata.
- No endpoint for "the delivery of this freight": the app matches `GET /deliveries` by `freightRequestId`.
- No live driver position for the customer, and no push/websocket (polling only).
- CORS is not configured (see Configuration).

## Privacy (LGPD)
`/privacy` (Account → "Privacidade e meus dados") uses `GET /me/data` to download everything held about the
user as JSON, and `POST /me/deletion` (password + confirm) to anonymize the account. After a successful deletion
the local session is discarded without calling the API, since the server already removed the sessions.
