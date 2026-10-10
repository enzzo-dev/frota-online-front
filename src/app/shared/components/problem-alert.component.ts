import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ApiError } from '../../core/http/api-error';

/** Shows a failed request: the friendly message and, for validation errors, each field message. */
@Component({
  selector: 'app-problem-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as e) {
      <div class="notice notice--error" role="alert">
        <strong>{{ e.message }}</strong>
        @if (e.fieldMessages.length > 0) {
          <ul>
            @for (message of e.fieldMessages; track $index) {
              <li>{{ message }}</li>
            }
          </ul>
        }
        <ng-content />
      </div>
    }
  `,
})
export class ProblemAlertComponent {
  readonly error = input<ApiError | null>(null);
}
