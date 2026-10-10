import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NowService } from '../../core/ui/now.service';
import { toUtcMillis } from '../../core/util/dates';

/** Time left until a deadline. Counts down by the second under an hour, then shows hours and minutes. */
@Component({
  selector: 'app-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="mono" [class.urgent]="urgent()">{{ text() }}</span>`,
  styles: `
    .urgent {
      color: var(--red);
      font-weight: 700;
    }
  `,
})
export class CountdownComponent {
  private readonly clock = inject(NowService);

  readonly until = input.required<string>();
  /** Text shown once the deadline has passed. */
  readonly endedText = input('Encerrada');

  private readonly remainingMs = computed(() => {
    const target = toUtcMillis(this.until());
    return target === null ? 0 : target - this.clock.now();
  });

  protected readonly urgent = computed(() => {
    const remaining = this.remainingMs();
    return remaining > 0 && remaining <= 60_000;
  });

  protected readonly text = computed(() => {
    const remaining = this.remainingMs();
    if (remaining <= 0) {
      return this.endedText();
    }
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, '0')}min`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });
}
