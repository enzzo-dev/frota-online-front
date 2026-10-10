import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../auth/session.service';
import { DriverProfile, DriverStatus } from '../models';
import { DriverService } from './driver.service';

/**
 * The signed-in driver's profile, shared by the onboarding screen and the route guards.
 * `undefined` means "not loaded yet", `null` means "loaded, and the driver has no profile".
 */
@Injectable({ providedIn: 'root' })
export class DriverProfileStore {
  private readonly driver = inject(DriverService);
  private readonly session = inject(SessionService);

  private readonly state = signal<DriverProfile | null | undefined>(undefined);

  readonly profile = this.state.asReadonly();
  readonly status = computed<DriverStatus | null>(() => this.state()?.status ?? null);
  readonly isApproved = computed(() => this.state()?.status === 'Approved');

  constructor() {
    // Never keep one account's profile around after the session ends.
    effect(() => {
      if (!this.session.isAuthenticated()) {
        this.state.set(undefined);
      }
    });
  }

  async load(): Promise<DriverProfile | null> {
    const profile = await firstValueFrom(this.driver.profile());
    this.state.set(profile);
    return profile;
  }

  /** Loads once. An approved profile is final, any other status is re-read to catch the review result. */
  async ensureFresh(): Promise<DriverProfile | null> {
    const current = this.state();
    if (current !== undefined && current?.status === 'Approved') {
      return current;
    }
    return this.load();
  }

  set(profile: DriverProfile): void {
    this.state.set(profile);
  }
}
