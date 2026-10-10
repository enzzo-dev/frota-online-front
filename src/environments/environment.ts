/**
 * Production defaults. `apiBaseUrl` is the root of the versioned API.
 * Same-origin (`/api/v1`) works when a reverse proxy serves the app and the API together.
 * For a Capacitor build, or any other origin, set an absolute URL and enable CORS on the API.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api/v1',
};
