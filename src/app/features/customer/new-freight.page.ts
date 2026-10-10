import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonInput,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  ModalController,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AddressesService } from '../../core/api/addresses.service';
import { FreightsService } from '../../core/api/freights.service';
import { Address, VEHICLE_TYPES, VehicleType } from '../../core/models';
import { VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { localInputToUtcIso } from '../../core/util/dates';
import { parseDecimal } from '../../core/util/normalizers';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { greaterThan, notBlank } from '../../shared/forms/validators';
import { AddressSheetComponent } from './address-sheet.component';
import { DraftStop, toRequestStops, validateStops } from './freight-draft';
import { StopBuilderComponent } from './stop-builder.component';

type Timing = 'today' | 'scheduled';

/** `YYYY-MM-DDTHH:mm` in local time, the format `datetime-local` inputs use. */
function localInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Posts a freight in four steps: addresses, stops in order, cargo, publish.
 * Without a date the freight is for today and takes proposals for 5 minutes; a scheduled one for up to 24 hours.
 */
@Component({
  selector: 'app-new-freight-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonIcon,
    IonInput,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    PageBarComponent,
    ProblemAlertComponent,
    StopBuilderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './new-freight.page.scss',
  template: `
    <app-page-bar title="Novo frete" backHref="/customer/freights" />

    <ion-content>
      <div class="page page--with-bar">
        <p class="lede">
          Monte a rota na ordem em que o motorista vai seguir. Os motoristas aprovados enviam o preço deles
          e você escolhe.
        </p>

        <app-problem-alert [error]="addressesRequest.error()" />

        <ol class="route">
          <li class="stop" [class.stop--done]="addresses().length >= 2">
            <span class="stop-pin" aria-hidden="true">1</span>
            <div class="stop-body stack">
              <h3>Endereços</h3>
              <p class="small">
                {{ addresses().length === 0 ? 'Nenhum endereço salvo ainda.' : addresses().length + ' salvo(s).' }}
                Você precisa de uma coleta e uma entrega.
              </p>
              <div class="form-actions">
                <button class="btn btn--ghost btn--sm" type="button" (click)="openAddressSheet()">
                  <ion-icon name="add-outline" aria-hidden="true" /> Novo endereço
                </button>
              </div>
            </div>
          </li>

          <li class="stop" [class.stop--done]="stopsValid()">
            <span class="stop-pin" aria-hidden="true">2</span>
            <div class="stop-body stack">
              <h3>Paradas</h3>
              <p class="small">A primeira é uma coleta e a última, uma entrega: o endereço final. Use as setas para reordenar.</p>
              <app-stop-builder [addresses]="addresses()" [(stops)]="stops" (addAddress)="openAddressSheet()" />
              @if (stops().length > 0 && stopProblems().length > 0) {
                <div class="notice notice--error" role="status">
                  <ul>
                    @for (problem of stopProblems(); track problem) {
                      <li>{{ problem }}</li>
                    }
                  </ul>
                </div>
              }
            </div>
          </li>

          <li class="stop" [class.stop--done]="cargoForm.valid">
            <span class="stop-pin" aria-hidden="true">3</span>
            <div class="stop-body stack">
              <h3>Carga</h3>
              <form class="stack" [formGroup]="cargoForm" novalidate>
                <ion-input
                  formControlName="cargoDescription"
                  label="O que será transportado"
                  labelPlacement="stacked"
                  fill="outline"
                  placeholder="Autopeças, móveis, caixas..."
                  errorText="Descreva a carga"
                />
                <div class="form-grid form-grid--2">
                  <ion-input
                    formControlName="cargoWeightKg"
                    label="Peso total (kg)"
                    labelPlacement="stacked"
                    fill="outline"
                    inputmode="decimal"
                    errorText="Informe o peso em kg"
                  />
                  <ion-select
                    formControlName="requiredVehicleType"
                    label="Veículo necessário"
                    labelPlacement="stacked"
                    fill="outline"
                    interface="action-sheet"
                    cancelText="Cancelar"
                  >
                    @for (type of vehicleTypes; track type) {
                      <ion-select-option [value]="type">{{ vehicleLabel[type] }}</ion-select-option>
                    }
                  </ion-select>
                </div>
              </form>

              <div class="stack">
                <strong class="small">Quando coletar</strong>
                <ion-segment [value]="timing()" (ionChange)="onTiming($event.detail.value)">
                  <ion-segment-button value="today">Hoje</ion-segment-button>
                  <ion-segment-button value="scheduled">Agendar</ion-segment-button>
                </ion-segment>
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
                  @if (scheduleProblem(); as problem) {
                    <p class="field-hint" role="status">{{ problem }}</p>
                  }
                }
              </div>
            </div>
          </li>

          <li class="stop">
            <span class="stop-pin" aria-hidden="true">4</span>
            <div class="stop-body stack">
              <h3>Publicar</h3>
              <p class="small">{{ windowText() }}</p>

              <app-problem-alert [error]="publishRequest.error()">
                @if (publishRequest.error()?.code === 'freight.terms_not_accepted') {
                  <p><a class="link-btn" routerLink="/terms">Ler e aceitar os termos</a></p>
                }
              </app-problem-alert>

              <div class="form-actions">
                <button class="btn" type="button" [disabled]="publishRequest.loading()" (click)="publish()">
                  @if (publishRequest.loading()) {
                    <ion-spinner name="crescent" />
                  }
                  Publicar frete
                </button>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </ion-content>
  `,
})
export class NewFreightPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly addressesApi = inject(AddressesService);
  private readonly freights = inject(FreightsService);
  private readonly modals = inject(ModalController);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly vehicleTypes = VEHICLE_TYPES;
  protected readonly vehicleLabel = VEHICLE_TYPE_LABEL;
  protected readonly addressesRequest = createRequestState();
  protected readonly publishRequest = createRequestState();

  protected readonly addresses = signal<readonly Address[]>([]);
  protected readonly stops = signal<readonly DraftStop[]>([]);
  protected readonly timing = signal<Timing>('today');
  protected readonly scheduledAt = signal('');
  protected readonly minScheduled = localInputValue(new Date());

  protected readonly cargoForm = this.fb.group({
    cargoDescription: ['', [notBlank, Validators.maxLength(200)]],
    cargoWeightKg: ['', [Validators.required, greaterThan(0)]],
    requiredVehicleType: ['Fiorino' as VehicleType, [Validators.required]],
  });

  protected readonly stopProblems = computed(() => validateStops(this.stops()));
  protected readonly stopsValid = computed(() => this.stops().length > 0 && this.stopProblems().length === 0);

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

  protected readonly windowText = computed(() =>
    this.timing() === 'today'
      ? 'Frete para hoje: os motoristas têm 5 minutos para enviar propostas depois que você publicar.'
      : 'Frete agendado: os motoristas têm até 24 horas para enviar propostas.',
  );

  ionViewWillEnter(): void {
    void this.loadAddresses();
  }

  protected onTiming(value: string | number | null | undefined): void {
    if (value === 'today' || value === 'scheduled') {
      this.timing.set(value);
    }
  }

  protected onScheduled(value: string | number | null | undefined): void {
    this.scheduledAt.set(typeof value === 'string' ? value : '');
  }

  protected async openAddressSheet(): Promise<void> {
    const sheet = await this.modals.create({
      component: AddressSheetComponent,
      breakpoints: [0, 0.95],
      initialBreakpoint: 0.95,
      cssClass: 'sheet',
    });
    await sheet.present();
    const { role } = await sheet.onDidDismiss();
    if (role === 'created') {
      await this.toast.show('Endereço salvo.');
      await this.loadAddresses();
    }
  }

  protected async publish(): Promise<void> {
    this.cargoForm.markAllAsTouched();
    if (this.cargoForm.invalid || !this.stopsValid() || this.scheduleProblem()) {
      await this.toast.show('Revise os passos marcados antes de publicar.');
      return;
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
        }),
      ),
    );
    if (freight) {
      this.resetDraft();
      await this.toast.show('Frete publicado. Agora é só esperar as propostas.');
      await this.router.navigate(['/customer/freights', freight.id], { replaceUrl: true });
    }
  }

  private resetDraft(): void {
    this.stops.set([]);
    this.timing.set('today');
    this.scheduledAt.set('');
    this.cargoForm.reset({ cargoDescription: '', cargoWeightKg: '', requiredVehicleType: 'Fiorino' });
  }

  private async loadAddresses(): Promise<void> {
    const list = await this.addressesRequest.run(() => firstValueFrom(this.addressesApi.list()));
    if (list) {
      this.addresses.set(list);
    }
  }
}
