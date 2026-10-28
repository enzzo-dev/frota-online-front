import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { DriverMetrics } from '../../core/models';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';

type Period = '7' | '30' | 'all';

interface Tile {
  readonly label: string;
  readonly value: number;
  readonly tone?: 'good' | 'bad';
}

@Component({
  selector: 'app-performance-page',
  imports: [
    PercentPipe,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    PageBarComponent,
    ProblemAlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    ion-segment {
      margin-top: 8px;
    }
    .rate {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 18px;
      border-radius: 20px;
      background: var(--black);
      color: #fff;
    }
    .rate__value {
      font: 700 2.2rem/1 var(--font-display);
      letter-spacing: -0.02em;
    }
    .rate__label {
      font-size: 0.8rem;
      opacity: 0.75;
    }
    .rate__bar {
      height: 6px;
      margin-top: 8px;
      border-radius: 3px;
      background: rgb(255 255 255 / 20%);
      overflow: hidden;
    }
    .rate__bar span {
      display: block;
      height: 100%;
      background: var(--red);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px;
      border-radius: 18px;
      background: var(--panel, #f3f3f4);
    }
    .tile__value {
      font: 700 1.5rem/1.1 var(--font-display);
    }
    .tile--bad .tile__value {
      color: var(--red);
    }
    .tile__label {
      font-size: 0.78rem;
      color: var(--muted, #6b6b70);
    }
    .hint {
      margin: 0;
      font-size: 0.8rem;
      color: var(--muted, #6b6b70);
    }
  `,
  template: `
    <app-page-bar title="Meu desempenho" backHref="/driver/account" />

    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide page--with-bar stack">
        <ion-segment [value]="period()" (ionChange)="onPeriod($event.detail.value)">
          <ion-segment-button value="7">7 dias</ion-segment-button>
          <ion-segment-button value="30">30 dias</ion-segment-button>
          <ion-segment-button value="all">Tudo</ion-segment-button>
        </ion-segment>

        <app-problem-alert [error]="load.error()" />

        @if (metrics(); as m) {
          <div class="rate">
            <span class="rate__value">{{ m.acceptanceRate | percent: '1.0-0' }}</span>
            <span class="rate__label">Taxa de aceite · {{ m.proposalsAccepted }} de {{ m.proposalsSent }} propostas</span>
            <div class="rate__bar" aria-hidden="true">
              <span [style.width.%]="m.acceptanceRate * 100"></span>
            </div>
          </div>

          <div class="grid">
            @for (tile of tiles(); track tile.label) {
              <div class="tile" [class.tile--bad]="tile.tone === 'bad'">
                <span class="tile__value">{{ tile.value }}</span>
                <span class="tile__label">{{ tile.label }}</span>
              </div>
            }
          </div>

          <p class="hint">
            "Deixou passar" conta fretes que você viu e que fecharam ou foram para outro motorista sem proposta sua.
          </p>
        }
      </div>
    </ion-content>
  `,
})
export class PerformancePage {
  private readonly marketplace = inject(DriverMarketplaceService);

  protected readonly load = createRequestState();
  protected readonly period = signal<Period>('30');
  protected readonly metrics = signal<DriverMetrics | null>(null);

  protected readonly tiles = computed<Tile[]>(() => {
    const m = this.metrics();
    if (!m) {
      return [];
    }
    return [
      { label: 'Fretes vistos', value: m.freightsSeen },
      { label: 'Deixou passar', value: m.freightsMissed, tone: 'bad' },
      { label: 'Propostas enviadas', value: m.proposalsSent },
      { label: 'Aceitas', value: m.proposalsAccepted, tone: 'good' },
      { label: 'Recusadas', value: m.proposalsRejected },
      { label: 'Expiradas', value: m.proposalsExpired },
      { label: 'Corridas concluídas', value: m.deliveriesCompleted },
      { label: 'Corridas canceladas', value: m.deliveriesCancelled, tone: 'bad' },
    ];
  });

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected onPeriod(value: unknown): void {
    this.period.set(value === '7' || value === 'all' ? value : '30');
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  private async reload(): Promise<void> {
    const days = this.period() === 'all' ? null : Number(this.period());
    const from = days === null ? undefined : new Date(Date.now() - days * 86_400_000).toISOString();
    const result = await this.load.run(() => firstValueFrom(this.marketplace.metrics(from)));
    if (result) {
      this.metrics.set(result);
    }
  }
}
