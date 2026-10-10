import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { StopView } from '../../core/util/stop-views';
import { StopsRouteComponent } from '../../shared/components/stops-route.component';

/** What the customer is about to request, in plain words. Shown beside the form and again before publishing. */
export interface FreightSummary {
  readonly stops: readonly StopView[];
  readonly cargo: string;
  readonly weightText: string;
  readonly vehicle: string;
  readonly whenText: string;
  readonly windowText: string;
}

/** Index of the wizard step that edits each part, so a section can send the customer back to it. */
export type SummarySection = 0 | 1 | 2;

@Component({
  selector: 'app-freight-summary',
  imports: [StopsRouteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="stack">
      <div class="row row--between">
        <h3>Rota</h3>
        @if (editable()) {
          <button class="link-btn" type="button" (click)="edit.emit(0)">Editar</button>
        }
      </div>
      @if (summary().stops.length > 0) {
        <app-stops-route [stops]="summary().stops" />
      } @else {
        <p class="muted small">Escolha os endereços para ver a rota aqui.</p>
      }
    </section>

    <section class="stack">
      <div class="row row--between">
        <h3>Carga</h3>
        @if (editable()) {
          <button class="link-btn" type="button" (click)="edit.emit(1)">Editar</button>
        }
      </div>
      <dl class="kv">
        <dt>O que é</dt>
        <dd>{{ summary().cargo || '—' }}</dd>
        <dt>Peso</dt>
        <dd>{{ summary().weightText || '—' }}</dd>
        <dt>Veículo</dt>
        <dd>{{ summary().vehicle }}</dd>
      </dl>
    </section>

    <section class="stack">
      <div class="row row--between">
        <h3>Coleta</h3>
        @if (editable()) {
          <button class="link-btn" type="button" (click)="edit.emit(2)">Editar</button>
        }
      </div>
      <dl class="kv">
        <dt>Quando</dt>
        <dd>{{ summary().whenText }}</dd>
      </dl>
      <p class="field-hint">{{ summary().windowText }}</p>
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    h3 {
      font-size: 16px;
    }
  `,
})
export class FreightSummaryComponent {
  readonly summary = input.required<FreightSummary>();
  readonly editable = input(false);
  readonly edit = output<SummarySection>();
}
