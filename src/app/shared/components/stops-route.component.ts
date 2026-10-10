import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { STOP_TYPE_LABEL } from '../../core/ui/labels';
import { StopView } from '../../core/util/stop-views';

/** The stops of a freight or delivery as numbered pins on a dotted red route. */
@Component({
  selector: 'app-stops-route',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="route" aria-label="Paradas da rota">
      @for (stop of stops(); track stop.sequence) {
        <li class="stop" [class.stop--done]="stop.done">
          <span class="stop-pin" aria-hidden="true">
            @if (stop.done) {
              <ion-icon name="checkmark-outline" />
            } @else {
              {{ stop.sequence }}
            }
          </span>
          <div class="stop-body">
            <div class="row row--between">
              <span class="chip" [class.chip--red]="stop.type === 'Delivery'">
                {{ typeLabel[stop.type] }}
              </span>
              @if (stop.done) {
                <span class="small muted">Concluída</span>
              }
              @if (stop.mapsLink) {
                <a class="link-btn" [href]="stop.mapsLink" target="_blank" rel="noopener noreferrer">
                  Abrir no mapa
                </a>
              }
            </div>
            <p class="strong break stop__title">{{ stop.title }}</p>
            @if (stop.subtitle) {
              <p class="muted small">{{ stop.subtitle }}</p>
            }
            @if (stop.note) {
              <p class="small">Obs.: {{ stop.note }}</p>
            }
            @if (stop.items.length > 0) {
              <ul class="items" aria-label="Itens">
                @for (item of stop.items; track $index) {
                  <li>{{ item.quantity }}× {{ item.description }}</li>
                }
              </ul>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .stop__title {
      margin-top: 8px;
    }
  `,
})
export class StopsRouteComponent {
  readonly stops = input.required<readonly StopView[]>();
  protected readonly typeLabel = STOP_TYPE_LABEL;
}
