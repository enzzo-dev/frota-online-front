import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { API_BASE_URL } from '../config/api-base-url.token';
import { ApiError } from './api-error';

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/password/forgot',
  '/auth/password/reset',
];
const NO_REFRESH_PATHS = [...PUBLIC_AUTH_PATHS, '/auth/logout'];

function pathOf(url: string, baseUrl: string): string | null {
  if (!url.startsWith(baseUrl)) {
    return null;
  }
  return url.slice(baseUrl.length).split('?')[0] ?? null;
}

function withBearer(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Sends the access token and, on a 401, renews the session once and repeats the call.
 * If the renewal itself is refused (token unknown, used or expired) the session ends.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  const session = inject(SessionService);
  const auth = inject(AuthService);

  const path = pathOf(request.url, baseUrl);
  if (path === null) {
    return next(request);
  }

  const usedToken = PUBLIC_AUTH_PATHS.includes(path) ? null : session.accessToken();
  const outgoing = usedToken ? withBearer(request, usedToken) : request;
  const canRefresh = !NO_REFRESH_PATHS.includes(path);

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      const unauthorized = error instanceof HttpErrorResponse && error.status === 401;
      if (!unauthorized || !canRefresh || !usedToken || !session.refreshToken()) {
        return throwError(() => error);
      }

      // Another call already renewed the session while this one was in flight.
      const currentToken = session.accessToken();
      if (currentToken && currentToken !== usedToken) {
        return next(withBearer(request, currentToken));
      }

      return auth.refresh().pipe(
        catchError((refreshError: unknown) => {
          // The refresh call runs the whole chain, so its failure usually arrives as an ApiError.
          const status =
            refreshError instanceof ApiError || refreshError instanceof HttpErrorResponse
              ? refreshError.status
              : null;
          // A network failure keeps the session: the user may simply be offline.
          if (status === 400 || status === 401) {
            auth.expireSession();
          }
          return throwError(() => refreshError);
        }),
        switchMap((renewed) => next(withBearer(request, renewed.accessToken))),
      );
    }),
  );
};

/** Turns every failed API call into an ApiError the UI can branch on. */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  if (!request.url.startsWith(baseUrl)) {
    return next(request);
  }
  return next(request).pipe(catchError((error: unknown) => throwError(() => ApiError.from(error))));
};
