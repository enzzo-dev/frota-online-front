/**
 * Repeats an async task on a fixed delay while started. Runs never overlap, and it skips a beat
 * while the page is hidden so background tabs do not keep hitting the API.
 */
export class Poller {
  private active = false;
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
    this.schedule();
  }

  stop(): void {
    this.active = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(): void {
    this.timer = setTimeout(async () => {
      if (!this.active) {
        return;
      }
      if (typeof document === 'undefined' || !document.hidden) {
        try {
          await this.task();
        } catch {
          /* The screen shows its own error state; polling just tries again. */
        }
      }
      if (this.active) {
        this.schedule();
      }
    }, this.everyMs);
  }
}
