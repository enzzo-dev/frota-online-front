import { Injectable, inject, signal } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../api/driver-marketplace.service';
import { ApiError } from '../http/api-error';

/** The API keeps only the latest position, so sending more often than this just costs requests. */
const MIN_INTERVAL_MS = 10_000;
const MS_TO_KMH = 3.6;

/**
 * Sends the phone position to the API while a delivery is under way. Only one delivery is reported at a time.
 * It stops by itself when the API says the delivery is no longer running or does not belong to the driver.
 */
@Injectable({ providedIn: 'root' })
export class DriverLocationReporter {
  private readonly marketplace = inject(DriverMarketplaceService);

  /** True when the person refused the location permission: the screen can tell them why the customer sees no pin. */
  readonly denied = signal(false);

  private watchId: string | null = null;
  private deliveryId: string | null = null;
  private lastSentAt = 0;
  private sending = false;

  async start(deliveryId: string): Promise<void> {
    if (this.deliveryId === deliveryId && this.watchId !== null) {
      return;
    }
    await this.stop();
    this.deliveryId = deliveryId;
    this.denied.set(false);

    try {
      const permission = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (permission.location !== 'granted') {
        this.denied.set(true);
        this.deliveryId = null;
        return;
      }
      this.watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, maximumAge: 5_000 },
        (position, error) => {
          if (position && !error) {
            void this.send(position);
          }
        },
      );
    } catch {
      this.deliveryId = null;
    }
  }

  async stop(): Promise<void> {
    const id = this.watchId;
    this.watchId = null;
    this.deliveryId = null;
    if (id !== null) {
      await Geolocation.clearWatch({ id });
    }
  }

  private async send(position: Position): Promise<void> {
    const deliveryId = this.deliveryId;
    const now = Date.now();
    if (deliveryId === null || this.sending || now - this.lastSentAt < MIN_INTERVAL_MS) {
      return;
    }
    this.sending = true;
    this.lastSentAt = now;
    try {
      const { latitude, longitude, heading, speed } = position.coords;
      await firstValueFrom(
        this.marketplace.sendLocation(deliveryId, {
          latitude,
          longitude,
          heading: heading !== null && Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : null,
          speedKmh: speed !== null && Number.isFinite(speed) ? Math.round(speed * MS_TO_KMH) : null,
        }),
      );
    } catch (caught) {
      const status = ApiError.from(caught).status;
      if (status === 404 || status === 409) {
        await this.stop();
      }
    } finally {
      this.sending = false;
    }
  }
}
