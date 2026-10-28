import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonFooter, IonIcon, IonInput, IonSpinner, IonTextarea } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AddressesService } from '../../core/api/addresses.service';
import { FreightsService } from '../../core/api/freights.service';
import { ApiError } from '../../core/http/api-error';
import { Address, RouteMap, VEHICLE_TYPES, VehicleType } from '../../core/models';
import { VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { areaLine, streetLine } from '../../core/util/address-format';
import { localInputToUtcIso } from '../../core/util/dates';
import { toJpegDataUrl } from '../../core/util/image-file';
import { parseDecimal } from '../../core/util/normalizers';
import { StopView } from '../../core/util/stop-views';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { RouteMapCardComponent } from '../../shared/components/route-map-card.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { greaterThan, notBlank } from '../../shared/forms/validators';
import { DraftStop, initialStops, toRequestStops, validateStops } from './freight-draft';
import { FreightSummary, FreightSummaryComponent, SummarySection } from './freight-summary.component';
import { RoutePlannerComponent } from './route-planner.component';

type Timing = 'today' | 'scheduled';

interface WizardStep {
  readonly label: string;
  readonly title: string;
  readonly help: string;
}

const STEPS: readonly WizardStep[] = [
  { label: 'Rota', title: 'Para onde vai o frete?', help: 'Escolha onde coletar e onde entregar. Se houver mais paradas no caminho, adicione.' },
  { label: 'Carga', title: 'O que vai ser transportado?', help: 'Os motoristas só veem fretes que cabem no veículo deles.' },
  { label: 'Coleta', title: 'Quando coletar?', help: 'Isso define por quanto tempo os motoristas podem enviar propostas.' },
  { label: 'Revisar', title: 'Confira e publique', help: 'Depois de publicar, os motoristas compatíveis já podem enviar preços.' },
];

const LAST_STEP = STEPS.length - 1;

/** `YYYY-MM-DDTHH:mm` in local time, the format `datetime-local` inputs use. */
function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Requests a freight one question at a time: route, cargo, when, then a review. On wide screens a live
 * summary stays beside the form. Same-day freights take proposals for 5 minutes; scheduled ones for up to 24 hours.
 */
@Component({
  selector: 'app-new-freight-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonFooter,
    IonIcon,
    IonInput,
    IonSpinner,
    IonTextarea,
    FreightSummaryComponent,
    PageBarComponent,
    ProblemAlertComponent,
    RouteMapCardComponent,
    RoutePlannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './new-freight.page.scss',
  template: `
    <app-page-bar title="Novo frete" backHref="/customer/freights" />

    <ion-content>
      <div class="page page--wide page--with-bar">
        <nav class="stepper" aria-label="Etapas do pedido">
          <div class="stepper__track">
            <div class="progress" role="progressbar" aria-valuemin="1" [attr.aria-valuemax]="steps.length" [attr.aria-valuenow]="step() + 1">
              <span [style.width.%]="((step() + 1) / steps.length) * 100"></span>
            </div>
            <ion-icon
              class="stepper__vehicle"
              src="icons/bus.svg"
              aria-hidden="true"
              [style.left.%]="(step() / (steps.length - 1)) * 100"
            />
          </div>
          <ol class="stepper__list">
            @for (item of steps; track item.label; let i = $index) {
              <li>
                <button
                  type="button"
                  class="stepper__dot"
                  [class.is-current]="i === step()"
                  [class.is-done]="i < step()"
                  [disabled]="i > reached()"
                  [attr.aria-current]="i === step() ? 'step' : null"
                  (click)="go(i)"
                >
                  <span class="stepper__num">
                    @if (i < step()) {
                      <ion-icon name="checkmark-outline" aria-hidden="true" />
                    } @else {
                      {{ i + 1 }}
                    }
                  </span>
                  <span class="stepper__label">{{ item.label }}</span>
                </button>
              </li>
            }
          </ol>
        </nav>

        <div class="wizard" [class.wizard--review]="step() === lastStep">
          <section class="wizard__main stack stack--lg">
            <header class="stack">
              <p class="eyebrow">Passo {{ step() + 1 }} de {{ steps.length }}</p>
              <h1 class="wizard__title">{{ current().title }}</h1>
              <p class="lede">{{ current().help }}</p>
            </header>

            @switch (step()) {
              @case (0) {
                <app-problem-alert [error]="addressesRequest.error()" />
                <app-route-planner [addresses]="addresses()" [(stops)]="stops" (addressSaved)="onAddressSaved($event)" />
                @if (chosen().length >= 2) {
                  <app-route-map-card
                    [route]="route()"
                    [loading]="routeLoading()"
                    [error]="routeError()"
                    [missing]="missingPosition()"
                  />
                }
                @if (tried() && stopProblems().length > 0) {
                  <div class="notice notice--error" role="alert">
                    <ul>
                      @for (problem of stopProblems(); track problem) {
                        <li>{{ problem }}</li>
                      }
                    </ul>
                  </div>
                }
              }

              @case (1) {
                <form class="stack" [formGroup]="cargoForm" (ngSubmit)="next()" novalidate>
                  <ion-input
                    formControlName="cargoDescription"
                    label="O que será transportado"
                    labelPlacement="stacked"
                    fill="outline"
                    placeholder="Autopeças, móveis, caixas..."
                    enterkeyhint="next"
                    errorText="Descreva a carga"
                  />
                  <ion-input
                    formControlName="cargoWeightKg"
                    label="Peso total"
                    labelPlacement="stacked"
                    fill="outline"
                    inputmode="decimal"
                    placeholder="Ex.: 250"
                    enterkeyhint="done"
                    helperText="Some o peso de todos os itens, em quilos."
                    errorText="Informe um peso maior que zero"
                  >
                    <span slot="end" class="unit">kg</span>
                  </ion-input>

                  <fieldset class="field-set">
                    <legend>Tipo de veículo</legend>
                    <div class="choice-grid" role="radiogroup" aria-label="Tipo de veículo">
                      @for (type of vehicleTypes; track type) {
                        <button
                          class="choice"
                          type="button"
                          role="radio"
                          [attr.aria-checked]="cargoForm.controls.requiredVehicleType.value === type"
                          [class.is-selected]="cargoForm.controls.requiredVehicleType.value === type"
                          (click)="cargoForm.controls.requiredVehicleType.setValue(type)"
                        >
                          {{ vehicleLabel[type] }}
                        </button>
                      }
                    </div>
                    <p class="field-hint">Escolha o menor veículo que comporta a carga.</p>
                  </fieldset>

                  <ion-textarea
                    formControlName="driverNote"
                    label="Observação para o motorista (opcional)"
                    labelPlacement="stacked"
                    fill="outline"
                    placeholder="Ex.: portão verde, falar com o João"
                    [counter]="true"
                    maxlength="300"
                    [autoGrow]="true"
                  />

                  <div class="stack">
                    <span class="strong">Foto da carga (opcional)</span>
                    <p class="field-hint">Ajuda o motorista a ver o tamanho e o tipo da carga antes de propor.</p>
                    @if (photoPreview(); as preview) {
                      <img class="cargo-photo" [src]="preview" alt="Foto da carga escolhida" />
                    }
                    <div class="file-row">
                      <button class="btn btn--ghost btn--sm" type="button" (click)="camera.click()">
                        <ion-icon name="camera-outline" aria-hidden="true" />
                        {{ photoPreview() ? 'Tirar outra' : 'Tirar foto' }}
                      </button>
                      <button class="btn btn--ghost btn--sm" type="button" (click)="picker.click()">
                        <ion-icon name="image-outline" aria-hidden="true" />
                        Escolher da galeria
                      </button>
                      @if (photoPreview()) {
                        <button class="link-btn" type="button" (click)="clearPhoto()">Remover</button>
                      }
                      <input
                        #camera
                        class="sr-only"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        tabindex="-1"
                        aria-label="Tirar foto da carga"
                        (click)="resetInput($event)"
                        (change)="onPhoto($event)"
                      />
                      <input
                        #picker
                        class="sr-only"
                        type="file"
                        accept="image/jpeg,image/png"
                        tabindex="-1"
                        aria-label="Escolher foto da carga"
                        (click)="resetInput($event)"
                        (change)="onPhoto($event)"
                      />
                    </div>
                    @if (photoProblem(); as problem) {
                      <p class="field-hint">{{ problem }}</p>
                    }
                  </div>
                </form>
              }

              @case (2) {
                <div class="choice-grid choice-grid--wide" role="radiogroup" aria-label="Quando coletar">
                  <button
                    class="choice choice--card"
                    type="button"
                    role="radio"
                    [attr.aria-checked]="timing() === 'today'"
                    [class.is-selected]="timing() === 'today'"
                    (click)="timing.set('today')"
                  >
                    <ion-icon name="flash-outline" aria-hidden="true" />
                    <strong>Hoje, o quanto antes</strong>
                    <small>Os motoristas têm 5 minutos para enviar propostas.</small>
                  </button>
                  <button
                    class="choice choice--card"
                    type="button"
                    role="radio"
                    [attr.aria-checked]="timing() === 'scheduled'"
                    [class.is-selected]="timing() === 'scheduled'"
                    (click)="timing.set('scheduled')"
                  >
                    <ion-icon name="calendar-outline" aria-hidden="true" />
                    <strong>Agendar data e hora</strong>
                    <small>Os motoristas têm até 24 horas para enviar propostas.</small>
                  </button>
                </div>

                @if (timing() === 'scheduled') {
                  <ion-input
                    type="datetime-local"
                    label="Data e hora da coleta"
                    labelPlacement="stacked"
                    fill="outline"
                    [min]="minScheduled"
                    [value]="scheduledAt()"
                    (ionInput)="onScheduled($event.detail.value)"
                  />
                  @if (tried() && scheduleProblem(); as problem) {
                    <div class="notice notice--error" role="alert">{{ problem }}</div>
                  }
                }
              }

              @case (3) {
                <app-freight-summary [summary]="summary()" [editable]="true" (edit)="go($event)" />

                @if (chosen().length >= 2) {
                  <app-route-map-card
                    [route]="route()"
                    [loading]="routeLoading()"
                    [error]="routeError()"
                    [missing]="missingPosition()"
                  />
                }

                <app-problem-alert [error]="publishRequest.error()">
                  @if (publishRequest.error()?.code === 'freight.terms_not_accepted') {
                    <p><a class="link-btn" routerLink="/terms">Ler e aceitar os termos</a></p>
                  }
                </app-problem-alert>
              }
            }
          </section>

          @if (step() < lastStep) {
            <aside class="wizard__aside" aria-label="Resumo do pedido">
              <div class="panel stack stack--lg">
                <h2 class="aside__title">Seu pedido</h2>
                <app-freight-summary [summary]="summary()" />
              </div>
            </aside>
          }
        </div>
      </div>
    </ion-content>

    <ion-footer class="wizard-footer">
      <div class="wizard-footer__inner">
        @if (step() === 0) {
          <a class="btn btn--ghost" routerLink="/customer/freights">Cancelar</a>
        } @else {
          <button class="btn btn--ghost" type="button" [disabled]="publishRequest.loading()" (click)="back()">Voltar</button>
        }

        @if (step() < lastStep) {
          <button class="btn" type="button" (click)="next()">
            Continuar <ion-icon name="chevron-forward-outline" aria-hidden="true" />
          </button>
        } @else {
          <button class="btn" type="button" [disabled]="publishRequest.loading()" (click)="publish()">
            @if (publishRequest.loading()) {
              <ion-spinner name="crescent" />
            }
            Publicar frete
          </button>
        }
      </div>
    </ion-footer>
  `,
})
export class NewFreightPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly addressesApi = inject(AddressesService);
  private readonly freights = inject(FreightsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly steps = STEPS;
  protected readonly lastStep = LAST_STEP;
  protected readonly vehicleTypes = VEHICLE_TYPES;
  protected readonly vehicleLabel = VEHICLE_TYPE_LABEL;
  protected readonly addressesRequest = createRequestState();
  protected readonly publishRequest = createRequestState();

  protected readonly step = signal(0);
  /** The furthest step the customer has reached, so earlier ones can be revisited from the stepper. */
  protected readonly reached = signal(0);
  /** Set after "Continuar" on an incomplete step, so errors appear only once the customer tried to move on. */
  protected readonly tried = signal(false);

  protected readonly addresses = signal<readonly Address[]>([]);
  protected readonly stops = signal<readonly DraftStop[]>(initialStops());
  protected readonly timing = signal<Timing>('today');
  protected readonly scheduledAt = signal('');
  protected readonly minScheduled = localInputValue(new Date());

  protected readonly photoPreview = signal<string | null>(null);
  protected readonly photoProblem = signal<string | null>(null);
  private photo: string | null = null;

  protected readonly cargoForm = this.fb.group({
    cargoDescription: ['', [notBlank, Validators.maxLength(200)]],
    cargoWeightKg: ['', [Validators.required, greaterThan(0)]],
    requiredVehicleType: ['Fiorino' as VehicleType, [Validators.required]],
    driverNote: ['', [Validators.maxLength(300)]],
  });

  protected readonly current = computed(() => STEPS[this.step()] ?? STEPS[0]!);
  protected readonly stopProblems = computed(() => validateStops(this.stops()));

  protected readonly scheduleProblem = computed(() => {
    if (this.timing() !== 'scheduled') {
      return null;
    }
    const value = this.scheduledAt();
    if (!value) {
      return 'Escolha a data e a hora da coleta.';
    }
    return new Date(value).getTime() > Date.now() ? null : 'A coleta agendada precisa ser no futuro.';
  });

  private readonly formTick = signal(0);

  /** The chosen addresses in the order of the run, once the stops are valid (every one picked, none repeated). */
  protected readonly chosen = computed<Address[]>(() => {
    if (this.stopProblems().length > 0) {
      return [];
    }
    const byId = new Map(this.addresses().map((address) => [address.id, address] as const));
    return this.stops()
      .map((stop) => byId.get(stop.addressId))
      .filter((address): address is Address => address !== undefined);
  });
  protected readonly missingPosition = computed(() =>
    this.chosen()
      .filter((address) => address.latitude === null || address.longitude === null)
      .map((address) => address.label),
  );

  // Route preview (distance, time, map). Asked as soon as the addresses are chosen and ordered, before publishing.
  protected readonly route = signal<RouteMap | null>(null);
  protected readonly routeLoading = signal(false);
  protected readonly routeError = signal<ApiError | null>(null);
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private previewToken = 0;

  protected readonly summary = computed<FreightSummary>(() => {
    this.formTick();
    const cargo = this.cargoForm.getRawValue();
    const weight = parseDecimal(cargo.cargoWeightKg);
    const byId = new Map(this.addresses().map((address) => [address.id, address] as const));
    const stops: StopView[] = this.stops()
      .map((stop, index) => ({ stop, index, address: byId.get(stop.addressId) }))
      .filter((entry): entry is { stop: DraftStop; index: number; address: Address } => entry.address !== undefined)
      .map(({ stop, index, address }) => ({
        sequence: index + 1,
        type: stop.type,
        title: `${address.label} · ${streetLine(address)}`,
        subtitle: areaLine(address),
        note: stop.note.trim() || null,
        items: stop.items,
        done: false,
      }));
    const scheduled = this.timing() === 'scheduled' && this.scheduledAt() !== '';
    return {
      stops,
      cargo: cargo.cargoDescription.trim(),
      weightText: weight ? `${weight.toLocaleString('pt-BR')} kg` : '',
      vehicle: VEHICLE_TYPE_LABEL[cargo.requiredVehicleType],
      driverNote: cargo.driverNote.trim(),
      hasPhoto: this.photoPreview() !== null,
      whenText: this.timing() === 'today' ? 'Hoje, o quanto antes' : scheduled ? this.formatWhen(this.scheduledAt()) : 'Agendado (escolha a data)',
      windowText:
        this.timing() === 'today'
          ? 'Os motoristas têm 5 minutos para enviar propostas depois que você publicar.'
          : 'Os motoristas têm até 24 horas para enviar propostas.',
    };
  });

  constructor() {
    // The summary reads the reactive form, which is not a signal: nudge it when the form changes.
    this.cargoForm.valueChanges.subscribe(() => this.formTick.update((n) => n + 1));

    effect(() => {
      const ids = this.chosen().map((address) => address.id);
      const missing = this.missingPosition().length > 0;
      untracked(() => this.schedulePreview(ids, missing));
    });
  }

  private schedulePreview(addressIds: readonly string[], hasMissingPosition: boolean): void {
    if (this.previewTimer !== null) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    this.previewToken += 1;
    const token = this.previewToken;
    this.routeError.set(null);

    // Without a position on every address the API would answer 400; say so locally and skip the call.
    if (addressIds.length < 2 || hasMissingPosition) {
      this.route.set(null);
      this.routeLoading.set(false);
      return;
    }
    this.routeLoading.set(true);
    this.previewTimer = setTimeout(async () => {
      try {
        const route = await firstValueFrom(this.freights.routePreview(addressIds));
        if (token === this.previewToken) {
          this.route.set(route);
        }
      } catch (caught) {
        if (token === this.previewToken) {
          this.route.set(null);
          this.routeError.set(ApiError.from(caught));
        }
      } finally {
        if (token === this.previewToken) {
          this.routeLoading.set(false);
        }
      }
    }, 350);
  }

  ionViewWillEnter(): void {
    void this.loadAddresses();
  }

  protected onScheduled(value: string | number | null | undefined): void {
    this.scheduledAt.set(typeof value === 'string' ? value : '');
  }

  protected resetInput(event: Event): void {
    (event.target as HTMLInputElement).value = '';
  }

  protected async onPhoto(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.photoProblem.set(null);
    try {
      const image = await toJpegDataUrl(file);
      this.photo = image;
      this.photoPreview.set(image);
    } catch {
      this.photoProblem.set('Não foi possível ler essa foto. Tente outra.');
    }
  }

  protected clearPhoto(): void {
    this.photo = null;
    this.photoPreview.set(null);
    this.photoProblem.set(null);
  }

  protected onAddressSaved(address: Address): void {
    this.addresses.update((list) => (list.some((item) => item.id === address.id) ? list : [...list, address]));
  }

  protected go(index: number | SummarySection): void {
    if (index <= this.reached()) {
      this.step.set(index);
      this.tried.set(false);
    }
  }

  protected back(): void {
    this.go(Math.max(0, this.step() - 1));
  }

  protected next(): void {
    if (!this.stepValid(this.step())) {
      this.tried.set(true);
      if (this.step() === 1) {
        this.cargoForm.markAllAsTouched();
      }
      return;
    }
    const target = Math.min(LAST_STEP, this.step() + 1);
    this.reached.update((value) => Math.max(value, target));
    this.step.set(target);
    this.tried.set(false);
  }

  protected async publish(): Promise<void> {
    // If an earlier step became invalid, send the customer back to it instead of failing silently.
    for (let index = 0; index < LAST_STEP; index += 1) {
      if (!this.stepValid(index)) {
        this.step.set(index);
        this.tried.set(true);
        this.cargoForm.markAllAsTouched();
        await this.toast.show('Falta completar este passo antes de publicar.');
        return;
      }
    }
    const cargo = this.cargoForm.getRawValue();
    const freight = await this.publishRequest.run(() =>
      firstValueFrom(
        this.freights.create({
          stops: toRequestStops(this.stops()),
          cargoDescription: cargo.cargoDescription.trim(),
          cargoWeightKg: parseDecimal(cargo.cargoWeightKg) ?? 0,
          requiredVehicleType: cargo.requiredVehicleType,
          scheduledPickupAt: this.timing() === 'scheduled' ? localInputToUtcIso(this.scheduledAt()) : null,
          driverNote: cargo.driverNote.trim() || null,
        }),
      ),
    );
    if (freight) {
      const photo = this.photo;
      this.resetDraft();
      let photoSent = true;
      if (photo) {
        try {
          await firstValueFrom(this.freights.uploadCargoPhoto(freight.id, photo));
        } catch {
          photoSent = false;
        }
      }
      await this.toast.show(
        photoSent
          ? 'Frete publicado. Agora é só esperar as propostas.'
          : 'Frete publicado, mas a foto da carga não foi enviada.',
      );
      await this.router.navigate(['/customer/freights', freight.id], { replaceUrl: true });
    }
  }

  private stepValid(index: number): boolean {
    switch (index) {
      case 0:
        return this.stopProblems().length === 0;
      case 1:
        return this.cargoForm.valid;
      case 2:
        return this.scheduleProblem() === null;
      default:
        return true;
    }
  }

  private formatWhen(local: string): string {
    const date = new Date(local);
    return Number.isNaN(date.getTime())
      ? local
      : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  private resetDraft(): void {
    this.stops.set(initialStops());
    this.timing.set('today');
    this.scheduledAt.set('');
    this.step.set(0);
    this.reached.set(0);
    this.tried.set(false);
    this.cargoForm.reset({ cargoDescription: '', cargoWeightKg: '', requiredVehicleType: 'Fiorino', driverNote: '' });
    this.clearPhoto();
  }

  private async loadAddresses(): Promise<void> {
    const list = await this.addressesRequest.run(() => firstValueFrom(this.addressesApi.list()));
    if (list) {
      this.addresses.set(list);
    }
  }
}
