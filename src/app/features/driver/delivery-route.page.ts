import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTextarea,
  ModalController,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { DriverService } from '../../core/api/driver.service';
import { SignatureService } from '../../core/api/signature.service';
import { ApiError } from '../../core/http/api-error';
import {
  DeliveryProgress,
  DeliveryRoute,
  DeliveryStatus,
  GeoPoint,
  PAYMENT_METHODS,
  PaymentMethod,
  RouteMap,
  RouteStop,
} from '../../core/models';
import { SessionService } from '../../core/auth/session.service';
import { DriverLocationReporter } from '../../core/location/driver-location-reporter';
import { ConfirmService } from '../../core/ui/confirm.service';
import { DELIVERY_STATUS_VIEW, PAYMENT_METHOD_LABEL } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { googleMapsNavUrl, wazeNavUrl } from '../../core/util/address-format';
import { StopView, fromRouteStops } from '../../core/util/stop-views';
import { DeliverySignatures, DeliverySignaturesSheetComponent } from './delivery-signatures-sheet.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { RouteMapCardComponent } from '../../shared/components/route-map-card.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { StopsRouteComponent } from '../../shared/components/stops-route.component';
import {
  ACCEPTED_DOCUMENT_TYPES,
  FileUploader,
  MAX_DOCUMENT_BYTES,
  formatBytes,
} from './profile/file-uploader';

/** Errors after which the screen shows what really happened instead of what the driver last saw. */
const RELOAD_ON: ReadonlySet<string> = new Set([
  'request.duplicate',
  'delivery.invalid_status',
  'delivery.stop_out_of_order',
]);

const RUNNING: readonly DeliveryStatus[] = ['ToPickup', 'PickedUp', 'InTransit'];
const CANCELLABLE: readonly DeliveryStatus[] = ['Scheduled', 'ToPickup', 'Incident'];

/**
 * The run itself: start it, complete the stops in order (with note, place and proof), report an incident,
 * cancel, and once delivered confirm that the money arrived. Every action locks the buttons while it runs.
 */
