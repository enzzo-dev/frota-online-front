import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { FreeFreightService } from '../../core/api/free-freight.service';
import { Proposal, ProposalStatus } from '../../core/models';
import { PROPOSAL_STATUS_VIEW } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { ConfirmService } from '../../core/ui/confirm.service';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { Poller } from '../../core/util/poller';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { FreeFreightBannerComponent } from '../../shared/components/free-freight-banner.component';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

type Filter = 'all' | ProposalStatus;

const POLL_MS = 20_000;

/** Proposals the driver sent. A pending one can be withdrawn; an accepted one means a delivery exists. */
@Component({
  selector: 'app-proposals-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    CountdownComponent,
    EmptyStateComponent,
    FreeFreightBannerComponent,
    HeroComponent,
    ProblemAlertComponent,
    StatusChipComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .stake {
      margin: 0;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border: 1.5px solid var(--red);
      border-radius: 16px;
      font-size: 14px;
      color: var(--red-deep);
    }
    .stake__count {
      flex: none;
      font: 700 13px/1 var(--font-mono);
      padding: 6px 7px;
      border-radius: 8px;
      background: var(--red);
      color: #fff;
    }
  `,
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide">
        <app-hero
          title="Minhas propostas"
          lede="Acompanhe o que você enviou. Quando o cliente aprova, a corrida aparece em Corridas."
        />

        <app-free-freight-banner [compact]="true" />
        @if (freeAtStake()) {
          <p class="stake" role="alert">
            <span class="stake__count">{{ pendingCount() }}→1</span>
            <span>
              {{ pendingCount() }} propostas abertas disputam um só frete grátis. Vale a primeira que o cliente aprovar; as
              outras aprovações serão recusadas se você não assinar.
            </span>
          </p>
        }

        <ion-segment [value]="filter()" (ionChange)="onFilter($event.detail.value)">
          <ion-segment-button value="all">Todas</ion-segment-button>
          <ion-segment-button value="Pending">Pendentes</ion-segment-button>
          <ion-segment-button value="Accepted">Aceitas</ion-segment-button>
        </ion-segment>

        <app-problem-alert [error]="load.error()" />
        <app-problem-alert [error]="withdrawRequest.error()" />

        @if (visible(); as list) {
          @if (list.length === 0 && !load.loading()) {
            <app-empty-state
              title="Nada por aqui"
              description="Envie uma proposta em um frete aberto para ela aparecer nesta lista."
            >
              <a class="btn btn--sm" routerLink="/driver/freights">Ver fretes abertos</a>
            </app-empty-state>
          }

          <div class="grid-cards">
            @for (proposal of list; track proposal.id) {
              <article class="card stack" [class.card--accent]="proposal.status === 'Accepted'">
                <div class="row row--between">
                  <span class="price price--lg">{{ proposal.price | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
                  <app-status-chip [view]="statusView[proposal.status]" />
                </div>
                <p class="muted small">
                  Frete <span class="mono">#{{ shortId(proposal.freightRequestId) }}</span> · enviada em
                  {{ proposal.createdAt | utc | date: 'dd/MM HH:mm' }}
                </p>
                @if (proposal.message) {
                  <p class="small break">“{{ proposal.message }}”</p>
                }
                @if (proposal.status === 'Pending') {
                  <p class="small">Janela termina em <app-countdown [until]="proposal.expiresAt" /></p>
                  <div class="form-actions">
                    <button class="btn btn--ghost btn--sm" type="button" [disabled]="withdrawing() === proposal.id" (click)="confirmWithdraw(proposal)">
                      Retirar proposta
                    </button>
                  </div>
                } @else if (proposal.status === 'Accepted') {
                  <a class="btn btn--sm" routerLink="/driver/deliveries">Ver minhas corridas</a>
                }
              </article>
            }
          </div>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class ProposalsPage {
  private readonly marketplace = inject(DriverMarketplaceService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly freeFreight = inject(FreeFreightService);

  protected readonly statusView = PROPOSAL_STATUS_VIEW;
  protected readonly load = createRequestState();
  protected readonly withdrawRequest = createRequestState();
  protected readonly filter = signal<Filter>('all');
  protected readonly withdrawing = signal<string | null>(null);

  private readonly proposals = signal<Proposal[] | null>(null);

  protected readonly visible = computed(() => {
    const all = this.proposals();
    if (all === null) {
      return null;
    }
    const filter = this.filter();
    return [...all]
      .filter((proposal) => filter === 'all' || proposal.status === filter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  protected readonly pendingCount = computed(() => (this.proposals() ?? []).filter((p) => p.status === 'Pending').length);
  /** Several open proposals compete for one free freight. */
  protected readonly freeAtStake = computed(() => this.freeFreight.state() === 'available' && this.pendingCount() > 1);

  private readonly poller = new Poller(() => this.reload(), POLL_MS);

  ionViewWillEnter(): void {
    void this.freeFreight.refresh();
    void this.load.run(() => this.reload());
    this.poller.start();
  }

  ionViewWillLeave(): void {
    this.poller.stop();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.load.run(() => this.reload());
    completeRefresh(event);
  }

  protected onFilter(value: string | number | null | undefined): void {
    if (value === 'all' || value === 'Pending' || value === 'Accepted') {
      this.filter.set(value);
    }
  }

  protected shortId(id: string): string {
    return id.slice(0, 8);
  }

  protected async confirmWithdraw(proposal: Proposal): Promise<void> {
    const confirmed = await this.confirm.confirm({
      header: 'Retirar proposta?',
      message: 'O cliente deixa de ver o seu preço. Você pode enviar outra enquanto a janela estiver aberta.',
      confirmText: 'Retirar',
      cancelText: 'Manter',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.withdrawing.set(proposal.id);
    const done = await this.withdrawRequest.run(async () => {
      await firstValueFrom(this.marketplace.withdrawProposal(proposal.id));
      return true;
    });
    this.withdrawing.set(null);
    if (done) {
      await this.toast.show('Proposta retirada.');
      await this.load.run(() => this.reload());
    }
  }

  private async reload(): Promise<void> {
    this.proposals.set(await firstValueFrom(this.marketplace.proposals()));
  }
}
