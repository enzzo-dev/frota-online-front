import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonIcon, IonInput, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverService } from '../../../core/api/driver.service';
import { VEHICLE_TYPES, Vehicle, VehicleType } from '../../../core/models';
import { VEHICLE_TYPE_LABEL } from '../../../core/ui/labels';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { createRequestState } from '../../../core/ui/request-state';
import { ToastService } from '../../../core/ui/toast.service';
import { parseDecimal, normalizePlate } from '../../../core/util/normalizers';
import { ProblemAlertComponent } from '../../../shared/components/problem-alert.component';
import { greaterThan, notBlank, plate } from '../../../shared/forms/validators';

/** Step 3: the driver's vehicles. At least one active vehicle is needed to submit the profile. */
@Component({
  selector: 'app-vehicles-section',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    IonInput,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    ProblemAlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @for (vehicle of vehicles(); track vehicle.id) {
        <div class="card row">
          <div class="grow">
            <p class="strong">{{ typeLabel[vehicle.type] }} · <span class="mono">{{ vehicle.plate }}</span></p>
            <p class="muted small">
              {{ vehicle.model }} · {{ vehicle.year }} · {{ vehicle.capacityKg | number: '1.0-2' : 'pt-BR' }} kg
            </p>
          </div>
          <button
            class="icon-btn"
            type="button"
            [attr.aria-label]="'Remover ' + vehicle.plate"
            [disabled]="removing() === vehicle.id"
            (click)="confirmRemove(vehicle)"
          >
            <ion-icon name="trash-outline" />
          </button>
        </div>
      } @empty {
        <p class="muted small">Nenhum veículo ativo ainda.</p>
      }

      <app-problem-alert [error]="removeRequest.error()" />

      @if (adding()) {
        <form class="card stack" [formGroup]="form" (ngSubmit)="add()" novalidate>
          <ion-select
            formControlName="type"
            label="Tipo de veículo"
            labelPlacement="stacked"
            fill="outline"
            interface="action-sheet"
            cancelText="Cancelar"
          >
            @for (type of types; track type) {
              <ion-select-option [value]="type">{{ typeLabel[type] }}</ion-select-option>
            }
          </ion-select>
          <div class="form-grid form-grid--2">
            <ion-input
              formControlName="plate"
              label="Placa"
              labelPlacement="stacked"
              fill="outline"
              autocapitalize="characters"
              placeholder="ABC1D23"
              errorText="Use ABC1234 ou ABC1D23"
            />
            <ion-input
              formControlName="model"
              label="Modelo"
              labelPlacement="stacked"
              fill="outline"
              placeholder="Fiat Fiorino"
              errorText="Informe o modelo"
            />
            <ion-input
              formControlName="year"
              label="Ano"
              labelPlacement="stacked"
              fill="outline"
              inputmode="numeric"
              errorText="Informe um ano válido"
            />
            <ion-input
              formControlName="capacityKg"
              label="Capacidade (kg)"
              labelPlacement="stacked"
              fill="outline"
              inputmode="decimal"
              errorText="Informe a capacidade em kg"
            />
          </div>

          <app-problem-alert [error]="request.error()" />

          <div class="form-actions">
            <button class="btn" type="submit" [disabled]="request.loading()">
              @if (request.loading()) {
                <ion-spinner name="crescent" />
              }
              Cadastrar veículo
            </button>
            <button class="btn btn--ghost" type="button" (click)="adding.set(false)">Cancelar</button>
          </div>
        </form>
      } @else {
        <div class="form-actions">
          <button class="btn btn--ghost btn--sm" type="button" [disabled]="!enabled()" (click)="adding.set(true)">
            <ion-icon name="add-outline" aria-hidden="true" /> Adicionar veículo
          </button>
          @if (!enabled()) {
            <span class="field-hint">Salve seus dados (passo 2) antes de cadastrar veículos.</span>
          }
        </div>
      }
    </div>
  `,
})
export class VehiclesSectionComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly driver = inject(DriverService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly vehicles = input.required<readonly Vehicle[]>();
  /** False until the profile exists: the API refuses vehicles without one. */
  readonly enabled = input(true);
  readonly changed = output<void>();

  protected readonly types = VEHICLE_TYPES;
  protected readonly typeLabel = VEHICLE_TYPE_LABEL;
  protected readonly adding = signal(false);
  protected readonly removing = signal<string | null>(null);
  protected readonly request = createRequestState();
  protected readonly removeRequest = createRequestState();

  protected readonly form = this.fb.group({
    type: ['Fiorino' as VehicleType, [Validators.required]],
    plate: ['', [notBlank, plate]],
    model: ['', [notBlank, Validators.maxLength(80)]],
    year: [
      String(new Date().getFullYear()),
      [Validators.required, Validators.min(1970), Validators.max(new Date().getFullYear() + 1), Validators.pattern(/^\d{4}$/)],
    ],
    capacityKg: ['', [Validators.required, greaterThan(0)]],
  });

  protected async add(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const vehicle = await this.request.run(() =>
      firstValueFrom(
        this.driver.registerVehicle({
          type: value.type,
          plate: normalizePlate(value.plate),
          model: value.model.trim(),
          year: Number(value.year),
          capacityKg: parseDecimal(value.capacityKg) ?? 0,
        }),
      ),
    );
    if (vehicle) {
      this.form.reset({ type: value.type, plate: '', model: '', year: value.year, capacityKg: '' });
      this.adding.set(false);
      await this.toast.show('Veículo cadastrado.');
      this.changed.emit();
    }
  }

  protected async confirmRemove(vehicle: Vehicle): Promise<void> {
    const confirmed = await this.confirm.confirm({
      header: 'Remover veículo?',
      message: `${this.typeLabel[vehicle.type]} ${vehicle.plate} deixa de receber fretes.`,
      confirmText: 'Remover',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.removing.set(vehicle.id);
    const done = await this.removeRequest.run(async () => {
      await firstValueFrom(this.driver.deactivateVehicle(vehicle.id));
      return true;
    });
    this.removing.set(null);
    if (done) {
      this.changed.emit();
    }
  }
}
