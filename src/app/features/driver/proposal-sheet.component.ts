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
import { Router } from '@angular/router';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { FreeFreightService } from '../../core/api/free-freight.service';
import { IonIcon } from '@ionic/angular';
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
    IonIcon,
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

        @switch (freeState()) {
          @case ('available') {
            <div class="warn warn--info" role="note">
              <ion-icon name="gift-outline" aria-hidden="true" />
              <div>
                <p class="strong">Este pode ser o seu frete grátis</p>
                <p class="small">
                  Se o cliente aprovar, este será o seu único frete sem assinatura: para propor de novo, você precisará de um
                  plano. Se tiver outras propostas abertas, só a primeira aprovada leva o frete grátis.
                </p>
              </div>
            </div>
          }
          @case ('used') {
            <div class="warn warn--stop" role="alert">
              <ion-icon name="warning-outline" aria-hidden="true" />
              <div>
                <p class="strong">Seu frete grátis já foi usado</p>
                <p class="small">Sem assinatura, esta proposta será recusada. Assine um plano para continuar propondo.</p>
                <button class="link-btn" type="button" (click)="goToPlans()">Ver planos</button>
              </div>
            </div>
          }
        }

        <app-problem-alert [error]="request.error()">
          @if (request.error()?.code === 'subscription.required') {
            <button class="link-btn" type="button" (click)="goToPlans()">Ver planos e assinar</button>
          }
        </app-problem-alert>

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
    .warn {
      display: flex;
      gap: 12px;
      padding: 14px;
      border-radius: var(--r-md);
      font-size: 14px;
    }
    .warn ion-icon {
      flex: none;
      font-size: 22px;
      margin-top: 2px;
    }
    .warn p {
      margin: 0 0 4px;
    }
    .warn--info {
      background: #fff7f7;
      border: 1.5px solid #f1c5c7;
    }
    .warn--info ion-icon {
      color: var(--red);
    }
    .warn--stop {
      background: #fff3f3;
      border: 1.5px solid var(--red);
      color: var(--red-deep);
    }
  `,
})
export class ProposalSheetComponent implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly marketplace = inject(DriverMarketplaceService);
  private readonly modals = inject(ModalController);
  private readonly router = inject(Router);
  private readonly freeFreight = inject(FreeFreightService);
  protected readonly freeState = this.freeFreight.state;

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
