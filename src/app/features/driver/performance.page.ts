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

interface Delta {
  readonly text: string;
  readonly tone: 'up' | 'down' | 'flat';
}

interface FunnelStep {
  readonly label: string;
  readonly value: number;
  readonly share: number;
}

interface Tip {
  readonly title: string;
  readonly text: string;
}

function delta(current: number, previous: number | null, lowerIsBetter = false): Delta | null {
  if (previous === null) {
    return null;
  }
  const diff = current - previous;
  if (diff === 0) {
    return { text: 'igual ao período anterior', tone: 'flat' };
  }
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return { text: `${diff > 0 ? '+' : ''}${diff} vs anterior`, tone: better ? 'up' : 'down' };
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
    .score {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 18px;
      padding: 18px;
      border-radius: 24px;
      background: var(--black);
      color: #fff;
    }
    .ring {
      --size: 104px;
      position: relative;
      display: grid;
      place-items: center;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      background: conic-gradient(var(--red) calc(var(--pct) * 1%), rgb(255 255 255 / 18%) 0);
    }
    .ring::before {
      content: '';
      position: absolute;
      inset: 9px;
      border-radius: 50%;
      background: var(--black);
    }
    .ring__value {
      position: relative;
      font: 700 1.5rem/1 var(--font-display);
      letter-spacing: -0.02em;
    }
    .score__title {
      margin: 0 0 4px;
      font: 700 1.05rem/1.2 var(--font-display);
    }
    .score__text {
      margin: 0;
      font-size: 0.82rem;
      opacity: 0.75;
    }
    .delta {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgb(255 255 255 / 12%);
      font-size: 0.72rem;
    }
    .delta--up {
      color: #7ee2a0;
    }
    .delta--down {
      color: #ff8f8f;
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border-radius: 20px;
      border: 1.5px solid var(--line, #e4e4e7);
    }
    .section h2 {
      margin: 0;
      font: 700 1rem/1.2 var(--font-display);
    }
    .funnel {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .funnel__row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .funnel__head {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }
    .funnel__head strong {
      font: 700 1rem/1 var(--font-display);
    }
    .funnel__bar {
      height: 10px;
      border-radius: 5px;
      background: var(--panel, #f3f3f4);
      overflow: hidden;
    }
    .funnel__bar span {
      display: block;
      height: 100%;
      min-width: 4px;
      border-radius: 5px;
      background: var(--black);
    }
    .funnel__row:last-child .funnel__bar span {
      background: var(--red);
    }
    .stack-bar {
      display: flex;
      height: 14px;
      border-radius: 7px;
      overflow: hidden;
      background: var(--panel, #f3f3f4);
    }
    .stack-bar span {
      display: block;
      height: 100%;
    }
    .seg--ok {
      background: var(--black);
    }
    .seg--no {
      background: var(--red);
    }
    .seg--exp {
      background: #b9b9bf;
    }
    .legend {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .legend__item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.75rem;
      color: var(--muted, #6b6b70);
    }
    .legend__item strong {
      font: 700 1.2rem/1.1 var(--font-display);
      color: var(--black);
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 5px;
      border-radius: 50%;
    }
    .pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
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
    .tile__label {
      font-size: 0.78rem;
      color: var(--muted, #6b6b70);
    }
    .tile__delta {
      font-size: 0.72rem;
      color: var(--muted, #6b6b70);
    }
    .tile__delta--up {
      color: #1c8a4a;
    }
    .tile__delta--down {
      color: var(--red);
    }
    .tips {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .tip {
      padding: 12px 14px;
      border-radius: 16px;
      background: var(--panel, #f3f3f4);
      border-left: 4px solid var(--red);
    }
    .tip strong {
      display: block;
      font: 700 0.92rem/1.25 var(--font-display);
    }
    .tip span {
      font-size: 0.82rem;
      color: var(--muted, #6b6b70);
    }
    .hint {
      margin: 0;
      font-size: 0.78rem;
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
          <section class="score">
            <div class="ring" [style.--pct]="m.acceptanceRate * 100">
              <span class="ring__value">{{ m.acceptanceRate | percent: '1.0-0' }}</span>
            </div>
            <div>
              <p class="score__title">Taxa de aceite</p>
              <p class="score__text">{{ m.proposalsAccepted }} de {{ m.proposalsSent }} propostas aprovadas pelos clientes</p>
              @if (acceptanceDelta(); as change) {
                <span class="delta" [class.delta--up]="change.tone === 'up'" [class.delta--down]="change.tone === 'down'">
                  {{ change.text }}
                </span>
              }
            </div>
          </section>

          <section class="section">
            <h2>Do frete à corrida</h2>
            <div class="funnel">
              @for (step of funnel(); track step.label) {
                <div class="funnel__row">
                  <div class="funnel__head">
                    <span>{{ step.label }}</span>
                    <strong>{{ step.value }}</strong>
                  </div>
                  <div class="funnel__bar" aria-hidden="true"><span [style.width.%]="step.share"></span></div>
                </div>
              }
            </div>
            @if (m.freightsSeen > 0) {
              <p class="hint">
                Você deixou passar {{ missedShare() | percent: '1.0-0' }} dos fretes que viu sem mandar proposta.
              </p>
            }
          </section>

          <section class="section">
            <h2>Resultado das propostas</h2>
            @if (m.proposalsSent > 0) {
              <div class="stack-bar" aria-hidden="true">
                <span class="seg--ok" [style.width.%]="share(m.proposalsAccepted, outcomes())"></span>
                <span class="seg--no" [style.width.%]="share(m.proposalsRejected, outcomes())"></span>
                <span class="seg--exp" [style.width.%]="share(m.proposalsExpired, outcomes())"></span>
              </div>
            }
            <div class="legend">
              <div class="legend__item">
                <strong>{{ m.proposalsAccepted }}</strong>
                <span><i class="dot seg--ok"></i>Aceitas</span>
              </div>
              <div class="legend__item">
                <strong>{{ m.proposalsRejected }}</strong>
                <span><i class="dot seg--no"></i>Recusadas</span>
              </div>
              <div class="legend__item">
                <strong>{{ m.proposalsExpired }}</strong>
                <span><i class="dot seg--exp"></i>Expiradas</span>
              </div>
            </div>
          </section>

          <section class="section">
            <h2>Corridas</h2>
            <div class="pair">
              <div class="tile">
                <span class="tile__value">{{ m.deliveriesCompleted }}</span>
                <span class="tile__label">Concluídas</span>
                @if (completedDelta(); as change) {
                  <span class="tile__delta" [class.tile__delta--up]="change.tone === 'up'" [class.tile__delta--down]="change.tone === 'down'">{{ change.text }}</span>
                }
              </div>
              <div class="tile">
                <span class="tile__value">{{ m.deliveriesCancelled }}</span>
                <span class="tile__label">Canceladas</span>
                @if (cancelledDelta(); as change) {
                  <span class="tile__delta" [class.tile__delta--up]="change.tone === 'up'" [class.tile__delta--down]="change.tone === 'down'">{{ change.text }}</span>
                }
              </div>
            </div>
            @if (reliability() !== null) {
              <p class="hint">Você concluiu {{ reliability() | percent: '1.0-0' }} das corridas que assumiu.</p>
            }
          </section>

          @if (tips().length > 0) {
            <section class="section">
              <h2>Para melhorar</h2>
              <ul class="tips">
                @for (tip of tips(); track tip.title) {
                  <li class="tip">
                    <strong>{{ tip.title }}</strong>
                    <span>{{ tip.text }}</span>
                  </li>
                }
              </ul>
            </section>
          }
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
  protected readonly previous = signal<DriverMetrics | null>(null);

  protected readonly outcomes = computed(() => {
    const m = this.metrics();
    return m ? m.proposalsAccepted + m.proposalsRejected + m.proposalsExpired : 0;
  });

  protected readonly funnel = computed<FunnelStep[]>(() => {
    const m = this.metrics();
    if (!m) {
      return [];
    }
    const top = Math.max(m.freightsSeen, 1);
    return [
      { label: 'Fretes vistos', value: m.freightsSeen, share: 100 },
      { label: 'Propostas enviadas', value: m.proposalsSent, share: (m.proposalsSent / top) * 100 },
      { label: 'Propostas aceitas', value: m.proposalsAccepted, share: (m.proposalsAccepted / top) * 100 },
      { label: 'Corridas concluídas', value: m.deliveriesCompleted, share: (m.deliveriesCompleted / top) * 100 },
    ];
  });

  protected readonly missedShare = computed(() => {
    const m = this.metrics();
    return m && m.freightsSeen > 0 ? m.freightsMissed / m.freightsSeen : 0;
  });

  protected readonly reliability = computed(() => {
    const m = this.metrics();
    if (!m) {
      return null;
    }
    const total = m.deliveriesCompleted + m.deliveriesCancelled;
    return total > 0 ? m.deliveriesCompleted / total : null;
  });

  protected readonly acceptanceDelta = computed<Delta | null>(() => {
    const m = this.metrics();
    const before = this.previous();
    if (!m || !before || before.proposalsSent === 0) {
      return null;
    }
    const points = Math.round((m.acceptanceRate - before.acceptanceRate) * 100);
    if (points === 0) {
      return { text: 'igual ao período anterior', tone: 'flat' };
    }
    return { text: `${points > 0 ? '+' : ''}${points} p.p. vs período anterior`, tone: points > 0 ? 'up' : 'down' };
  });

  protected readonly completedDelta = computed(() =>
    delta(this.metrics()?.deliveriesCompleted ?? 0, this.previous()?.deliveriesCompleted ?? null),
  );
  protected readonly cancelledDelta = computed(() =>
    delta(this.metrics()?.deliveriesCancelled ?? 0, this.previous()?.deliveriesCancelled ?? null, true),
  );

  protected readonly tips = computed<Tip[]>(() => {
    const m = this.metrics();
    if (!m) {
      return [];
    }
    const tips: Tip[] = [];
    if (m.freightsSeen >= 5 && this.missedShare() > 0.5) {
      tips.push({
        title: 'Mande mais propostas',
        text: 'Mais da metade dos fretes que você viu ficou sem proposta. Quem propõe mais fecha mais corridas.',
      });
    }
    if (m.proposalsSent >= 5 && m.acceptanceRate < 0.3) {
      tips.push({
        title: 'Ajuste o preço',
        text: 'Poucas propostas estão sendo aceitas. Compare o valor com a distância e o peso antes de enviar.',
      });
    }
    if (m.proposalsExpired > m.proposalsAccepted && m.proposalsExpired >= 3) {
      tips.push({
        title: 'Envie propostas mais cedo',
        text: 'Várias propostas expiraram sem resposta. Quanto antes você propõe, maior a chance de o cliente ver.',
      });
    }
    if (m.deliveriesCancelled > 0 && (this.reliability() ?? 1) < 0.9) {
      tips.push({
        title: 'Evite cancelar corridas',
        text: 'Cancelamentos pesam na confiança dos clientes. Só aceite o que você consegue cumprir.',
      });
    }
    return tips;
  });

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected share(value: number, total: number): number {
    return total > 0 ? (value / total) * 100 : 0;
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
    const now = Date.now();
    const from = days === null ? undefined : new Date(now - days * 86_400_000).toISOString();
    const result = await this.load.run(() => firstValueFrom(this.marketplace.metrics(from)));
    if (result) {
      this.metrics.set(result);
    }
    if (days === null || !from) {
      this.previous.set(null);
      return;
    }
    const before = new Date(now - 2 * days * 86_400_000).toISOString();
    try {
      this.previous.set(await firstValueFrom(this.marketplace.metrics(before, from)));
    } catch {
      this.previous.set(null);
    }
  }
}
