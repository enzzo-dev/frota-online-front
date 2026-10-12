import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { ApiClient } from '../http/api-client';
import { PushService } from '../push/push.service';
import { ApiError } from '../http/api-error';
import { AuthResponse, LoginRequest, RegisterRequest, UserRole } from '../models';
import { homeFor } from './home-routes';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionService);
  private readonly push = inject(PushService);
  private readonly router = inject(Router);

  /** The refresh in progress, shared by every caller that hits a 401 at the same time. */
  private refreshInFlight$: Observable<AuthResponse> | null = null;

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/register', request).pipe(
      tap((response) => this.session.start(response)),
    );
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/login', request).pipe(
      tap((response) => this.session.start(response)),
    );
  }

  /**
   * Trades the refresh token for a new pair.
   * The refresh token rotates on every use and reusing one revokes the whole session, so
   * concurrent callers must share a single request instead of each sending the same token.
   */
  refresh(): Observable<AuthResponse> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }
    const refreshToken = this.session.refreshToken();
    if (!refreshToken) {
      return throwError(() => new ApiError(401, 'auth.invalid_refresh_token', 'No refresh token'));
    }
    this.refreshInFlight$ = this.api.post<AuthResponse>('/auth/refresh', { refreshToken }).pipe(
      tap((response) => this.session.start(response)),
      finalize(() => (this.refreshInFlight$ = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight$;
  }

  /** Revokes the refresh token on the server (best effort) and forgets the session locally. */
  async logout(): Promise<void> {
    // Unregister the device first: it needs the session that is about to end.
    await this.push.stop();
    const refreshToken = this.session.refreshToken();
    if (refreshToken) {
      await firstValueFrom(
        this.api.post<void>('/auth/logout', { refreshToken }).pipe(catchError(() => of(null))),
      );
    }
    this.session.end();
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  /** Forgets the session locally, without calling the API: the server already deleted it (account erasure). */
  discardSession(): void {
    this.session.end();
  }

  /** The refresh token is gone, used or expired: drop the session and ask for a new sign-in. */
  expireSession(): void {
    if (!this.session.isAuthenticated()) {
      return;
    }
    this.session.end();
    void this.router.navigate(['/auth/login'], { queryParams: { expired: 1 }, replaceUrl: true });
  }

  /** First screen after a successful sign-in or sign-up: terms for end users, home for admins. */
  landingUrlFor(role: UserRole): string {
    return role === 'Admin' ? homeFor(role) : '/terms';
  }
}
