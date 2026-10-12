import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationBadgeService } from '../api/notification-badge.service';
import { NotificationsService } from '../api/notifications.service';
import { Poller } from '../util/poller';
import { PUSH_PROVIDER, PushRegistration } from './push.provider';

/** While push works, the screens ask the API this many times less often. Polling stays as the safety net. */
const POLL_SLOWDOWN_WITH_PUSH = 6;

/**
 * Registers this device for push and turns every push into one refresh of what is on screen.
 * That replaces constant polling: the API is asked when something changed, not every few seconds.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly provider = inject(PUSH_PROVIDER);
  private readonly notifications = inject(NotificationsService);
  private readonly badge = inject(NotificationBadgeService);

  private registration: PushRegistration | null = null;
  private stopListening: (() => void) | null = null;

  /** True once this device is registered and push is being delivered. */
  readonly active = signal(false);

  async start(): Promise<void> {
    if (this.active() || !this.provider.isAvailable()) {
      return;
    }
    try {
      const registration = await this.provider.register();
      if (!registration) {
        return;
      }
      await firstValueFrom(this.notifications.registerDevice(registration.token, registration.platform));
      this.registration = registration;
      this.stopListening = this.provider.onPush(() => {
        void this.badge.refresh();
        Poller.refreshAll();
      });
      Poller.slowdown = POLL_SLOWDOWN_WITH_PUSH;
      this.active.set(true);
    } catch {
      /* No push (permission, offline, no Firebase): the app keeps polling at the normal pace. */
    }
  }

  /** Called on sign out: the device stops receiving this person's pushes and polling goes back to normal. */
  async stop(): Promise<void> {
    this.stopListening?.();
    this.stopListening = null;
    Poller.slowdown = 1;
    this.active.set(false);
    const registration = this.registration;
    this.registration = null;
    if (registration) {
      try {
        await firstValueFrom(this.notifications.unregisterDevice(registration.token));
      } catch {
        /* The API drops tokens that Firebase reports as dead. */
      }
    }
  }
}
