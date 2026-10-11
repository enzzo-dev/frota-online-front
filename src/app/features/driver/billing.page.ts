import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonInput, IonRefresher, IonRefresherContent, IonSpinner } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverBillingService } from '../../core/api/driver-billing.service';
import { PayoutAccount, PlanOption, Subscription, SubscriptionOverview, SubscriptionPlan } from '../../core/models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

const PLAN_NAME: Readonly<Record<SubscriptionPlan, string>> = { Basic: 'Básico', Full: 'Completo' };
const WALLET_ID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** The driver's monthly plan and the account that receives their share of a Pix paid in the app. */
@Component({
  selector: 'app-billing-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    IonContent,
    IonInput,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    PageBarComponent,
    ProblemAlertComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .plans {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }
    @media (min-width: 640px) {
      .plans {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .plan__price {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.8rem;
      letter-spacing: -0.03em;
      margin: 0;
    }
    .plan__price small {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--ink-soft);
    }
  `,
  template: `
    <app-page-bar title="Assinatura e recebimento" backHref="/driver/profile" />

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide page--with-bar">
        <app-problem-alert [error]="load.error()" />

        @if (overview(); as o) {
          <section class="stack" aria-label="Assinatura">
            <h2>Seu plano</h2>

            @if (o.current; as c) {
              <div class="card stack" [class.card--accent]="c.hasAccess">
                <div class="row row--between">
                  <div>
                    <p class="strong">Plano {{ planName[c.plan] }}</p>
                    <p class="muted small">{{ c.monthlyPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }} por mês</p>
                  </div>
                  <span class="chip" [class.chip--red]="c.status === 'Active'" [class.chip--outline]="c.status !== 'Active'">
                    {{ statusLabel(c) }}
                  </span>
                </div>
                @if (c.endsAt; as end) {
                  <p class="small">
                    {{ c.status === 'Cancelled' ? 'Acesso até' : 'Vale até' }} {{ end | utc | date: 'dd/MM/yyyy' }}
                  </p>
                }
                @if (c.status === 'Pending' && c.paymentUrl) {
                  <p class="small">O plano começa quando o primeiro pagamento for confirmado.</p>
                  <a class="btn btn--block" [href]="c.paymentUrl" target="_blank" rel="noopener noreferrer">Pagar o plano</a>
                }
                @if (c.status !== 'Cancelled') {
                  <button class="btn btn--danger-outline btn--block" type="button" [disabled]="action.loading()" (click)="cancel()">
                    Cancelar assinatura
                  </button>
                }
              </div>
            }

            @if (!o.current || o.current.status === 'Cancelled') {
              <div class="plans">
                @for (plan of o.plans; track plan.plan) {
                  <article class="card stack">
                    <p class="strong">{{ planName[plan.plan] }}</p>
                    <p class="plan__price">
                      {{ plan.monthlyPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}<small> /mês</small>
                    </p>
                    <p class="small muted">{{ limitText(plan) }}</p>
                    <button class="btn btn--block" type="button" [disabled]="action.loading()" (click)="subscribe(plan.plan)">
                      @if (action.loading() && choosing() === plan.plan) {
                        <ion-spinner name="crescent" />
                      }
                      Assinar {{ planName[plan.plan] }}
                    </button>
                  </article>
                }
              </div>
              <p class="field-hint">
                O pagamento é feito na página segura do serviço de pagamento, por Pix, boleto ou cartão. O app nunca vê os
                dados do seu cartão.
              </p>
            }
            <app-problem-alert [error]="action.error()" />
          </section>

          <section class="stack" aria-label="Conta de recebimento">
            <h2>Conta de recebimento</h2>
            <div class="card stack">
              <p class="small">
                É a sua conta no serviço de pagamento (Asaas), para onde vai a sua parte quando o cliente paga o frete por Pix
                no app. Sem ela, o cliente só pode pagar direto a você.
              </p>
              @if (payout(); as p) {
                <p class="small">
                  Situação:
                  <strong>{{ p.configured ? 'vinculada' : 'ainda não vinculada' }}</strong>
                </p>
              }
              <ion-input
                label="Wallet ID da sua conta Asaas"
                labelPlacement="stacked"
                fill="outline"
                autocapitalize="off"
                placeholder="00000000-0000-0000-0000-000000000000"
                [value]="walletId()"
                (ionInput)="onWallet($event)"
                helperText="Você encontra no painel do Asaas."
                [errorText]="'Informe o identificador no formato UUID'"
              />
              <app-problem-alert [error]="payoutRequest.error()" />
              <button class="btn btn--block" type="button" [disabled]="payoutRequest.loading() || !walletReady()" (click)="savePayout()">
                @if (payoutRequest.loading()) {
                  <ion-spinner name="crescent" />
                }
                Salvar conta
              </button>
            </div>
          </section>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class BillingPage {
  private readonly api = inject(DriverBillingService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly planName = PLAN_NAME;
  protected readonly load = createRequestState();
  protected readonly action = createRequestState();
  protected readonly payoutRequest = createRequestState();

  protected readonly overview = signal<SubscriptionOverview | null>(null);
  protected readonly payout = signal<PayoutAccount | null>(null);
  protected readonly walletId = signal('');
  protected readonly choosing = signal<SubscriptionPlan | null>(null);
  protected readonly walletReady = computed(() => WALLET_ID.test(this.walletId().trim()));

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected statusLabel(subscription: Subscription): string {
    if (subscription.status === 'Active') return 'Ativo';
    if (subscription.status === 'Pending') return 'Aguardando pagamento';
    return subscription.hasAccess ? 'Cancelado, com acesso' : 'Cancelado';
  }

  protected limitText(plan: PlanOption): string {
    return plan.maxVehicles === null ? 'Veículos ilimitados.' : `Até ${plan.maxVehicles} veículos ativos.`;
  }

  protected async subscribe(plan: SubscriptionPlan): Promise<void> {
    this.choosing.set(plan);
    const subscription = await this.action.run(() => firstValueFrom(this.api.subscribe(plan)));
    if (subscription) {
      await this.reload();
      if (subscription.paymentUrl) {
        window.open(subscription.paymentUrl, '_blank', 'noopener,noreferrer');
      }
    }
  }

  protected async cancel(): Promise<void> {
    const ok = await this.confirm.confirm({
      header: 'Cancelar a assinatura?',
      message: 'Você mantém o acesso até o fim do período já pago. Depois disso, não há novas cobranças.',
      confirmText: 'Cancelar assinatura',
      cancelText: 'Manter',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    const done = await this.action.run(() => firstValueFrom(this.api.cancelSubscription()));
    if (done) {
      await this.toast.show('Assinatura cancelada.');
      await this.reload();
    }
  }

  protected onWallet(event: Event): void {
    this.walletId.set(String((event as CustomEvent<{ value?: string | null }>).detail?.value ?? ''));
  }

  protected async savePayout(): Promise<void> {
    const saved = await this.payoutRequest.run(() => firstValueFrom(this.api.savePayoutAccount(this.walletId().trim())));
    if (saved) {
      this.payout.set(saved);
      await this.toast.show('Conta de recebimento salva.');
    }
  }

  private async reload(): Promise<void> {
    const result = await this.load.run(async () => ({
      overview: await firstValueFrom(this.api.subscription()),
      payout: await firstValueFrom(this.api.payoutAccount()),
    }));
    if (result) {
      this.overview.set(result.overview);
      this.payout.set(result.payout);
      if (result.payout.walletId && this.walletId() === '') {
        this.walletId.set(result.payout.walletId);
      }
    }
  }
}
