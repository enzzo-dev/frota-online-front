import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TimelineEvent } from '../../core/models';
import { DELIVERY_STATUS_VIEW } from '../../core/ui/labels';
import { UtcPipe } from '../pipes/utc.pipe';

/** What happened in a delivery, oldest first, the latest event marked as current. */
@Component({
  selector: 'app-delivery-timeline',
  imports: [DatePipe, IonIcon, UtcPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="timeline" aria-label="Linha do tempo da entrega">
      @for (event of ordered(); track $index; let last = $last) {
        <li class="timeline__item" [class.is-current]="last">
          <span class="timeline__dot" aria-hidden="true"></span>
          <div class="timeline__body">
            <div class="row row--between row--wrap">
              <strong>{{ statusLabel[event.status].label }}</strong>
              <time class="muted small" [attr.datetime]="event.occurredAt">
                {{ event.occurredAt | utc | date: "dd/MM 'às' HH:mm" }}
              </time>
            </div>
            @if (event.note) {
              <p class="small break">{{ event.note }}</p>
            }
            @if (event.hasProof || hasPlace(event)) {
              <p class="small muted timeline__meta">
                @if (event.hasProof) {
                  <span><ion-icon name="document-text-outline" aria-hidden="true" /> Comprovante registrado</span>
                }
                @if (hasPlace(event)) {
                  <a class="link-btn" [href]="placeUrl(event)" target="_blank" rel="noopener noreferrer">Ver local</a>
                }
              </p>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .timeline__item {
      position: relative;
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr);
      gap: 12px;
      padding-bottom: 18px;
    }
    .timeline__item:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 9px;
      top: 20px;
      bottom: 0;
      width: 2px;
      background: var(--line);
    }
    .timeline__dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid var(--black);
      background: var(--white);
      margin-top: 1px;
    }
    .timeline__item.is-current .timeline__dot {
      background: var(--red);
      border-color: var(--red);
      box-shadow: 0 0 0 4px rgb(215 20 26 / 18%);
    }
    .timeline__meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 14px;
    }
    .timeline__body p {
      margin-top: 4px;
    }
  `,
})
export class DeliveryTimelineComponent {
  readonly events = input.required<readonly TimelineEvent[]>();

  protected readonly statusLabel = DELIVERY_STATUS_VIEW;
  protected readonly ordered = computed(() =>
    [...this.events()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
  );

  protected hasPlace(event: TimelineEvent): boolean {
    return event.latitude !== null && event.longitude !== null;
  }

  protected placeUrl(event: TimelineEvent): string {
    return `https://www.openstreetmap.org/?mlat=${event.latitude}&mlon=${event.longitude}#map=17/${event.latitude}/${event.longitude}`;
  }
}
