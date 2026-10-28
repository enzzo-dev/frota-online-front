import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { DriverDeliverySummary } from '../../core/models';
import { DELIVERY_STATUS_VIEW } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { parseUtc } from '../../core/util/dates';
import { formatDistance } from '../../core/util/route-format';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';

const UNDERWAY = ['ToPickup', 'PickedUp', 'InTransit', 'Incident'] as const;
const DAY_MS = 86_400_000;

interface AgendaEntry {
  readonly delivery: DriverDeliverySummary;
  readonly start: Date;
  readonly end: Date | null;
  readonly startIso: string;
  readonly timed: boolean;
}

interface AgendaDay {
  readonly key: string;
  readonly label: string;
  readonly date: Date;
  readonly late: boolean;
  readonly entries: readonly AgendaEntry[];
  readonly total: number;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function entryOf(delivery: DriverDeliverySummary): AgendaEntry {
  const startIso = delivery.agendaStartsAt ?? delivery.scheduledPickupAt ?? delivery.createdAt;
  const timed = (delivery.agendaStartsAt ?? delivery.scheduledPickupAt) != null;
  return {
    delivery,
    timed,
    startIso,
    start: parseUtc(startIso),
    end: delivery.agendaEndsAt ? parseUtc(delivery.agendaEndsAt) : null,
  };
}

@Component({
  selector: 'app-agenda-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    CountdownComponent,
    EmptyStateComponent,
    HeroComponent,
    ProblemAlertComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .now {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      border-radius: 20px;
      background: var(--black);
      color: #fff;
      text-decoration: none;
    }
    .now__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .now__live {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font: 700 0.8rem/1 var(--font-mono, monospace);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--red);
      box-shadow: 0 0 0 0 rgb(215 20 26 / 60%);
      animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      70% {
        box-shadow: 0 0 0 10px rgb(215 20 26 / 0%);
      }
      100% {
        box-shadow: 0 0 0 0 rgb(215 20 26 / 0%);
      }
    }
    .now__price {
      font: 700 1.4rem/1.1 var(--font-display);
    }
    .now .bar {
      height: 6px;
      border-radius: 999px;
      background: rgb(255 255 255 / 20%);
      overflow: hidden;
    }
    .now .bar span {
      display: block;
      height: 100%;
      background: var(--red);
    }
    .now small {
      opacity: 0.75;
    }
    .day {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .day__head {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding-top: 6px;
    }
    .day__head h2 {
      margin: 0;
      font: 700 1.1rem/1.1 var(--font-display);
    }
    .day__head span {
      font-size: 0.85rem;
      color: var(--muted, #6b6b70);
    }
    .day--late .day__head h2 {
      color: var(--red);
    }
    .slot {
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 12px;
      align-items: stretch;
      color: inherit;
      text-decoration: none;
    }
    .slot__time {
      padding-top: 14px;
      font: 700 0.95rem/1 var(--font-mono, monospace);
      text-align: right;
    }
    .slot__time small {
      display: block;
      font: 500 0.7rem/1.2 var(--font-body);
      color: var(--muted, #6b6b70);
    }
    .slot__card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1.5px solid var(--line, #e4e4e7);
      border-left: 5px solid var(--black);
    }
    .slot__card--late {
      border-left-color: var(--red);
    }
    .slot__route {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
    .slot__route span:nth-child(2) {
      flex: 1;
      height: 0;
      border-top: 2px dotted var(--red);
    }
    .slot__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .pill {
      padding: 4px 9px;
      border-radius: 999px;
      background: var(--panel, #f3f3f4);
      font-size: 0.75rem;
    }
    .pill--soon {
      background: var(--red);
      color: #fff;
      font-weight: 700;
    }
    .day__sum {
      margin-left: auto;
      font-size: 0.8rem;
      color: var(--muted, #6b6b70);
    }
    .slot__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .slot__price {
      font: 700 1.15rem/1.1 var(--font-display);
    }
  `,
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide">
        <app-hero title="Agenda" lede="O que está rolando agora e o que vem por aí, dia a dia." />

        <app-problem-alert [error]="load.error()" />

        @if (underway().length > 0) {
          <section class="stack">
            <h2>Rolando agora</h2>
            @for (entry of underway(); track entry.delivery.deliveryId) {
              <a class="now" [routerLink]="['/driver/deliveries', entry.delivery.deliveryId]">
                <div class="now__head">
                  <span class="now__live"><span class="dot"></span> Ao vivo</span>
                  <app-status-chip [view]="statusView[entry.delivery.status]" />
                </div>
                <span class="now__price">{{ entry.delivery.agreedPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
                <div class="bar" aria-hidden="true">
                  <span [style.width.%]="percent(entry.delivery)"></span>
                </div>
                <small>{{ entry.delivery.completedStops }} de {{ entry.delivery.totalStops }} paradas concluídas</small>
              </a>
            }
          </section>
        }

        @for (day of days(); track day.key) {
          <section class="day" [class.day--late]="day.late">
            <div class="day__head">
              <h2>{{ day.label }}</h2>
              <span>{{ day.date | date: 'dd/MM' }}</span>
              <span class="day__sum">
                {{ day.entries.length }} {{ day.entries.length === 1 ? 'corrida' : 'corridas' }} ·
                {{ day.total | currency: 'BRL' : 'symbol' : '1.0-0' : 'pt-BR' }}
              </span>
            </div>
            @for (entry of day.entries; track entry.delivery.deliveryId) {
              <a class="slot" [routerLink]="['/driver/agenda', entry.delivery.deliveryId]">
                <div class="slot__time">
                  @if (entry.timed) {
                    {{ entry.start | date: 'HH:mm' }}
                    @if (entry.end; as finish) {
                      <small>até {{ finish | date: 'HH:mm' }}</small>
                    }
                  } @else {
                    <small>Dia todo</small>
                  }
                </div>
                <div class="slot__card" [class.slot__card--late]="day.late">
                  <div class="slot__row">
                    <span class="slot__price">{{ entry.delivery.agreedPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
                    <app-status-chip [view]="statusView[entry.delivery.status]" />
                  </div>
                  @if (entry.delivery.originDistrict) {
                    <div class="slot__route">
                      <span>{{ entry.delivery.originDistrict }}</span>
                      <span aria-hidden="true"></span>
                      <span>{{ entry.delivery.destinationDistrict }}</span>
                    </div>
                  }
                  @if (entry.delivery.cargoDescription) {
                    <span class="small">{{ entry.delivery.cargoDescription }}</span>
                  }
                  <div class="slot__chips">
                    @if (entry.timed && !day.late) {
                      <span class="pill pill--soon">em <app-countdown [until]="entry.startIso" endedText="agora" /></span>
                    }
                    <span class="pill">{{ entry.delivery.totalStops }} {{ entry.delivery.totalStops === 1 ? 'parada' : 'paradas' }}</span>
                    @if (distance(entry.delivery); as km) {
                      <span class="pill">{{ km }}</span>
                    }
                    @if (entry.delivery.cargoWeightKg) {
                      <span class="pill">{{ entry.delivery.cargoWeightKg }} kg</span>
                    }
                  </div>
                </div>
              </a>
            }
          </section>
        }

        @if (!load.loading() && underway().length === 0 && days().length === 0) {
          <app-empty-state
            title="Agenda livre"
            description="Quando uma proposta sua for aprovada, a corrida aparece aqui, no dia da coleta."
          >
            <a class="btn btn--sm" routerLink="/driver/freights">Ver fretes abertos</a>
          </app-empty-state>
        }
      </div>
    </ion-content>
  `,
})
export class AgendaPage {
  private readonly marketplace = inject(DriverMarketplaceService);

  protected readonly statusView = DELIVERY_STATUS_VIEW;
  protected readonly load = createRequestState();
  private readonly raw = signal<readonly DriverDeliverySummary[]>([]);

  protected readonly underway = computed(() =>
    this.raw()
      .filter((delivery) => (UNDERWAY as readonly string[]).includes(delivery.status))
      .map(entryOf),
  );

  protected readonly days = computed<readonly AgendaDay[]>(() => {
    const today = startOfDay(new Date());
    const groups = new Map<string, { date: Date; late: boolean; entries: AgendaEntry[] }>();
    for (const delivery of this.raw()) {
      if (delivery.status !== 'Scheduled') {
        continue;
      }
      const entry = entryOf(delivery);
      const day = startOfDay(entry.start);
      const late = day.getTime() < today.getTime();
      const date = late ? today : day;
      const key = `${late ? 'late-' : ''}${date.getTime()}`;
      const group = groups.get(key) ?? { date, late, entries: [] };
      group.entries.push(entry);
      groups.set(key, group);
    }
    return [...groups.entries()]
      .map(([key, group]) => ({
        key,
        date: group.date,
        late: group.late,
        label: this.labelOf(group.date, group.late, today),
        entries: group.entries.sort((a, b) => a.start.getTime() - b.start.getTime()),
        total: group.entries.reduce((sum, entry) => sum + entry.delivery.agreedPrice, 0),
      }))
      .sort((a, b) => Number(b.late) - Number(a.late) || a.date.getTime() - b.date.getTime());
  });

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected distance(delivery: DriverDeliverySummary): string | null {
    return formatDistance(delivery.routeDistanceMeters);
  }

  protected percent(delivery: DriverDeliverySummary): number {
    return delivery.totalStops === 0 ? 0 : Math.round((delivery.completedStops / delivery.totalStops) * 100);
  }

  private labelOf(date: Date, late: boolean, today: Date): string {
    if (late) {
      return 'Atrasadas';
    }
    const diff = Math.round((date.getTime() - today.getTime()) / DAY_MS);
    if (diff === 0) {
      return 'Hoje';
    }
    if (diff === 1) {
      return 'Amanhã';
    }
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }

  private async reload(): Promise<void> {
    const list = await this.load.run(() => firstValueFrom(this.marketplace.deliveries()));
    if (list) {
      this.raw.set(list);
    }
  }
}
