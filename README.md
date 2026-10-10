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
