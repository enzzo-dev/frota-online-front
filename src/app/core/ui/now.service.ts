import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** A clock signal that ticks every second, for countdowns. */
@Injectable({ providedIn: 'root' })
export class NowService {
  private readonly clock = signal(Date.now());
  readonly now = this.clock.asReadonly();

  constructor() {
    const timer = setInterval(() => this.clock.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
