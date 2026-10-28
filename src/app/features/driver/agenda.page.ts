import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { DriverDeliverySummary } from '../../core/models';
import { DELIVERY_STATUS_VIEW } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { parseUtc } from '../../core/util/dates';
import { formatDistance } from '../../core/util/route-format';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';

const UNDERWAY = ['ToPickup', 'PickedUp', 'InTransit', 'Incident'] as const;
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;

interface AgendaEntry {
  readonly delivery: DriverDeliverySummary;
  readonly start: Date;
  readonly end: Date | null;
  readonly startIso: string;
  readonly timed: boolean;
}

interface WeekDay {
  readonly date: Date;
  readonly key: string;
  readonly letter: string;
  readonly count: number;
  readonly today: boolean;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function keyOf(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
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
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    CountdownComponent,
    ProblemAlertComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-right: 56px;
    }
    .head h1 {
      margin: 0;
      font: 700 1.7rem/1.1 var(--font-display);
      letter-spacing: -0.02em;
    }
    .month {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .month strong {
      text-transform: capitalize;
      font: 700 1.05rem/1 var(--font-display);
    }
    .nav {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .nav button {
      display: grid;
      place-items: center;
      min-width: 38px;
      height: 38px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1.5px solid var(--line, #e4e4e7);
      background: var(--white);
      color: var(--black);
      font: 600 0.85rem/1 var(--font-body);
    }
    .week {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
    }
    .day {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 10px 0 8px;
      border: 0;
      border-radius: 18px;
      background: var(--panel, #f3f3f4);
      color: var(--black);
      font-family: var(--font-body);
    }
    .day__letter {
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      opacity: 0.6;
    }
    .day__num {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      font: 700 1rem/1 var(--font-display);
    }
    .day--today .day__num {
      box-shadow: inset 0 0 0 2px var(--red);
    }
    .day--selected {
      background: var(--black);
      color: #fff;
    }
    .day--selected .day__letter {
      opacity: 0.8;
    }
    .dots {
      display: flex;
      gap: 3px;
      height: 6px;
    }
    .dots i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--red);
    }
    .now {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 20px;
      background: var(--black);
      color: #fff;
      text-decoration: none;
    }
    .now__body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .now__title {
      font: 700 1rem/1.1 var(--font-display);
    }
    .now .bar {
      height: 5px;
      border-radius: 999px;
      background: rgb(255 255 255 / 20%);
      overflow: hidden;
    }
    .now .bar span {
      display: block;
      height: 100%;
      background: var(--red);
    }
    .dot {
      flex: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--red);
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
    .late {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 16px;
      background: rgb(215 20 26 / 10%);
      color: var(--red);
      font-weight: 600;
      text-decoration: none;
    }
    .sum {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
    }
    .sum h2 {
      margin: 0;
      font: 700 1.2rem/1.1 var(--font-display);
    }
    .sum h2::first-letter {
      text-transform: uppercase;
    }
    .sum span {
      font-size: 0.85rem;
      color: var(--muted, #6b6b70);
    }
    .tl {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .tl::before {
      content: '';
      position: absolute;
      left: 61px;
      top: 8px;
      bottom: 8px;
      border-left: 2px dotted var(--line, #d4d4d8);
    }
    .slot {
      position: relative;
      display: grid;
      grid-template-columns: 52px 18px 1fr;
      gap: 0 6px;
      color: inherit;
      text-decoration: none;
    }
    .slot__time {
      padding-top: 16px;
      text-align: right;
      font: 700 0.95rem/1 var(--font-mono, monospace);
    }
    .slot__time small {
      display: block;
      margin-top: 4px;
      font: 500 0.7rem/1 var(--font-body);
      color: var(--muted, #6b6b70);
    }
    .slot__dot {
      align-self: start;
      justify-self: center;
      margin-top: 17px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--red);
      box-shadow: 0 0 0 3px var(--white);
    }
    .slot__card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px 16px;
      border-radius: 20px;
      background: var(--panel, #f3f3f4);
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
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .pill {
      padding: 4px 9px;
      border-radius: 999px;
      background: var(--white);
      font-size: 0.75rem;
    }
    .pill--soon {
      background: var(--red);
      color: #fff;
      font-weight: 700;
    }
    .free {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 36px 16px;
      border-radius: 24px;
      border: 2px dashed var(--line, #d4d4d8);
      text-align: center;
      color: var(--muted, #6b6b70);
    }
    .free strong {
      color: var(--black);
      font: 700 1.1rem/1.1 var(--font-display);
    }
  `,
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide stack stack--lg">
        <div class="head">
          <h1>Agenda</h1>
        </div>

        <app-problem-alert [error]="load.error()" />

        <div class="stack">
          <div class="month">
            <strong>{{ selected() | date: 'MMMM y' }}</strong>
            <div class="nav">
              <button type="button" aria-label="Semana anterior" (click)="shiftWeek(-1)">
                <ion-icon name="arrow-back-outline" aria-hidden="true" />
              </button>
              <button type="button" (click)="goToday()">Hoje</button>
              <button type="button" aria-label="Próxima semana" (click)="shiftWeek(1)">
                <ion-icon name="chevron-forward-outline" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div class="week" role="tablist" aria-label="Dias da semana">
            @for (day of week(); track day.key) {
              <button
                type="button"
                role="tab"
                class="day"
                [class.day--today]="day.today"
                [class.day--selected]="day.key === selectedKey()"
                [attr.aria-selected]="day.key === selectedKey()"
                (click)="select(day.date)"
              >
                <span class="day__letter">{{ day.letter }}</span>
                <span class="day__num">{{ day.date | date: 'd' }}</span>
                <span class="dots" aria-hidden="true">
                  @for (n of dotsOf(day.count); track $index) {
                    <i></i>
                  }
                </span>
              </button>
            }
          </div>
        </div>

        @for (entry of underway(); track entry.delivery.deliveryId) {
          <a class="now" [routerLink]="['/driver/deliveries', entry.delivery.deliveryId]">
            <span class="dot"></span>
            <div class="now__body">
              <div class="row row--between">
                <span class="now__title">Rolando agora · {{ entry.delivery.agreedPrice | currency: 'BRL' : 'symbol' : '1.0-0' : 'pt-BR' }}</span>
                <app-status-chip [view]="statusView[entry.delivery.status]" />
              </div>
              <div class="bar" aria-hidden="true">
                <span [style.width.%]="percent(entry.delivery)"></span>
              </div>
              <small>{{ entry.delivery.completedStops }} de {{ entry.delivery.totalStops }} paradas concluídas</small>
            </div>
          </a>
        }

        @if (late().length > 0) {
          <a class="late" [routerLink]="['/driver/agenda', late()[0].delivery.deliveryId]">
            <span>{{ late().length }} {{ late().length === 1 ? 'corrida atrasada' : 'corridas atrasadas' }}</span>
            <ion-icon name="chevron-forward-outline" aria-hidden="true" />
          </a>
        }

        <section class="stack">
          <div class="sum">
            <h2>{{ selected() | date: 'EEEE, dd/MM' }}</h2>
            <span>
              {{ dayEntries().length }} {{ dayEntries().length === 1 ? 'corrida' : 'corridas' }}
              @if (dayEntries().length > 0) {
                · {{ dayTotal() | currency: 'BRL' : 'symbol' : '1.0-0' : 'pt-BR' }}
              }
            </span>
          </div>

          @if (dayEntries().length > 0) {
            <div class="tl">
              @for (entry of dayEntries(); track entry.delivery.deliveryId) {
                <a class="slot" [routerLink]="['/driver/agenda', entry.delivery.deliveryId]">
                  <div class="slot__time">
                    @if (entry.timed) {
                      {{ entry.start | date: 'HH:mm' }}
                      @if (entry.end; as finish) {
                        <small>{{ finish | date: 'HH:mm' }}</small>
                      }
                    } @else {
                      <small>Dia todo</small>
                    }
                  </div>
                  <span class="slot__dot" aria-hidden="true"></span>
                  <div class="slot__card">
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
                    <div class="chips">
                      @if (entry.timed) {
                        @if (started(entry)) {
                          <span class="pill pill--soon">Hora de começar</span>
                        } @else {
                          <span class="pill pill--soon">em <app-countdown [until]="entry.startIso" /></span>
                        }
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
            </div>
          } @else if (!load.loading()) {
            <div class="free">
              <strong>Dia livre</strong>
              <span>Nenhuma corrida agendada para este dia.</span>
              <a class="btn btn--sm" routerLink="/driver/freights">Ver fretes abertos</a>
            </div>
          }
        </section>
      </div>
    </ion-content>
  `,
})
export class AgendaPage {
  private readonly marketplace = inject(DriverMarketplaceService);

  protected readonly statusView = DELIVERY_STATUS_VIEW;
  protected readonly load = createRequestState();
  private readonly raw = signal<readonly DriverDeliverySummary[]>([]);

  protected readonly selected = signal(startOfDay(new Date()));
  protected readonly selectedKey = computed(() => keyOf(this.selected()));

  private readonly scheduled = computed(() =>
    this.raw()
      .filter((delivery) => delivery.status === 'Scheduled')
      .map(entryOf),
  );

  protected readonly underway = computed(() =>
    this.raw()
      .filter((delivery) => (UNDERWAY as readonly string[]).includes(delivery.status))
      .map(entryOf),
  );

  protected readonly late = computed(() => {
    const today = startOfDay(new Date()).getTime();
    return this.scheduled().filter((entry) => startOfDay(entry.start).getTime() < today);
  });

  private readonly byDay = computed(() => {
    const groups = new Map<string, AgendaEntry[]>();
    for (const entry of this.scheduled()) {
      const key = keyOf(startOfDay(entry.start));
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return groups;
  });

  protected readonly week = computed<readonly WeekDay[]>(() => {
    const selected = this.selected();
    const sunday = addDays(selected, -selected.getDay());
    const todayKey = keyOf(new Date());
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(sunday, index);
      const key = keyOf(date);
      return {
        date,
        key,
        letter: WEEKDAYS[index] ?? '',
        count: this.byDay().get(key)?.length ?? 0,
        today: key === todayKey,
      };
    });
  });

  protected readonly dayEntries = computed(() =>
    [...(this.byDay().get(this.selectedKey()) ?? [])].sort((a, b) => a.start.getTime() - b.start.getTime()),
  );
  protected readonly dayTotal = computed(() => this.dayEntries().reduce((sum, entry) => sum + entry.delivery.agreedPrice, 0));

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected select(date: Date): void {
    this.selected.set(date);
  }

  protected shiftWeek(direction: number): void {
    this.selected.set(addDays(this.selected(), direction * 7));
  }

  protected goToday(): void {
    this.selected.set(startOfDay(new Date()));
  }

  protected dotsOf(count: number): readonly number[] {
    return Array.from({ length: Math.min(count, 3) }, (_, index) => index);
  }

  protected started(entry: AgendaEntry): boolean {
    return entry.start.getTime() <= Date.now();
  }

  protected distance(delivery: DriverDeliverySummary): string | null {
    return formatDistance(delivery.routeDistanceMeters);
  }

  protected percent(delivery: DriverDeliverySummary): number {
    return delivery.totalStops === 0 ? 0 : Math.round((delivery.completedStops / delivery.totalStops) * 100);
  }

  private async reload(): Promise<void> {
    const list = await this.load.run(() => firstValueFrom(this.marketplace.deliveries()));
    if (list) {
      this.raw.set(list);
    }
  }
}
