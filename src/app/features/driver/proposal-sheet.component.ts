import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner, ModalController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { FreeFreightService } from '../../core/api/free-freight.service';
import { OpenFreight, Vehicle } from '../../core/models';
import { VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { createRequestState } from '../../core/ui/request-state';
import { parseDecimal } from '../../core/util/normalizers';
import { PLATFORM_FEE } from '../../core/util/fees';
import { formatDistance, formatDuration } from '../../core/util/route-format';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { greaterThan } from '../../shared/forms/validators';
import { UtcPipe } from '../../shared/pipes/utc.pipe';


/**
 * Bottom sheet where an approved driver prices a freight. Laid out like a freight slip: what and where on top, the price
 * and what is left for the driver in the middle, the vehicle as its plate, and the free-freight rule next to the button.
 */
@Component({
  selector: 'app-proposal-sheet',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule, IonContent, IonSpinner, CountdownComponent, ProblemAlertComponent, UtcPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content>
      <form class="sheet" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <header class="bar">
          <span class="bar__title">Sua proposta</span>
          <button class="bar__close" type="button" (click)="close()">Fechar</button>
        </header>

        <section class="slip" aria-label="Frete">
          <div class="slip__row">
            <span class="tag">{{ typeLabel[freight().requiredVehicleType] }} · {{ freight().cargoWeightKg | number: '1.0-0' : 'pt-BR' }} kg</span>
            <span class="slip__clock">fecha em <app-countdown [until]="freight().proposalDeadline" /></span>
          </div>
          <h2 class="slip__cargo">{{ freight().cargoDescription }}</h2>

          <div class="leg">
            <div class="leg__end">
              <span class="cap">Coleta</span>
              <strong>{{ origin()?.district }}</strong>
              <span class="leg__city">{{ origin()?.city }}</span>
            </div>
            <div class="leg__mid" aria-hidden="true">
              <span class="leg__km">{{ distance() ?? '—' }}</span>
            </div>
            <div class="leg__end leg__end--right">
              <span class="cap">{{ freight().deliveryCount > 1 ? freight().deliveryCount + ' entregas' : 'Entrega' }}</span>
              <strong>{{ destination()?.district }}</strong>
              <span class="leg__city">{{ destination()?.city }}</span>
            </div>
          </div>

          <p class="slip__foot">
            @if (freight().scheduledPickupAt; as when) {
              Coleta {{ when | utc | date: "dd/MM 'às' HH:mm" }}
            } @else {
              Coleta hoje
            }
            @if (duration(); as time) {
              · ~{{ time }} de estrada
            }
          </p>
        </section>

        <section class="price" aria-label="Preço">
          <label class="cap" for="price">Quanto você cobra</label>
          <div class="price__field" [class.price__field--bad]="priceTouched() && form.controls.price.invalid">
            <span class="price__cur">R$</span>
            <input
              id="price"
              class="price__input"
              formControlName="price"
              inputmode="decimal"
              autocomplete="off"
              placeholder="0,00"
              (input)="onPrice($event)"
            />
          </div>
          <dl class="net">
            <div>
              <dt>Taxa da plataforma</dt>
              <dd>− {{ fee | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</dd>
            </div>
            <div class="net__total">
              <dt>Fica com você</dt>
              <dd>{{ net() | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</dd>
            </div>
          </dl>
          @if (tooLow()) {
            <p class="hint hint--bad">Abaixo da taxa: o cliente não consegue pagar este valor pelo app.</p>
          } @else {
            <p class="hint">O cliente vê as propostas da mais barata para a mais cara.</p>
          }
        </section>

        <fieldset class="plates">
          <legend class="cap">Veículo</legend>
          @for (vehicle of vehicles(); track vehicle.id) {
            <label class="plate-opt" [class.plate-opt--on]="vehicleId() === vehicle.id">
              <input type="radio" formControlName="vehicleId" [value]="vehicle.id" />
              <span class="plate">
                <span class="plate__band">BRASIL</span>
                <span class="plate__num">{{ vehicle.plate }}</span>
              </span>
              <span class="plate-opt__model">{{ vehicle.model }}</span>
            </label>
          }
          @if (vehicleTouched() && form.controls.vehicleId.invalid) {
            <p class="hint hint--bad">Escolha o veículo.</p>
          }
        </fieldset>

        <label class="note">
          <span class="cap">Recado para o cliente <em>opcional</em></span>
          <textarea formControlName="message" rows="2" maxlength="300" placeholder="Ex.: coleto em 20 minutos, levo carrinho de carga."></textarea>
          <span class="note__count">{{ messageLength() }}/300</span>
        </label>

        <app-problem-alert [error]="request.error()">
          @if (request.error()?.code === 'subscription.required') {
            {{ ' ' }}<button class="inline-link" type="button" (click)="goToPlans()">Ver planos</button>
          }
        </app-problem-alert>

        <footer class="send">
          @switch (freeState()) {
            @case ('available') {
              <p class="rule">
                <span class="rule__count">0/1</span>
                <span>
                  Você está sem plano. Se esta proposta for a primeira aprovada, ela usa o seu frete grátis e os próximos só
                  com assinatura.
                </span>
              </p>
            }
            @case ('used') {
              @if (request.error()?.code !== 'subscription.required') {
                <p class="rule rule--stop">
                  <span class="rule__count">1/1</span>
                  <span>
                    Frete grátis já usado. Sem plano, esta proposta volta recusada.
                    <button class="inline-link" type="button" (click)="goToPlans()">Ver planos</button>
                  </span>
                </p>
              }
            }
          }
          <button class="btn btn--block send__btn" type="submit" [disabled]="request.loading()">
            @if (request.loading()) {
              <ion-spinner name="crescent" />
            }
            @if (priceValue(); as p) {
              Enviar por {{ p | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
            } @else {
              Enviar proposta
            }
          </button>
        </footer>
      </form>
    </ion-content>
  `,
  styles: `
    .sheet {
      display: flex;
      flex-direction: column;
      gap: 22px;
      /* The sheet opens at 90% of the screen: the last 10% sits below the fold. */
      padding: 6px 18px calc(24px + 10vh + var(--ion-safe-area-bottom, 0px));
    }
    .cap em {
      font-style: normal;
      text-transform: none;
      letter-spacing: 0;
      font-weight: 500;
    }

    /* header */
    .bar {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-top: 10px;
    }
    .bar__title {
      font: 700 1.25rem/1 var(--font-display);
      letter-spacing: -0.02em;
    }
    .bar__close {
      border: 0;
      background: none;
      padding: 6px 0;
      font: 600 14px var(--font-body);
      color: var(--ink-soft);
      cursor: pointer;
    }

    /* freight slip */
    .slip {
      position: relative;
      padding: 16px 16px 14px;
      border-radius: 18px;
      background: #0d0d0f;
      color: #fff;
    }
    .slip::before,
    .slip::after {
      content: '';
      position: absolute;
      bottom: 40px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--white);
    }
    .slip::before {
      left: -8px;
    }
    .slip::after {
      right: -8px;
    }
    .slip__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .tag {
      font: 600 11px/1 var(--font-mono);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 5px 8px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.1);
    }
    .slip__clock {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
    }
    .slip__clock app-countdown {
      color: #fff;
      font-weight: 700;
    }
    .slip__cargo {
      margin: 12px 0 14px;
      font: 700 1.3rem/1.15 var(--font-display);
      letter-spacing: -0.02em;
      color: #fff;
    }
    .leg {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: end;
      gap: 10px;
    }
    .leg .cap {
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 4px;
    }
    .leg__end strong {
      display: block;
      font-size: 15px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .leg__city {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.55);
    }
    .leg__end--right {
      text-align: right;
    }
    .leg__mid {
      position: relative;
      min-width: 84px;
      align-self: center;
      text-align: center;
      padding-top: 2px;
    }
    .leg__mid::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      border-top: 2px dashed rgba(255, 255, 255, 0.28);
    }
    .leg__km {
      position: relative;
      padding: 0 6px;
      background: #0d0d0f;
      font: 700 12px var(--font-mono);
      color: var(--red);
    }
    .slip__foot {
      margin: 14px 0 0;
      padding-top: 12px;
      border-top: 1.5px dashed rgba(255, 255, 255, 0.18);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
    }

    /* price */
    .price__field {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-top: 6px;
      padding-bottom: 6px;
      border-bottom: 2px solid var(--black);
      transition: border-color 0.2s;
    }
    .price__field:focus-within {
      border-color: var(--red);
    }
    .price__field--bad {
      border-color: var(--red);
    }
    .price__cur {
      font: 600 1.2rem var(--font-display);
      color: var(--ink-soft);
    }
    .price__input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      padding: 0;
      font: 700 2.6rem/1.1 var(--font-display);
      letter-spacing: -0.03em;
      color: var(--black);
    }
    .price__input::placeholder {
      color: #d4d4d8;
    }
    .net {
      margin: 12px 0 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
    }
    .net div {
      display: flex;
      justify-content: space-between;
    }
    .net dt {
      color: var(--ink-soft);
    }
    .net dd {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 13px;
    }
    .net__total dt {
      color: var(--black);
      font-weight: 700;
    }
    .net__total dd {
      font-weight: 700;
      font-size: 15px;
    }
    .hint {
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--ink-mute);
    }
    .hint--bad {
      color: var(--red-deep);
      font-weight: 600;
    }

    /* vehicle plates */
    .plates {
      border: 0;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .plates legend {
      margin-bottom: 8px;
      padding: 0;
    }
    .plate-opt {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 12px;
      border: 1.5px solid var(--line);
      border-radius: 14px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .plate-opt input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .plate-opt--on {
      border-color: var(--black);
      box-shadow: inset 0 0 0 1px var(--black);
    }
    .plate-opt:has(input:focus-visible) {
      outline: 2px solid var(--red);
      outline-offset: 2px;
    }
    .plate {
      flex: none;
      width: 104px;
      border: 2px solid #1b1b1f;
      border-radius: 6px;
      background: #fff;
      overflow: hidden;
      text-align: center;
    }
    .plate__band {
      display: block;
      background: #1f3fa8;
      color: #fff;
      font: 700 7px/1 var(--font-body);
      letter-spacing: 0.24em;
      padding: 3px 0 2px;
    }
    .plate__num {
      display: block;
      font: 700 17px/1.4 var(--font-mono);
      letter-spacing: 0.06em;
      color: #111;
    }
    .plate-opt__model {
      font-weight: 600;
      font-size: 14px;
    }

    /* message */
    .note {
      position: relative;
      display: block;
    }
    .note textarea {
      display: block;
      width: 100%;
      margin-top: 6px;
      padding: 12px 14px 22px;
      resize: none;
      border: 1.5px solid var(--field-line);
      border-radius: 12px;
      font: 15px/1.4 var(--font-body);
      color: var(--black);
      background: var(--white);
      outline: 0;
    }
    .note textarea:focus {
      border-color: var(--black);
    }
    .note__count {
      position: absolute;
      right: 12px;
      bottom: 8px;
      font: 11px var(--font-mono);
      color: var(--ink-mute);
    }

    /* send */
    .send {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .rule {
      margin: 0;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 13px;
      line-height: 1.45;
      color: var(--ink-soft);
    }
    .rule__count {
      flex: none;
      font: 700 12px/1 var(--font-mono);
      padding: 5px 7px;
      border-radius: 6px;
      border: 1.5px solid var(--black);
      color: var(--black);
    }
    .rule--stop {
      color: var(--red-deep);
    }
    .rule--stop .rule__count {
      border-color: var(--red);
      background: var(--red);
      color: #fff;
    }
    .inline-link {
      border: 0;
      padding: 0;
      background: none;
      font: inherit;
      font-weight: 700;
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
    }
    .send__btn {
      min-height: 54px;
      font-size: 16px;
    }
  `,
})
export class ProposalSheetComponent implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly marketplace = inject(DriverMarketplaceService);
  private readonly modals = inject(ModalController);
  private readonly router = inject(Router);
  private readonly freeFreight = inject(FreeFreightService);

  readonly freight = input.required<OpenFreight>();
  /** Vehicles that already fit the freight (type and weight). */
  readonly vehicles = input.required<readonly Vehicle[]>();

  protected readonly typeLabel = VEHICLE_TYPE_LABEL;
  protected readonly fee = PLATFORM_FEE;
  protected readonly request = createRequestState();
  protected readonly freeState = this.freeFreight.state;

  protected readonly form = this.fb.group({
    vehicleId: ['', [Validators.required]],
    price: ['', [Validators.required, greaterThan(0)]],
    message: ['', [Validators.maxLength(300)]],
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private readonly submitted = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  protected readonly vehicleId = computed(() => this.values().vehicleId ?? '');
  protected readonly priceValue = computed(() => {
    const value = parseDecimal(this.values().price ?? '');
    return value !== null && value > 0 ? value : null;
  });
  protected readonly net = computed(() => Math.max(0, (this.priceValue() ?? 0) - PLATFORM_FEE));
  protected readonly tooLow = computed(() => {
    const price = this.priceValue();
    return price !== null && price <= PLATFORM_FEE;
  });
  protected readonly messageLength = computed(() => (this.values().message ?? '').length);
  protected readonly priceTouched = computed(() => (this.submitted(), this.form.controls.price.touched));
  protected readonly vehicleTouched = computed(() => (this.submitted(), this.form.controls.vehicleId.touched));

  private readonly sortedStops = computed(() => [...this.freight().stops].sort((a, b) => a.sequence - b.sequence));
  protected readonly origin = computed(() => this.sortedStops().at(0));
  protected readonly destination = computed(() => this.sortedStops().at(-1));
  protected readonly distance = computed(() => formatDistance(this.freight().routeDistanceMeters));
  protected readonly duration = computed(() => formatDuration(this.freight().routeDurationSeconds));

  ngOnInit(): void {
    // With a single eligible vehicle there is nothing to choose.
    const [only] = this.vehicles();
    if (only && this.vehicles().length === 1) {
      this.form.controls.vehicleId.setValue(only.id);
    }
  }

  /** Digits and one comma, at most two decimals: `1250,5`. */
  protected onPrice(event: Event): void {
    const target = event.target as HTMLInputElement;
    const [whole, ...rest] = target.value.replace(/\./g, ',').replace(/[^\d,]/g, '').split(',');
    const cleaned = rest.length > 0 ? `${whole.slice(0, 6)},${rest.join('').slice(0, 2)}` : whole.slice(0, 6);
    if (cleaned !== target.value) {
      target.value = cleaned;
      this.form.controls.price.setValue(cleaned);
    }
  }

  protected async goToPlans(): Promise<void> {
    await this.modals.dismiss(null, 'cancel');
    await this.router.navigateByUrl('/driver/billing');
  }

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.form.updateValueAndValidity();
      return;
    }
    const { vehicleId, price, message } = this.form.getRawValue();
    const proposal = await this.request.run(() =>
      firstValueFrom(
        this.marketplace.submitProposal(this.freight().id, {
          vehicleId,
          price: parseDecimal(price) ?? 0,
          message: message.trim() || null,
        }),
      ),
    );
    if (proposal) {
      await this.modals.dismiss(proposal, 'submitted');
    }
  }
}
