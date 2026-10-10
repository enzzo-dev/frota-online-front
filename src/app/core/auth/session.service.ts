import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthResponse } from '../models';
import { SessionPersistence } from './session-persistence';

/** Holds the signed-in session (tokens and user) as signals and keeps the stored copy in sync. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly persistence = inject(SessionPersistence);
  private readonly current = signal<AuthResponse | null>(this.persistence.load());

  readonly user = computed(() => this.current()?.user ?? null);
  readonly role = computed(() => this.user()?.role ?? null);
  readonly isAuthenticated = computed(() => this.current() !== null);

  accessToken(): string | null {
    return this.current()?.accessToken ?? null;
  }

  refreshToken(): string | null {
    return this.current()?.refreshToken ?? null;
  }

  /** Stores a fresh token pair. Always replaces both tokens: each refresh token works once. */
  start(session: AuthResponse): void {
    this.persistence.save(session);
    this.current.set(session);
  }

  end(): void {
    this.persistence.clear();
    this.current.set(null);
  }
}
