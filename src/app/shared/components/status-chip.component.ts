import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StatusView } from '../../core/ui/labels';

@Component({
  selector: 'app-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [class]="'chip chip--' + view().tone">{{ view().label }}</span>`,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class StatusChipComponent {
  readonly view = input.required<StatusView>();
}
