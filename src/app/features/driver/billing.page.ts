import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonInput, IonRefresher, IonRefresherContent, IonSpinner } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverBillingService } from '../../core/api/driver-billing.service';
import { DriverWalletService } from '../../core/api/driver-wallet.service';
import { FreeFreightService } from '../../core/api/free-freight.service';
import { PayoutAccount, PlanOption, Subscription, SubscriptionOverview, SubscriptionPlan, WalletAccount } from '../../core/models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { Poller } from '../../core/util/poller';
import { FreeFreightBannerComponent } from '../../shared/components/free-freight-banner.component';
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
    FreeFreightBannerComponent,
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
    .box {
      border: 1.5px solid var(--black);
      border-radius: 16px;
      padding: 16px;
      background: var(--white);
    }
    .plan {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .plan .btn {
      margin-top: 8px;
    }
    .plan--top {
      background: var(--black);
      color: #fff;
    }
    .plan--top .cap,
    .plan--top .plan__spec,
    .plan--top .plan__price small {
      color: rgba(255, 255, 255, 0.6);
    }
    .plan__spec {
      margin: 0;
      font: 600 12px/1.4 var(--font-mono);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ink-soft);
    }
    .mp {
      border: 1.5px solid var(--black);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .mp__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .mp__title {
      margin: 4px 0 0;
      font: 700 1.1rem/1.2 var(--font-display);
      letter-spacing: -0.01em;
    }
    .mp__state {
      flex: none;
      font: 700 11px/1 var(--font-mono);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1.5px solid var(--field-line);
      color: var(--ink-soft);
    }
    .mp__state--on {
      border-color: var(--black);
      background: var(--black);
      color: #fff;
    }
    .mp__state--wait {
      border-color: var(--red);
      color: var(--red);
      animation: blink 1.2s ease-in-out infinite;
    }
    @keyframes blink {
      50% {
        opacity: 0.4;
      }
    }
    .steps {
      margin: 0;
      padding: 12px 0 0;
      list-style: none;
      border-top: 1.5px dashed var(--line);
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px 12px;
      font-size: 14px;
      color: var(--ink-soft);
    }
    .steps li {
      display: contents;
    }
    .steps b {
      font: 700 12px/1.5 var(--font-mono);
      color: var(--black);
    }
    @media (prefers-reduced-motion: reduce) {
      .mp__state--wait {
        animation: none;
      }
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
        <app-free-freight-banner [hideAction]="true" />
        <app-problem-alert [error]="load.error()" />

        @if (overview(); as o) {
          <section class="stack" aria-label="Assinatura">
            <h2>Seu plano</h2>

            @if (o.current; as c) {
              <div class="box stack">
                <div class="mp__head">
                  <div>
                    <span class="cap">Plano {{ planName[c.plan] }}</span>
                    <p class="plan__price">
                      {{ c.monthlyPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}<small> /mês</small>
                    </p>
                  </div>
                  <span class="mp__state" [class.mp__state--on]="c.status === 'Active'" [class.mp__state--wait]="c.status === 'Pending'">
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
                  <article class="box plan" [class.plan--top]="plan.maxVehicles === null">
                    <span class="cap">Plano {{ planName[plan.plan] }}</span>
                    <p class="plan__price">
                      {{ plan.monthlyPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}<small> /mês</small>
                    </p>
                    <p class="plan__spec">{{ limitText(plan) }}</p>
                    <button
                      class="btn btn--block"
                      [class.btn--ghost]="plan.maxVehicles !== null"
                      type="button"
                      [disabled]="action.loading()"
                      (click)="subscribe(plan.plan)"
                    >
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
            <div class="box stack">
              <div class="mp__head">
                <div>
                  <span class="cap">Asaas</span>
                  <p class="mp__title">Recebe Pix e cartão</p>
                </div>
                @if (payout(); as p) {
                  <span class="mp__state" [class.mp__state--on]="p.configured">{{ p.configured ? 'Vinculada' : 'Pendente' }}</span>
                }
              </div>
              <p class="small">
                É a sua conta no serviço de pagamento (Asaas), para onde vai a sua parte quando o cliente paga o frete por Pix
                ou cartão no app. Sem ela, o cliente só pode pagar direto a você.
              </p>
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

          <section class="stack" aria-label="Apple Pay e Mercado Pago">
            <h2>Apple Pay</h2>
            <div class="mp">
              <div class="mp__head">
                <div>
                  <span class="cap">Mercado Pago</span>
                  <p class="mp__title">Receba por Apple Pay</p>
                </div>
                @if (wallet()?.connected) {
                  <span class="mp__state mp__state--on">Conectado</span>
                } @else if (connecting()) {
                  <span class="mp__state mp__state--wait">Aguardando</span>
                } @else {
                  <span class="mp__state">Desligado</span>
                }
              </div>
              @if (wallet()?.connected) {
                <p class="small">
                  Clientes com iPhone já podem pagar você pela carteira do aparelho. O dinheiro cai na sua conta do Mercado Pago,
                  menos a taxa da plataforma. A tarifa do cartão é descontada do seu lado.
                </p>
                <button class="btn btn--danger-outline btn--block" type="button" [disabled]="walletRequest.loading()" (click)="disconnectWallet()">
                  Desconectar Mercado Pago
                </button>
              } @else {
                <ol class="steps">
                  <li><b>01</b><span>Toque em conectar. O Mercado Pago abre no navegador.</span></li>
                  <li><b>02</b><span>Entre na sua conta e autorize a plataforma a receber por você.</span></li>
                  <li><b>03</b><span>Volte para cá. A conexão aparece sozinha.</span></li>
                </ol>
                <app-problem-alert [error]="walletRequest.error()" />
                <button class="btn btn--block" type="button" [disabled]="walletRequest.loading()" (click)="connectWallet()">
                  @if (walletRequest.loading()) {
                    <ion-spinner name="crescent" />
                  }
                  {{ connecting() ? 'Abrir de novo' : 'Conectar Mercado Pago' }}
                </button>
                <p class="field-hint">O link vale 15 minutos. Sem essa conexão, o cliente paga você por Pix ou cartão.</p>
              }
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
  private readonly walletApi = inject(DriverWalletService);
  private readonly freeFreight = inject(FreeFreightService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly planName = PLAN_NAME;
  protected readonly load = createRequestState();
  protected readonly action = createRequestState();
  protected readonly payoutRequest = createRequestState();
  protected readonly walletRequest = createRequestState();
  protected readonly wallet = signal<WalletAccount | null>(null);
  /** The browser tab with Mercado Pago is open: poll until the callback saves the connection. */
  protected readonly connecting = signal(false);
  private readonly walletPoller = new Poller(async () => {
    const account = await firstValueFrom(this.walletApi.get());
    this.wallet.set(account);
    if (account.connected) {
      this.connecting.set(false);
      this.walletPoller.stop();
      await this.toast.show('Mercado Pago conectado.');
    }
  }, 4_000);

  protected readonly overview = signal<SubscriptionOverview | null>(null);
  protected readonly payout = signal<PayoutAccount | null>(null);
  protected readonly walletId = signal('');
  protected readonly choosing = signal<SubscriptionPlan | null>(null);
  protected readonly walletReady = computed(() => WALLET_ID.test(this.walletId().trim()));

  ionViewWillEnter(): void {
    void this.freeFreight.refresh();
    void this.reload();
    if (this.connecting()) {
      this.walletPoller.start();
    }
  }

  ionViewWillLeave(): void {
    this.walletPoller.stop();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected statusLabel(subscription: Subscription): string {
    if (subscription.status === 'Active') return 'Ativo';
    if (subscription.status === 'Pending') return 'Aguardando';
    return subscription.hasAccess ? 'Cancelado, com acesso' : 'Cancelado';
  }

  protected limitText(plan: PlanOption): string {
    return plan.maxVehicles === null ? 'Veículos ilimitados' : `Até ${plan.maxVehicles} veículos ativos`;
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

  protected async connectWallet(): Promise<void> {
    const auth = await this.walletRequest.run(() => firstValueFrom(this.walletApi.startAuthorization()));
    if (auth) {
      window.open(auth.authorizationUrl, '_blank', 'noopener,noreferrer');
      this.connecting.set(true);
      this.walletPoller.start();
    }
  }

  protected async disconnectWallet(): Promise<void> {
    const ok = await this.confirm.confirm({
      header: 'Desconectar o Mercado Pago?',
      message: 'Os clientes deixam de ver o Apple Pay para as suas entregas. Pix e cartão continuam funcionando.',
      confirmText: 'Desconectar',
      cancelText: 'Manter',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    const account = await this.walletRequest.run(() => firstValueFrom(this.walletApi.disconnect()));
    if (account) {
      this.wallet.set(account);
      await this.toast.show('Mercado Pago desconectado.');
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
      wallet: await firstValueFrom(this.walletApi.get()),
    }));
    if (result) {
      this.overview.set(result.overview);
      this.payout.set(result.payout);
      this.wallet.set(result.wallet);
      if (result.payout.walletId && this.walletId() === '') {
        this.walletId.set(result.payout.walletId);
      }
    }
  }
}
