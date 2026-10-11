import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { IonCheckbox, IonIcon, IonInput, IonSpinner } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { CustomerCardsService } from '../../core/api/customer-cards.service';
import { CustomerDeliveriesService } from '../../core/api/customer-deliveries.service';
import { ApiError } from '../../core/http/api-error';
import { CardPayment, PayWithCardRequest, PixPayment, SavedCard, WalletPayment } from '../../core/models';
import { WALLET_TOKEN_PROVIDER } from '../../core/payments/wallet-token.provider';
import { ConfirmService } from '../../core/ui/confirm.service';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { CARD_BRAND_LABEL, CardBrand, detectBrand, luhn, maskCardNumber, maskExpiry, parseExpiry } from '../../core/util/card';
import { maskPhone, maskTaxId, maskZip } from '../../core/util/masks';
import { normalizePhone, normalizeTaxId, normalizeZip } from '../../core/util/normalizers';
import { CreditCardComponent } from '../../shared/components/credit-card.component';
import { PixCardComponent } from '../../shared/components/pix-card.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';

type Method = 'pix' | 'card' | 'wallet';

const NEW_CARD = 'new';

/**
 * How a customer pays a delivered freight in the app: Pix, credit card (new or saved) or Apple Pay.
 * The page owns the delivery; this component asks it to reload (`changed`) and tells it when a payment is being
 * confirmed (`awaiting`) so it keeps polling.
 */
