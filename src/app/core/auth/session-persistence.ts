import { Injectable } from '@angular/core';
import { AuthResponse } from '../models';
import { toUtcMillis } from '../util/dates';

/**
 * Where the signed-in session lives between app launches.
 * The default keeps it in localStorage. A native build can provide a secure-storage version
 * (Keychain / Keystore) by overriding this token, without touching the rest of the app.
 */
@Injectable({ providedIn: 'root', useFactory: () => new LocalStorageSessionPersistence() })
export abstract class SessionPersistence {
  abstract load(): AuthResponse | null;
  abstract save(session: AuthResponse): void;
  abstract clear(): void;
}

const STORAGE_KEY = 'frota-online.session';

export class LocalStorageSessionPersistence extends SessionPersistence {
  override load(): AuthResponse | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isAuthResponse(parsed)) {
        this.clear();
        return null;
      }
      const refreshExpiry = toUtcMillis(parsed.refreshTokenExpiresAt);
      if (refreshExpiry !== null && refreshExpiry <= Date.now()) {
        this.clear();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  override save(session: AuthResponse): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* Storage can be full or blocked; the session then lives only in memory. */
    }
  }

  override clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Nothing to clear. */
    }
  }
}

export function isAuthResponse(value: unknown): value is AuthResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  const user = v['user'] as Record<string, unknown> | undefined;
  return (
    typeof v['accessToken'] === 'string' &&
    typeof v['refreshToken'] === 'string' &&
    typeof v['accessTokenExpiresAt'] === 'string' &&
    typeof v['refreshTokenExpiresAt'] === 'string' &&
    typeof user === 'object' &&
    user !== null &&
    typeof user['id'] === 'string' &&
    typeof user['role'] === 'string'
  );
}
