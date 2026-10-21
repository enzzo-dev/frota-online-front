import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Poller } from '../util/poller';
import { NotificationsService } from './notifications.service';

const BADGE_POLL_MS = 120_000;

/** The number on the bell. Polled while a signed-in shell is on screen; the inbox screen refreshes it too. */
@Injectable({ providedIn: 'root' })
export class NotificationBadgeService {
  private readonly api = inject(NotificationsService);
  private readonly poller = new Poller(() => this.refresh(), BADGE_POLL_MS);

  readonly unread = signal(0);

  start(): void {
    void this.refresh();
    this.poller.start();
  }

  stop(): void {
    this.poller.stop();
  }

  set(count: number): void {
    this.unread.set(Math.max(0, count));
  }

  async refresh(): Promise<void> {
    try {
      this.unread.set((await firstValueFrom(this.api.unreadCount())).unread);
    } catch {
      /* The bell just keeps its last number. */
    }
  }
}