@Component({
  selector: 'app-delivery-payment',
  imports: [CurrencyPipe, IonCheckbox, IonIcon, IonInput, IonSpinner, CreditCardComponent, PixCardComponent, ProblemAlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .pay {
      overflow: hidden;
    }
    .pay__head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
    }
    .pay__amount {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 2rem;
      letter-spacing: -0.03em;
      line-height: 1;
      margin: 0;
    }
    .methods {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .method {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 14px 6px 12px;
      font: inherit;
      color: var(--black);
      background: var(--white);
      border: 1.5px solid var(--line);
      border-radius: var(--r-sm);
      cursor: pointer;
      transition:
        border-color 0.2s,
        background 0.2s,
        transform 0.15s,
        box-shadow 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    .method ion-icon {
      font-size: 24px;
      transition: color 0.2s, transform 0.25s;
    }
    .method__name {
      font-weight: 700;
      font-size: 13px;
    }
    .method__sub {
      font-size: 11px;
      color: var(--ink-mute);
      text-align: center;
      line-height: 1.2;
    }
    .method:hover:not(:disabled) {
      border-color: var(--field-line);
      transform: translateY(-1px);
    }
    .method--on {
      border-color: var(--red);
      background: linear-gradient(180deg, #fff, #fff4f4);
      box-shadow: 0 8px 20px -14px rgba(215, 20, 26, 0.8);
    }
    .method--on ion-icon {
      color: var(--red);
      transform: scale(1.12);
    }
    .method:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .pane {
      animation: rise 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    .grid2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .sub {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-soft);
      margin: 4px 0 0;
    }
    .saved {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .saved__item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 14px;
      font: inherit;
      text-align: left;
      color: var(--black);
      background: var(--white);
      border: 1.5px solid var(--line);
      border-radius: var(--r-sm);
      cursor: pointer;
      transition:
        border-color 0.2s,
        background 0.2s;
    }
    .saved__item--on {
      border-color: var(--red);
      background: #fff4f4;
    }
    .saved__radio {
      flex: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid var(--field-line);
      display: grid;
      place-items: center;
      transition: border-color 0.2s;
    }
    .saved__item--on .saved__radio {
      border-color: var(--red);
    }
    .saved__item--on .saved__radio::after {
      content: '';
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--red);
      animation: pop 0.25s ease-out;
    }
    @keyframes pop {
      from {
        transform: scale(0);
      }
    }
    .saved__badge {
      flex: none;
      min-width: 46px;
      padding: 4px 8px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      text-align: center;
      color: #fff;
      background: #17171a;
    }
    .saved__num {
      flex: 1;
      min-width: 0;
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: 14px;
    }
    .saved__rm {
      flex: none;
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--ink-mute);
      cursor: pointer;
    }
    .saved__rm:hover {
      color: var(--red);
      background: #fdeaea;
    }
    .secure {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      color: var(--ink-soft);
      margin: 0;
    }
    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 14px 4px 6px;
      text-align: center;
    }
    .state__ring {
      position: relative;
      width: 64px;
      height: 64px;
      display: grid;
      place-items: center;
    }
    .state__ring::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 3px solid #f7d3d4;
      border-top-color: var(--red);
      animation: spin 1s linear infinite;
    }
    .state__ring ion-icon {
      font-size: 26px;
      color: var(--red);
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    .state--ok .state__ring::before {
      border-color: var(--red);
      animation: none;
    }
    .apple {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 52px;
      font: inherit;
      font-weight: 600;
      font-size: 17px;
      color: #fff;
      background: #000;
      border: 0;
      border-radius: 12px;
      cursor: pointer;
    }
    .apple ion-icon {
      font-size: 22px;
    }
    .apple:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    @media (prefers-reduced-motion: reduce) {
      .pane,
      .state__ring::before,
      .saved__item--on .saved__radio::after {
        animation: none;
      }
    }
  `,
  template: `
    <section class="pay card stack" aria-label="Pagar a entrega">
      <div class="pay__head">
        <div>
          <p class="muted small">Total a pagar</p>
          <p class="pay__amount">{{ amount() | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</p>
        </div>
        <span class="chip chip--outline">Entrega concluída</span>
      </div>

      <div class="methods" role="group" aria-label="Forma de pagamento">
        <button type="button" class="method" [class.method--on]="method() === 'pix'" [attr.aria-pressed]="method() === 'pix'" (click)="choose('pix')">
          <ion-icon name="qr-code-outline" aria-hidden="true" />
          <span class="method__name">Pix</span>
          <span class="method__sub">na hora</span>
        </button>
        <button type="button" class="method" [class.method--on]="method() === 'card'" [attr.aria-pressed]="method() === 'card'" (click)="choose('card')">
          <ion-icon name="card-outline" aria-hidden="true" />
          <span class="method__name">Cartão</span>
          <span class="method__sub">crédito</span>
        </button>
        <button
          type="button"
          class="method"
          [class.method--on]="method() === 'wallet'"
          [attr.aria-pressed]="method() === 'wallet'"
          [disabled]="!walletAvailable"
          (click)="choose('wallet')"
        >
          <ion-icon name="logo-apple" aria-hidden="true" />
          <span class="method__name">Apple Pay</span>
          <span class="method__sub">{{ walletAvailable ? 'um toque' : 'só no app iOS' }}</span>
        </button>
      </div>

      <app-problem-alert [error]="request.error()" />

      @switch (method()) {
        @case ('pix') {
          <div class="pane stack">
            @if (pix(); as p) {
              <app-pix-card [amount]="p.amount" [payload]="p.pixPayload" [qrCode]="p.pixQrCode" [expiresAt]="p.expiresAt">
                <p class="small muted">{{ split(p.driverReceives, p.platformFee) }}</p>
              </app-pix-card>
            } @else {
              <p class="small">O motorista recebe o valor direto na conta dele. O QR code aparece em seguida.</p>
              <ion-input
                label="CPF ou CNPJ de quem paga"
                labelPlacement="stacked"
                fill="outline"
                inputmode="text"
                autocapitalize="characters"
                [value]="taxId()"
                (ionInput)="onTaxId($event)"
                helperText="O serviço de pagamento exige o documento de quem paga."
              />
              <button class="btn btn--block" type="button" [disabled]="request.loading() || !taxIdReady()" (click)="generatePix()">
                @if (request.loading()) {
                  <ion-spinner name="crescent" />
                }
                Gerar Pix
              </button>
            }
          </div>
        }

        @case ('card') {
          <div class="pane stack">
            @if (cardResult(); as r) {
              @if (r.status === 'Failed') {
                <div class="state">
                  <div class="state__ring"><ion-icon name="alert-circle-outline" aria-hidden="true" /></div>
                  <p class="strong">Pagamento recusado</p>
                  <p class="small muted">O cartão não foi cobrado. Tente outro cartão.</p>
                  <button class="btn btn--ghost" type="button" (click)="retryCard()">Tentar de novo</button>
                </div>
              } @else {
                <div class="state" [class.state--ok]="r.status === 'Paid'" role="status">
                  <div class="state__ring">
                    <ion-icon [name]="r.status === 'Paid' ? 'checkmark-circle' : 'card-outline'" aria-hidden="true" />
                  </div>
                  <p class="strong">{{ r.status === 'Paid' ? 'Pagamento aprovado' : 'Confirmando seu pagamento' }}</p>
                  <p class="small muted">
                    {{ brandName(r.brand) }} final {{ r.last4 }} · {{ r.amount | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                  </p>
                  <p class="small muted">{{ split(r.driverReceives, r.platformFee) }}</p>
                  @if (r.status !== 'Paid') {
                    <p class="field-hint">Esta tela atualiza sozinha assim que o banco responder.</p>
                  }
                  @if (r.cardSaved) {
                    <p class="field-hint">Cartão guardado para as próximas entregas.</p>
                  }
                </div>
              }
            } @else {
              @if (saved().length > 0) {
                <div class="saved" role="radiogroup" aria-label="Cartões salvos">
                  @for (card of saved(); track card.id) {
                    <div class="row" style="gap: 6px">
                      <button
                        type="button"
                        class="saved__item"
                        [class.saved__item--on]="selected() === card.id"
                        role="radio"
                        [attr.aria-checked]="selected() === card.id"
                        (click)="selected.set(card.id)"
                      >
                        <span class="saved__radio" aria-hidden="true"></span>
                        <span class="saved__badge">{{ brandName(card.brand) }}</span>
                        <span class="saved__num">•••• {{ card.last4 }}</span>
                      </button>
                      <button type="button" class="saved__rm" [attr.aria-label]="'Remover cartão final ' + card.last4" (click)="removeCard(card)">
                        <ion-icon name="trash-outline" aria-hidden="true" />
                      </button>
                    </div>
                  }
                  <button
                    type="button"
                    class="saved__item"
                    [class.saved__item--on]="selected() === newCard"
                    role="radio"
                    [attr.aria-checked]="selected() === newCard"
                    (click)="selected.set(newCard)"
                  >
                    <span class="saved__radio" aria-hidden="true"></span>
                    <span class="strong">Usar outro cartão</span>
                  </button>
                </div>
              }

              @if (selected() === newCard) {
                <app-credit-card [number]="number()" [holder]="holder()" [expiry]="expiry()" [ccv]="ccv()" [brand]="brand()" [flipped]="flipped()" />

                <ion-input
                  label="Número do cartão"
                  labelPlacement="stacked"
                  fill="outline"
                  inputmode="numeric"
                  autocomplete="cc-number"
                  placeholder="0000 0000 0000 0000"
                  [value]="number()"
                  (ionInput)="onNumber($event)"
                  [helperText]="numberInvalid() ? '' : ' '"
                  [errorText]="numberInvalid() ? 'Confira o número do cartão' : ''"
                  [class.ion-invalid]="numberInvalid()"
                  [class.ion-touched]="numberInvalid()"
                />
                <ion-input
                  label="Nome como está no cartão"
                  labelPlacement="stacked"
                  fill="outline"
                  autocomplete="cc-name"
                  autocapitalize="characters"
                  [value]="holder()"
                  (ionInput)="onHolder($event)"
                />
                <div class="grid2">
                  <ion-input
                    label="Validade"
                    labelPlacement="stacked"
                    fill="outline"
                    inputmode="numeric"
                    autocomplete="cc-exp"
                    placeholder="MM/AA"
                    [value]="expiry()"
                    (ionInput)="onExpiry($event)"
                  />
                  <ion-input
                    label="Código (CVV)"
                    labelPlacement="stacked"
                    fill="outline"
                    inputmode="numeric"
                    autocomplete="cc-csc"
                    type="password"
                    placeholder="•••"
                    [value]="ccv()"
                    (ionInput)="onCcv($event)"
                    (ionFocus)="flipped.set(true)"
                    (ionBlur)="flipped.set(false)"
                  />
                </div>

                <p class="sub">Dados de quem paga</p>
                <ion-input
                  label="CPF ou CNPJ"
                  labelPlacement="stacked"
                  fill="outline"
                  autocapitalize="characters"
                  [value]="taxId()"
                  (ionInput)="onTaxId($event)"
                />
                <div class="grid2">
                  <ion-input label="CEP" labelPlacement="stacked" fill="outline" inputmode="numeric" autocomplete="postal-code" [value]="zip()" (ionInput)="onZip($event)" />
                  <ion-input label="Número" labelPlacement="stacked" fill="outline" inputmode="numeric" [value]="addressNumber()" (ionInput)="onAddressNumber($event)" />
                </div>
                <ion-input label="Telefone (opcional)" labelPlacement="stacked" fill="outline" inputmode="tel" autocomplete="tel" [value]="phone()" (ionInput)="onPhone($event)" />

                <ion-checkbox labelPlacement="end" justify="start" [checked]="saveCard()" (ionChange)="saveCard.set($event.detail.checked)">
                  Guardar este cartão para as próximas
                </ion-checkbox>
              }

              <button class="btn btn--block" type="button" [disabled]="request.loading() || !cardReady()" (click)="payCard()">
                @if (request.loading()) {
                  <ion-spinner name="crescent" />
                } @else {
                  <ion-icon name="lock-closed-outline" aria-hidden="true" />
                }
                Pagar {{ amount() | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
              </button>
              <p class="secure">
                <ion-icon name="lock-closed-outline" aria-hidden="true" />
                Os dados do cartão seguem direto ao serviço de pagamento e não ficam guardados.
              </p>
            }
          </div>
        }

        @case ('wallet') {
          <div class="pane stack">
            @if (walletResult(); as r) {
              <div class="state" [class.state--ok]="r.status === 'Paid'" role="status">
                <div class="state__ring">
                  <ion-icon [name]="r.status === 'Paid' ? 'checkmark-circle' : 'logo-apple'" aria-hidden="true" />
                </div>
                <p class="strong">{{ r.status === 'Paid' ? 'Pagamento aprovado' : 'Confirmando seu pagamento' }}</p>
                <p class="small muted">{{ split(r.driverReceives, r.platformFee) }}</p>
              </div>
            } @else {
              <p class="small">
                Pague com o cartão da sua carteira do iPhone. O valor cai direto na conta do motorista no Mercado Pago.
              </p>
              <button class="apple" type="button" [disabled]="request.loading()" (click)="payWallet()">
                @if (request.loading()) {
                  <ion-spinner name="crescent" />
                } @else {
                  <ion-icon name="logo-apple" aria-hidden="true" />
                }
                Pagar com Apple Pay
              </button>
              <p class="field-hint">Funciona só se o motorista tiver conectado o Mercado Pago.</p>
            }
          </div>
        }
      }

      <p class="field-hint">Prefere pagar direto ao motorista? Faça isso e aguarde ele confirmar o recebimento.</p>
    </section>
  `,
})
export class DeliveryPaymentComponent {
  private readonly deliveries = inject(CustomerDeliveriesService);
  private readonly cards = inject(CustomerCardsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly wallet = inject(WALLET_TOKEN_PROVIDER);

  readonly deliveryId = input.required<string>();
  readonly amount = input.required<number>();
  /** The page should reload the delivery (a payment may have settled). */
  readonly changed = output<void>();
  /** True while a Pix or a card payment is waiting for the provider, so the page keeps polling. */
  readonly awaiting = output<boolean>();

  protected readonly newCard = NEW_CARD;
  protected readonly walletAvailable = this.wallet.isAvailable();
  protected readonly request = createRequestState();

  protected readonly method = signal<Method>('pix');
  protected readonly saved = signal<SavedCard[]>([]);
  protected readonly selected = signal<string>(NEW_CARD);
  protected readonly pix = signal<PixPayment | null>(null);
  protected readonly cardResult = signal<CardPayment | null>(null);
  protected readonly walletResult = signal<WalletPayment | null>(null);

  protected readonly number = signal('');
  protected readonly holder = signal('');
  protected readonly expiry = signal('');
  protected readonly ccv = signal('');
  protected readonly flipped = signal(false);
  protected readonly taxId = signal('');
  protected readonly zip = signal('');
  protected readonly addressNumber = signal('');
  protected readonly phone = signal('');
  protected readonly saveCard = signal(false);

  protected readonly brand = computed<CardBrand>(() => detectBrand(this.number()));
  protected readonly taxIdReady = computed(() => /^(\d{11}|[A-Z0-9]{14})$/.test(normalizeTaxId(this.taxId())));
  protected readonly numberInvalid = computed(() => {
    const digits = this.number().replace(/\D/g, '');
    return digits.length >= 15 && !luhn(digits);
  });
  protected readonly cardReady = computed(() => {
    if (this.selected() !== NEW_CARD) {
      return true;
    }
    const digits = this.number().replace(/\D/g, '');
    const ccvLength = this.brand() === 'amex' ? 4 : 3;
    return (
      luhn(digits) &&
      this.holder().trim().length >= 3 &&
      parseExpiry(this.expiry()) !== null &&
      this.ccv().length === ccvLength &&
      this.taxIdReady() &&
      normalizeZip(this.zip()).length === 8 &&
      this.addressNumber().trim().length > 0
    );
  });

  constructor() {
    void this.loadSaved();
  }

  protected choose(method: Method): void {
    this.method.set(method);
    this.request.clearError();
  }

  protected brandName(brand: string | null): string {
    const key = (brand ?? '').toLowerCase() as CardBrand;
    return CARD_BRAND_LABEL[key] ?? brand ?? 'Cartão';
  }

  protected split(driver: number, platform: number): string {
    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return `${fmt(driver)} vão direto para o motorista e ${fmt(platform)} para a plataforma.`;
  }

  protected onNumber(event: Event): void {
    this.number.set(this.typed(event, maskCardNumber));
  }
  protected onHolder(event: Event): void {
    this.holder.set(this.typed(event, (v) => v.toUpperCase().replace(/[^A-Z ]/g, '').slice(0, 26)));
  }
  protected onExpiry(event: Event): void {
    this.expiry.set(this.typed(event, maskExpiry));
  }
  protected onCcv(event: Event): void {
    this.ccv.set(this.typed(event, (v) => v.replace(/\D/g, '').slice(0, 4)));
  }
  protected onTaxId(event: Event): void {
    this.taxId.set(this.typed(event, maskTaxId));
  }
  protected onZip(event: Event): void {
    this.zip.set(this.typed(event, maskZip));
  }
  protected onAddressNumber(event: Event): void {
    this.addressNumber.set(this.typed(event, (v) => v.replace(/[^\w\s/-]/g, '').slice(0, 10)));
  }
  protected onPhone(event: Event): void {
    this.phone.set(this.typed(event, maskPhone));
  }

  protected async generatePix(): Promise<void> {
    const pix = await this.request.run(() =>
      firstValueFrom(this.deliveries.payByPix(this.deliveryId(), normalizeTaxId(this.taxId()))),
    );
    if (pix) {
      this.pix.set(pix);
      this.awaiting.emit(true);
    }
  }

  protected async payCard(): Promise<void> {
    const body = this.cardBody();
    const result = await this.request.run(() => firstValueFrom(this.deliveries.payByCard(this.deliveryId(), body)));
    if (!result) {
      return;
    }
    this.cardResult.set(result);
    this.clearSensitive();
    this.awaiting.emit(result.status === 'Pending');
    if (result.status === 'Paid') {
      this.changed.emit();
    }
    if (result.cardSaved) {
      void this.loadSaved();
    }
  }

  protected retryCard(): void {
    this.cardResult.set(null);
    this.request.clearError();
    this.awaiting.emit(false);
  }

  protected async payWallet(): Promise<void> {
    const result = await this.request.run(async () => {
      const token = await this.wallet.request(this.amount());
      if (token === null) {
        throw new ApiError(400, 'wallet.cancelled', 'O pagamento foi cancelado.');
      }
      return firstValueFrom(this.deliveries.payByWallet(this.deliveryId(), token.cardToken, token.paymentMethodId));
    });
    if (!result) {
      return;
    }
    this.walletResult.set(result);
    this.awaiting.emit(result.status === 'Pending');
    if (result.status === 'Paid') {
      this.changed.emit();
    }
  }

  protected async removeCard(card: SavedCard): Promise<void> {
    const ok = await this.confirm.confirm({
      header: 'Remover cartão?',
      message: `${this.brandName(card.brand)} final ${card.last4} deixa de aparecer aqui.`,
      confirmText: 'Remover',
      cancelText: 'Manter',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    const done = await this.request.run(async () => {
      await firstValueFrom(this.cards.remove(card.id));
      return true;
    });
    if (done) {
      this.saved.update((list) => list.filter((c) => c.id !== card.id));
      if (this.selected() === card.id) {
        this.selected.set(this.saved()[0]?.id ?? NEW_CARD);
      }
      await this.toast.show('Cartão removido.');
    }
  }

  private cardBody(): PayWithCardRequest {
    if (this.selected() !== NEW_CARD) {
      return { savedCardId: this.selected(), saveCard: false };
    }
    const expiry = parseExpiry(this.expiry());
    return {
      card: {
        holderName: this.holder().trim(),
        number: this.number().replace(/\D/g, ''),
        expiryMonth: expiry?.month ?? '',
        expiryYear: expiry?.year ?? '',
        ccv: this.ccv(),
      },
      holder: {
        taxId: normalizeTaxId(this.taxId()),
        postalCode: normalizeZip(this.zip()),
        addressNumber: this.addressNumber().trim(),
        phone: normalizePhone(this.phone()) || null,
      },
      saveCard: this.saveCard(),
    };
  }

  /** The number and the code are not kept after the request, whatever the answer. */
  private clearSensitive(): void {
    this.number.set('');
    this.ccv.set('');
    this.flipped.set(false);
  }

  private typed(event: Event, mask: (value: string) => string): string {
    const target = event.target as HTMLIonInputElement;
    const value = String((event as CustomEvent<{ value?: string | null }>).detail?.value ?? '');
    const masked = mask(value);
    if (masked !== value) {
      target.value = masked;
    }
    return masked;
  }

  private async loadSaved(): Promise<void> {
    try {
      const list = await firstValueFrom(this.cards.list());
      this.saved.set(list);
      this.selected.set(list[0]?.id ?? NEW_CARD);
    } catch {
      // Saved cards are a convenience: without them the form for a new card still works.
    }
  }
}
