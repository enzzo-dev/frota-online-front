import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { OpenFreight, Vehicle } from '../../core/models';
import { VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { createRequestState } from '../../core/ui/request-state';
import { parseDecimal } from '../../core/util/normalizers';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { greaterThan } from '../../shared/forms/validators';

/** Bottom sheet where an approved driver sets the price and sends a proposal for a freight. */
@Component({
  selector: 'app-proposal-sheet',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
    CountdownComponent,
    ProblemAlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="plain-header">
      <ion-toolbar class="plain">
        <ion-title>Enviar proposta</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()">Fechar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <form class="stack sheet-body" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="dark-panel stack">
          <p class="strong">{{ freight().cargoDescription }}</p>
          <p class="small muted">
            {{ freight().cargoWeightKg | number: '1.0-2' : 'pt-BR' }} kg · {{ typeLabel[freight().requiredVehicleType] }}
          </p>
          <p class="small">
            Propostas por <app-countdown [until]="freight().proposalDeadline" />
          </p>
        </div>

        <ion-select
          formControlName="vehicleId"
          label="Veículo"
          labelPlacement="stacked"
          fill="outline"
          interface="action-sheet"
          cancelText="Cancelar"
          placeholder="Escolha o veículo"
          errorText="Escolha um veículo"
        >
          @for (vehicle of vehicles(); track vehicle.id) {
            <ion-select-option [value]="vehicle.id">
              {{ typeLabel[vehicle.type] }} · {{ vehicle.plate }} · {{ vehicle.model }}
            </ion-select-option>
          }
        </ion-select>

        <ion-input
          formControlName="price"
          label="Seu preço (R$)"
          labelPlacement="stacked"
          fill="outline"
          inputmode="decimal"
          placeholder="150,00"
          helperText="O cliente vê as propostas da mais barata para a mais cara."
          errorText="Informe um valor maior que zero"
        />

        <ion-textarea
          formControlName="message"
          label="Recado para o cliente (opcional)"
          labelPlacement="stacked"
          fill="outline"
          [autoGrow]="true"
          [counter]="true"
          maxlength="300"
          rows="2"
        />

        <app-problem-alert [error]="request.error()" />

        <button class="btn btn--block" type="submit" [disabled]="request.loading()">
          @if (request.loading()) {
            <ion-spinner name="crescent" />
          }
          Enviar proposta
        </button>
      </form>
    </ion-content>
  `,
  styles: `
    .sheet-body {
      padding: 16px 16px calc(32px + var(--ion-safe-area-bottom, 0px));
    }
  `,
})
export class ProposalSheetComponent implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly marketplace = inject(DriverMarketplaceService);
  private readonly modals = inject(ModalController);

  readonly freight = input.required<OpenFreight>();
  /** Vehicles that already fit the freight (type and weight). */
  readonly vehicles = input.required<readonly Vehicle[]>();

  protected readonly typeLabel = VEHICLE_TYPE_LABEL;
  protected readonly request = createRequestState();

  protected readonly form = this.fb.group({
    vehicleId: ['', [Validators.required]],
    price: ['', [Validators.required, greaterThan(0)]],
    message: ['', [Validators.maxLength(300)]],
  });

  ngOnInit(): void {
    // With a single eligible vehicle there is nothing to choose.
    const [only] = this.vehicles();
    if (only && this.vehicles().length === 1) {
      this.form.controls.vehicleId.setValue(only.id);
    }
  }

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
