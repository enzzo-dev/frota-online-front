/**
 * Repeats an async task on a fixed delay while started. Runs never overlap. It does not hit the API while the
 * page is hidden, and it runs once as soon as the page is visible again, so a person coming back sees fresh data.
 *
 * Every API call costs money on Cloud Run, so polling is the fallback, not the plan: while push is working the
 * delay is stretched by {@link Poller.slowdown}, and a push calls {@link Poller.refreshAll} to update what is on screen.
 */
export class Poller {
  /** Multiplier applied to every delay. The push service raises it while push notifications are delivered. */
  static slowdown = 1;

  private static readonly running = new Set<Poller>();

  /** Runs the task of every started poller now. Used when a push says something changed. */
  static refreshAll(): void {
    for (const poller of Poller.running) {
      void poller.tick();
    }
  }

  private active = false;
  private busy = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly task: () => Promise<unknown>,
    private readonly everyMs: number,
  ) {}

  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    Poller.running.add(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }
    this.schedule();
  }

  stop(): void {
    this.active = false;
    Poller.running.delete(this);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private readonly onVisibility = (): void => {
    if (this.active && !document.hidden) {
      void this.tick().then(() => this.reschedule());
    }
  };

  private async tick(): Promise<void> {
    if (!this.active || this.busy || (typeof document !== 'undefined' && document.hidden)) {
      return;
    }
    this.busy = true;
    try {
      await this.task();
    } catch {
      /* The screen shows its own error state; polling just tries again. */
    } finally {
      this.busy = false;
    }
  }

  private reschedule(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    if (this.active) {
      this.schedule();
    }
  }

  private schedule(): void {
    this.timer = setTimeout(async () => {
      await this.tick();
      if (this.active) {
        this.schedule();
      }
    }, this.everyMs * Poller.slowdown);
  }
}
