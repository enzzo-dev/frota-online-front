import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DriverBillingService } from './driver-billing.service';
import { DriverMarketplaceService } from './driver-marketplace.service';

/**
 * Where the driver stands with the free freight (one freight without a plan, once; a cancelled delivery gives it back).
 * The API does not send this, so it is derived the way the server does: no paid period, and how many deliveries the driver
 * took that were not cancelled. Whether the server enforces it at all is a switch on its side, so screens word the
 * warnings as what happens "sem assinatura".
 */
export type FreeFreightState = 'unknown' | 'subscribed' | 'available' | 'used';

@Injectable({ providedIn: 'root' })
export class FreeFreightService {
  private readonly billing = inject(DriverBillingService);
  private readonly marketplace = inject(DriverMarketplaceService);

  private readonly current = signal<FreeFreightState>('unknown');
  readonly state = this.current.asReadonly();
  readonly needsPlan = computed(() => this.current() === 'used');

  private inFlight: Promise<void> | null = null;

  /** Reads the plan and the deliveries again. Calls made while one is running share it. */
  refresh(): Promise<void> {
    this.inFlight ??= this.load().finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  private async load(): Promise<void> {
    try {
      const [overview, deliveries] = await Promise.all([
        firstValueFrom(this.billing.subscription()),
        firstValueFrom(this.marketplace.deliveries()),
      ]);
      if (overview.current?.hasAccess) {
        this.current.set('subscribed');
        return;
      }
      const taken = deliveries.filter((delivery) => delivery.status !== 'Cancelled').length;
      this.current.set(taken < 1 ? 'available' : 'used');
    } catch {
      // The warning is a help, never a blocker: without an answer the screens just do not show it.
      this.current.set('unknown');
    }
  }
}