@Component({
  selector: 'app-delivery-route-page',
  imports: [
    DecimalPipe,
    RouterLink,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonTextarea,
    EmptyStateComponent,
    PageBarComponent,
    ProblemAlertComponent,
    RouteMapCardComponent,
    StatusChipComponent,
    StopsRouteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .detail {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 24px;
    }
    @media (min-width: 1000px) {
      .detail {
        grid-template-columns: minmax(0, 1fr) 420px;
        gap: 40px;
        align-items: start;
      }
    }
    .nav-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .nav-row .btn {
      flex: 1 1 140px;
    }
    .file-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .proof-tip {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
    }
    .proof-tip ion-icon {
      flex: none;
      font-size: 18px;
    }
  `,
  template: `
    <app-page-bar title="Corrida" backHref="/driver/deliveries" />

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide page--with-bar">
        <app-problem-alert [error]="load.error()" />

        @if (route(); as r) {
          <section class="dark-panel stack">
            <div class="row row--between row--wrap">
              <h2 class="grow break">{{ r.cargoDescription }}</h2>
              @if (status(); as s) {
                <app-status-chip [view]="statusView[s]" />
              }
            </div>
            <p class="muted small">{{ r.cargoWeightKg | number: '1.0-2' : 'pt-BR' }} kg</p>
            @if (reporter.denied()) {
              <p class="small" role="alert">
                Sem a permissão de localização o cliente não vê onde você está. Libere nas configurações do aparelho.
              </p>
            }
            <div class="progress-track">
              <div class="progress" role="progressbar" [attr.aria-valuenow]="completed()" aria-valuemin="0" [attr.aria-valuemax]="r.totalStops">
                <span [style.width.%]="percent()"></span>
              </div>
              <ion-icon class="progress-track__vehicle" src="icons/bus.svg" aria-hidden="true" [style.left.%]="percent()" />
            </div>
            <p class="small">{{ completed() }} de {{ r.totalStops }} paradas concluídas</p>
          </section>

          <div class="detail">
            <div class="stack stack--lg">
              <section class="stack">
                <h2>Trajeto</h2>
                <app-route-map-card [route]="map()" [loading]="mapLoading()" [error]="mapError()" />
              </section>

              <section class="stack">
                <h2>Paradas</h2>
                @if (stops().length > 0) {
                  <app-stops-route [stops]="stops()" />
                } @else {
                  <app-empty-state title="Sem paradas" description="Não há paradas nesta corrida." />
                }
              </section>
            </div>

            <div class="stack stack--lg">
              <app-problem-alert [error]="action.error()" />

              @switch (status()) {
                @case ('Scheduled') {
                  <section class="card card--accent stack">
                    <h3>Pronto para sair?</h3>
                    <p class="small">Ao iniciar, você segue para a primeira coleta. As paradas são feitas na ordem da rota.</p>
                    <button class="btn btn--block" type="button" [disabled]="busy()" (click)="start()">
                      @if (busy()) {
                        <ion-spinner name="crescent" />
                      } @else {
                        <ion-icon name="navigate-outline" aria-hidden="true" />
                      }
                      Iniciar corrida
                    </button>
                  </section>
                }

                @case ('Delivered') {
                  <section class="card card--accent stack">
                    <h3>Entrega concluída</h3>
                    <p class="small">
                      A taxa da plataforma já foi lançada no seu extrato.
                      <a class="link-btn" routerLink="/driver/fees">Ver extrato de taxas</a>
                    </p>
                  </section>

                  <section class="card stack" aria-labelledby="pay-title">
                    <h3 id="pay-title">Pagamento</h3>
                    @if (paymentDone()) {
                      <p class="notice"><ion-icon name="checkmark-circle-outline" aria-hidden="true" /> Você confirmou o recebimento deste frete.</p>
                    } @else if (paidInApp()) {
                      <p class="notice"><ion-icon name="checkmark-circle-outline" aria-hidden="true" /> Pagamento confirmado. Você não precisa fazer nada.</p>
                    } @else {
                      <p class="small">
                        O cliente paga direto a você, fora do app. A plataforma não toca no dinheiro: confirme aqui só depois de receber.
                      </p>
                      <div class="choice-grid" role="radiogroup" aria-label="Forma de pagamento">
                        @for (method of paymentMethods; track method) {
                          <button
                            class="choice"
                            type="button"
                            role="radio"
                            [attr.aria-checked]="paymentMethod() === method"
                            [class.is-selected]="paymentMethod() === method"
                            (click)="paymentMethod.set(method)"
                          >
                            {{ methodLabel[method] }}
                          </button>
                        }
                      </div>
                      <ion-textarea
                        label="Referência (opcional)"
                        labelPlacement="stacked"
                        fill="outline"
                        placeholder="Ex.: código do Pix"
                        [counter]="true"
                        maxlength="120"
                        [value]="paymentReference()"
                        (ionInput)="paymentReference.set(textOf($event))"
                      />
                      <button class="btn btn--block" type="button" [disabled]="busy()" (click)="confirmPayment()">
                        @if (busy()) {
                          <ion-spinner name="crescent" />
                        }
                        Confirmar que recebi
                      </button>
                    }
                  </section>
                }

                @case ('Cancelled') {
                  <p class="notice">Esta corrida foi cancelada.</p>
                }

                @case ('Incident') {
                  <p class="notice notice--error">
                    Há uma ocorrência registrada. Depois dela só é possível cancelar a corrida.
                  </p>
                }
              }

              @if (isRunning() && nextStop(); as next) {
                <section class="card card--accent stack" aria-labelledby="next-title">
                  <h3 id="next-title">Próxima parada: {{ next.type === 'Pickup' ? 'coleta' : 'entrega' }}</h3>
                  <app-stops-route [stops]="nextView()" />

                  <div class="nav-row" role="group" aria-label="Abrir navegação até a {{ next.type === 'Pickup' ? 'coleta' : 'entrega' }}">
                    <a class="btn btn--sm" [href]="wazeUrl(next)" target="_blank" rel="noopener">
                      <ion-icon name="navigate-outline" aria-hidden="true" /> Abrir no Waze
                    </a>
                    <a class="btn btn--ghost btn--sm" [href]="googleUrl(next)" target="_blank" rel="noopener">
                      <ion-icon name="map-outline" aria-hidden="true" /> Abrir no Maps
                    </a>
                  </div>

                  <ion-textarea
                    label="Observação (opcional)"
                    labelPlacement="stacked"
                    fill="outline"
                    placeholder="Ex.: recebido pelo porteiro"
                    [counter]="true"
                    maxlength="300"
                    [value]="note()"
                    (ionInput)="note.set(textOf($event))"
                  />

                  <div class="file-row">
                    <button class="btn btn--ghost btn--sm" type="button" [disabled]="locating() || busy()" (click)="useLocation()">
                      @if (locating()) {
                        <ion-spinner name="crescent" />
                      } @else {
                        <ion-icon name="location-outline" aria-hidden="true" />
                      }
                      {{ place() ? 'Local registrado' : 'Registrar meu local' }}
                    </button>
                    @if (place()) {
                      <button class="link-btn" type="button" (click)="place.set(null)">Remover</button>
                    }
                  </div>
                  @if (placeProblem(); as problem) {
                    <p class="field-hint">{{ problem }}</p>
                  }

                  <div class="stack">
                    <span class="strong">Comprovante (opcional)</span>
                    <p class="notice small proof-tip" role="note">
                      <ion-icon name="camera-outline" aria-hidden="true" />
                      Recomendamos tirar uma foto da {{ next.type === 'Pickup' ? 'coleta' : 'entrega' }} como comprovante.
                    </p>
                    <div class="file-row">
                      <button class="btn btn--ghost btn--sm" type="button" [disabled]="busy()" (click)="camera.click()">
                        <ion-icon name="camera-outline" aria-hidden="true" />
                        Tirar foto
                      </button>
                      <button class="btn btn--ghost btn--sm" type="button" [disabled]="busy()" (click)="picker.click()">
                        <ion-icon name="attach-outline" aria-hidden="true" />
                        Escolher arquivo
                      </button>
                      <input
                        #camera
                        class="sr-only"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        tabindex="-1"
                        aria-label="Tirar foto do comprovante"
                        (click)="clearPicked($event)"
                        (change)="onProof($event)"
                      />
                      <input
                        #picker
                        class="sr-only"
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        tabindex="-1"
                        aria-label="Escolher arquivo do comprovante"
                        (click)="clearPicked($event)"
                        (change)="onProof($event)"
                      />
                    </div>
                    @if (proof(); as file) {
                      <p class="small muted break">{{ file.name }} · {{ sizeText(file.size) }}</p>
                    }
                    @if (proofProblem(); as problem) {
                      <p class="field-hint">{{ problem }}</p>
                    }
                    @if (!uploader.storesFiles()) {
                      <p class="field-hint">
                        Este ambiente não tem armazenamento de arquivos ligado: só os dados do comprovante são
                        registrados na API.
                      </p>
                    }
                  </div>

                  <button class="btn btn--block" type="button" [disabled]="busy()" (click)="completeNext(next)">
                    @if (busy()) {
                      <ion-spinner name="crescent" />
                    } @else {
                      <ion-icon name="checkmark-outline" aria-hidden="true" />
                    }
                    Concluir {{ next.type === 'Pickup' ? 'coleta' : 'entrega' }}
                  </button>
                </section>
              }

              @if (isRunning()) {
                <button class="btn btn--ghost btn--block" type="button" [disabled]="busy()" (click)="reportIncident()">
                  <ion-icon name="alert-circle-outline" aria-hidden="true" /> Registrar ocorrência
                </button>
              }

              @if (cancellable()) {
                <button class="btn btn--danger-outline btn--block" type="button" [disabled]="busy()" (click)="cancel()">
                  Cancelar corrida
                </button>
              }
            </div>
          </div>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class DeliveryRoutePage {
  private readonly marketplace = inject(DriverMarketplaceService);
  private readonly driver = inject(DriverService);
  private readonly session = inject(SessionService);
  private readonly confirm = inject(ConfirmService);
  private readonly signatureApi = inject(SignatureService);
  private readonly modals = inject(ModalController);
  private readonly toast = inject(ToastService);
  protected readonly reporter = inject(DriverLocationReporter);
  protected readonly uploader = inject(FileUploader);
  private readonly deliveryId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly statusView = DELIVERY_STATUS_VIEW;
  protected readonly methodLabel = PAYMENT_METHOD_LABEL;
  protected readonly paymentMethods = PAYMENT_METHODS;

  protected readonly load = createRequestState();
  protected readonly action = createRequestState();

  protected readonly route = signal<DeliveryRoute | null>(null);
  protected readonly status = signal<DeliveryStatus | null>(null);
  protected readonly map = signal<RouteMap | null>(null);
  protected readonly mapLoading = signal(false);
  protected readonly mapError = signal<ApiError | null>(null);
  protected readonly busy = signal(false);

  // Inputs of the stop being completed.
  protected readonly note = signal('');
  protected readonly place = signal<GeoPoint | null>(null);
  protected readonly locating = signal(false);
  protected readonly placeProblem = signal<string | null>(null);
  protected readonly proof = signal<File | null>(null);
  protected readonly proofProblem = signal<string | null>(null);
  private readonly driverSigned = signal(false);
  private readonly customerSigned = signal(false);

  // Payment, after delivery.
  protected readonly paymentMethod = signal<PaymentMethod>('Pix');
  protected readonly paymentReference = signal('');
  protected readonly paymentDone = signal(false);
  /** The API already has this freight's payment as paid (paid in the app, or confirmed earlier). */
  protected readonly paidInApp = signal(false);

  private readonly progress = signal<DeliveryProgress | null>(null);

  protected readonly orderedStops = computed<RouteStop[]>(() =>
    [...(this.route()?.stops ?? [])].sort((a, b) => a.sequence - b.sequence),
  );
  protected readonly stops = computed<StopView[]>(() => fromRouteStops(this.orderedStops()));
  protected readonly completed = computed(
    () => this.progress()?.completedStops ?? this.orderedStops().filter((s) => s.completedAt !== null).length,
  );
  protected readonly percent = computed(() => {
    const total = this.route()?.totalStops ?? 0;
    return total === 0 ? 0 : Math.round((this.completed() / total) * 100);
  });

  /** The stop to do now. The API says which one (`nextStopId`); without an answer yet it is the first not done. */
  protected wazeUrl(stop: RouteStop): string {
    return wazeNavUrl(stop.address);
  }

  protected googleUrl(stop: RouteStop): string {
    return googleMapsNavUrl(stop.address);
  }

  protected readonly nextStop = computed<RouteStop | null>(() => {
    const stops = this.orderedStops();
    const id = this.progress()?.nextStopId;
    return (id ? stops.find((s) => s.stopId === id) : undefined) ?? stops.find((s) => s.completedAt === null) ?? null;
  });
  protected readonly nextView = computed<StopView[]>(() => {
    const next = this.nextStop();
    return next ? fromRouteStops([next]) : [];
  });
  protected readonly isRunning = computed(() => {
    const status = this.status();
    return status !== null && RUNNING.includes(status);
  });
  protected readonly cancellable = computed(() => {
    const status = this.status();
    return status !== null && CANCELLABLE.includes(status);
  });

  ionViewWillEnter(): void {
    void this.load.run(() => this.reload());
  }

  ionViewWillLeave(): void {
    void this.reporter.stop();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.load.run(() => this.reload());
    completeRefresh(event);
  }

  protected textOf(event: Event): string {
    const value = (event as CustomEvent<{ value?: string | null }>).detail?.value;
    return value ?? '';
  }

  protected sizeText(bytes: number): string {
    return formatBytes(bytes);
  }

  protected async start(): Promise<void> {
    const progress = await this.act(() => firstValueFrom(this.marketplace.start(this.deliveryId)));
    if (progress) {
      await this.afterProgress(progress, 'Corrida iniciada. Boa viagem!');
    }
  }

  private async askSignatures(): Promise<DeliverySignatures | null> {
    const sheet = await this.modals.create({
      component: DeliverySignaturesSheetComponent,
      componentProps: { needDriver: !this.driverSigned(), needCustomer: !this.customerSigned() },
      backdropDismiss: false,
      cssClass: 'sheet',
    });
    await sheet.present();
    const { data, role } = await sheet.onDidDismiss<DeliverySignatures>();
    return role === 'confirm' && data ? data : null;
  }

  protected async completeNext(stop: RouteStop): Promise<void> {
    const last = this.completed() + 1 >= (this.route()?.totalStops ?? 0);
    let signatures: DeliverySignatures | null = null;
    if (last && (!this.driverSigned() || !this.customerSigned())) {
      signatures = await this.askSignatures();
      if (!signatures) {
        return;
      }
    }
    const progress = await this.act(async () => {
      if (signatures) {
        const freightId = this.route()?.freightRequestId ?? '';
        if (signatures.driver) {
          await this.signatureApi.submit('Driver', freightId, signatures.driver);
          this.driverSigned.set(true);
        }
        if (signatures.customer) {
          await this.signatureApi.submit('Customer', freightId, signatures.customer);
          this.customerSigned.set(true);
        }
      }
      const point = this.place();
      const proofId = await this.registerProof();
      return firstValueFrom(
        this.marketplace.completeStop(this.deliveryId, stop.stopId, {
          note: this.note().trim() || null,
          // Both or neither: the API rejects a lone coordinate.
          latitude: point?.latitude ?? null,
          longitude: point?.longitude ?? null,
          proofMediaFileId: proofId,
        }),
      );
    });
    if (progress) {
      this.note.set('');
      this.place.set(null);
      this.proof.set(null);
      await this.afterProgress(progress, last ? 'Entrega concluída.' : 'Parada concluída.');
    }
  }

  protected async reportIncident(): Promise<void> {
    const note = await this.confirm.promptText({
      header: 'Registrar ocorrência',
      message: 'Depois da ocorrência só é possível cancelar a corrida.',
      label: 'O que aconteceu?',
      placeholder: 'Ex.: veículo quebrou, carga avariada',
      confirmText: 'Registrar',
      destructive: true,
    });
    if (note === null) {
      return;
    }
    const progress = await this.act(() => firstValueFrom(this.marketplace.reportIncident(this.deliveryId, note)));
    if (progress) {
      await this.afterProgress(progress, 'Ocorrência registrada.');
    }
  }

  protected async cancel(): Promise<void> {
    const reason = await this.confirm.promptText({
      header: 'Cancelar corrida?',
      message: 'O cliente será avisado.',
      label: 'Motivo do cancelamento',
      placeholder: 'Ex.: não consigo mais fazer o frete',
      confirmText: 'Cancelar corrida',
      cancelText: 'Manter',
      destructive: true,
    });
    if (reason === null) {
      return;
    }
    const progress = await this.act(() => firstValueFrom(this.marketplace.cancel(this.deliveryId, { reason })));
    if (progress) {
      await this.afterProgress(progress, 'Corrida cancelada.');
    }
  }

  protected async confirmPayment(): Promise<void> {
    const payment = await this.act(() =>
      firstValueFrom(
        this.marketplace.confirmPayment(this.deliveryId, {
          method: this.paymentMethod(),
          reference: this.paymentReference().trim() || null,
        }),
      ),
    );
    if (payment) {
      this.paymentDone.set(true);
      await this.toast.show('Pagamento confirmado.');
    } else if (this.action.error()?.code === 'payment.already_confirmed') {
      // Someone (or an earlier tap) already confirmed it: that is the state the driver wanted.
      this.paymentDone.set(true);
      this.action.clearError();
    }
  }

  protected async useLocation(): Promise<void> {
    this.placeProblem.set(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.placeProblem.set('Este aparelho não informa a localização. Você pode concluir sem ela.');
      return;
    }
    this.locating.set(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10_000 }),
      );
      this.place.set({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      this.placeProblem.set('Não conseguimos pegar sua localização. Libere o acesso ou conclua sem ela.');
    } finally {
      this.locating.set(false);
    }
  }

  protected clearPicked(event: Event): void {
    (event.target as HTMLInputElement).value = '';
  }

  protected onProof(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.proofProblem.set(null);
    if (!file) {
      this.proof.set(null);
      return;
    }
    if (!(ACCEPTED_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
      this.proof.set(null);
      this.proofProblem.set('Envie um arquivo JPEG, PNG ou PDF.');
      input.value = '';
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      this.proof.set(null);
      this.proofProblem.set('O arquivo passa de 10 MB.');
      input.value = '';
      return;
    }
    this.proof.set(file);
  }

  /** Stores and registers the picked proof, resolving to its media id, or null when there is none. */
  private async registerProof(): Promise<string | null> {
    const file = this.proof();
    if (!file) {
      return null;
    }
    const userId = this.session.user()?.id ?? '';
    const storageKey = await this.uploader.upload(file, 'DeliveryProof', userId);
    const media = await firstValueFrom(
      this.driver.registerDocument({
        kind: 'DeliveryProof',
        storageKey,
        contentType: file.type,
        sizeBytes: file.size,
      }),
    );
    return media.id;
  }

  /** Runs one action with the buttons locked, and reloads the screen when the state turned out different. */
  private async act<T>(work: () => Promise<T>): Promise<T | undefined> {
    if (this.busy()) {
      return undefined;
    }
    this.busy.set(true);
    try {
      const result = await this.action.run(work);
      const code = this.action.error()?.code;
      if (code && RELOAD_ON.has(code)) {
        this.progress.set(null);
        await this.load.run(() => this.reload());
      }
      return result;
    } finally {
      this.busy.set(false);
    }
  }

  private async afterProgress(progress: DeliveryProgress, message: string): Promise<void> {
    this.progress.set(progress);
    this.status.set(progress.status);
    this.syncLocation();
    await this.toast.show(message);
    await this.load.run(() => this.reload());
  }

  private async reload(): Promise<void> {
    const [route, summary] = await Promise.all([
      firstValueFrom(this.marketplace.route(this.deliveryId, 'Full')),
      firstValueFrom(this.marketplace.delivery(this.deliveryId)),
    ]);
    this.route.set(route);
    this.status.set(summary.status);
    this.syncLocation();
    this.paidInApp.set(summary.payment === 'Paid');
    this.driverSigned.set(summary.driverSigned === true);
    this.customerSigned.set(summary.customerSigned === true);
    this.progress.set(null);
    void this.loadMap();
  }

  private syncLocation(): void {
    if (this.isRunning()) {
      void this.reporter.start(this.deliveryId);
    } else {
      void this.reporter.stop();
    }
  }

  private async loadMap(): Promise<void> {
    this.mapLoading.set(true);
    this.mapError.set(null);
    try {
      this.map.set(await firstValueFrom(this.marketplace.routeMap(this.deliveryId)));
    } catch (caught) {
      this.mapError.set(ApiError.from(caught));
    } finally {
      this.mapLoading.set(false);
    }
  }
}
