import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { FreightsService } from '../../core/api/freights.service';
import { ApprovedDelivery, Freight, RankedProposal } from '../../core/models';
import { FREIGHT_STATUS_VIEW, VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { ConfirmService } from '../../core/ui/confirm.service';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { Poller } from '../../core/util/poller';
import { fromFreightStops } from '../../core/util/stop-views';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { StopsRouteComponent } from '../../shared/components/stops-route.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

const POLL_MS = 10_000;

/** One freight: its route, the proposals ranked by price, and the actions to approve or cancel. */
@Component({
  selector: 'app-freight-detail-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    RouterLink,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    CountdownComponent,
    EmptyStateComponent,
    PageBarComponent,
    ProblemAlertComponent,
    StatusChipComponent,
    StopsRouteComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-bar title="Frete" backHref="/customer/freights" />

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--with-bar">
        <app-problem-alert [error]="load.error()" />
        <app-problem-alert [error]="action.error()" />

        @if (freight(); as f) {
          <section class="dark-panel stack">
            <div class="row row--between row--wrap">
              <h2 class="grow break">{{ f.cargoDescription }}</h2>
              <app-status-chip [view]="statusView[f.status]" />
            </div>
            <p class="muted small">
              {{ typeLabel[f.requiredVehicleType] }} · {{ f.cargoWeightKg | number: '1.0-2' : 'pt-BR' }} kg ·
              @if (f.scheduledPickupAt; as when) {
                coleta em {{ when | utc | date: "dd/MM 'às' HH:mm" }}
              } @else {
                coleta hoje
              }
            </p>
            @if (f.status === 'Open') {
              <p class="small">Janela de propostas termina em <app-countdown [until]="f.proposalDeadline" /></p>
            }
          </section>

          @if (delivery(); as d) {
            <section class="card card--accent stack">
              <h3>Frete aprovado</h3>
              <dl class="kv">
                <dt>Valor combinado</dt>
                <dd>{{ d.agreedPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</dd>
                <dt>Taxa da plataforma</dt>
                <dd>{{ d.platformFee | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</dd>
                <dt>Agenda do motorista</dt>
                <dd>{{ d.agendaStartsAt | utc | date: 'dd/MM HH:mm' }} – {{ d.agendaEndsAt | utc | date: 'HH:mm' }}</dd>
              </dl>
            </section>
          } @else if (f.status === 'Approved') {
            <p class="notice">Este frete já foi aprovado e o motorista está agendado.</p>
          }

          <section class="stack">
            <h2>Rota</h2>
            <app-stops-route [stops]="stops()" />
          </section>

          @if (f.status === 'Open') {
            <section class="stack">
              <h2>Propostas</h2>
              <p class="muted small">Da mais barata para a mais cara. Só propostas dentro da janela aparecem.</p>

              @if (proposals().length === 0 && !load.loading()) {
                <app-empty-state
                  title="Aguardando propostas"
                  description="Os motoristas compatíveis já podem ver o frete. Esta lista atualiza sozinha."
                />
              }

              @for (p of proposals(); track p.proposalId) {
                <article class="card stack" [class.card--accent]="p.rank === 1">
                  <div class="row row--between">
                    <div class="row">
                      <span class="rank" [class.rank--first]="p.rank === 1">{{ p.rank }}</span>
                      <span class="price price--lg">{{ p.price | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
                    </div>
                    <span class="chip chip--outline">{{ typeLabel[p.vehicleType] }}</span>
                  </div>
                  <p class="small"><strong>{{ p.driverName }}</strong> · {{ p.vehicleModel }}</p>
                  @if (p.message) {
                    <p class="small break">“{{ p.message }}”</p>
                  }
                  <p class="muted small">Válida por <app-countdown [until]="p.expiresAt" /></p>
                  <button
                    class="btn btn--block"
                    type="button"
                    [disabled]="approving() !== null"
                    (click)="confirmApprove(f, p)"
                  >
                    @if (approving() === p.proposalId) {
                      Aprovando…
                    } @else {
                      Aprovar esta proposta
                    }
                  </button>
                </article>
              }
            </section>

            <button class="btn btn--ghost btn--block" type="button" [disabled]="approving() !== null" (click)="confirmCancel(f)">
              Cancelar frete
            </button>
          }

          <a class="link-btn" routerLink="/customer/freights">Voltar para meus fretes</a>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class FreightDetailPage {
  private readonly freightsApi = inject(FreightsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly freightId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly statusView = FREIGHT_STATUS_VIEW;
  protected readonly typeLabel = VEHICLE_TYPE_LABEL;
  protected readonly load = createRequestState();
  protected readonly action = createRequestState();
  protected readonly approving = signal<string | null>(null);

  protected readonly freight = signal<Freight | null>(null);
  protected readonly proposals = signal<RankedProposal[]>([]);
  /** Only known right after approving here; later visits show the approved notice without the numbers. */
  protected readonly delivery = signal<ApprovedDelivery | null>(null);

  protected readonly stops = computed(() => fromFreightStops(this.freight()?.stops ?? []));

  private readonly poller = new Poller(() => this.reload(), POLL_MS);

  ionViewWillEnter(): void {
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

  protected async confirmApprove(freight: Freight, proposal: RankedProposal): Promise<void> {
    const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.price);
    const confirmed = await this.confirm.confirm({
      header: 'Aprovar proposta?',
      message: `${proposal.driverName} fará o frete por ${price}. As outras propostas serão recusadas.`,
      confirmText: 'Aprovar',
      cancelText: 'Voltar',
    });
    if (!confirmed) {
      return;
    }
    this.approving.set(proposal.proposalId);
    const delivery = await this.action.run(() =>
      firstValueFrom(this.freightsApi.approve(freight.id, proposal.proposalId)),
    );
    this.approving.set(null);
    if (delivery) {
      this.delivery.set(delivery);
      await this.toast.show('Proposta aprovada. O motorista foi agendado.');
    }
    // On proposal.driver_busy and similar errors the list is reloaded so the choice is current.
    await this.load.run(() => this.reload());
  }

  protected async confirmCancel(freight: Freight): Promise<void> {
    const confirmed = await this.confirm.confirm({
      header: 'Cancelar frete?',
      message: 'As propostas recebidas serão descartadas.',
      confirmText: 'Cancelar frete',
      cancelText: 'Manter',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    const done = await this.action.run(async () => {
      await firstValueFrom(this.freightsApi.cancel(freight.id));
      return true;
    });
    if (done) {
      await this.toast.show('Frete cancelado.');
      await this.load.run(() => this.reload());
    }
  }

  private async reload(): Promise<void> {
    const freight = await firstValueFrom(this.freightsApi.get(this.freightId));
    this.freight.set(freight);
    this.proposals.set(
      freight.status === 'Open' ? await firstValueFrom(this.freightsApi.proposals(freight.id)) : [],
    );
  }
}
