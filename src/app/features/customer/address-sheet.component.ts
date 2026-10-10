import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AddressesService } from '../../core/api/addresses.service';
import { BRAZILIAN_STATES } from '../../core/ui/labels';
import { createRequestState } from '../../core/ui/request-state';
import { normalizeZip } from '../../core/util/normalizers';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { notBlank, zipCode } from '../../shared/forms/validators';

/** Bottom sheet that saves a pickup or delivery address. Dismisses with the saved address on role `created`. */
@Component({
  selector: 'app-address-sheet',
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
    ProblemAlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="plain-header">
      <ion-toolbar class="plain">
        <ion-title>Novo endereço</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()">Fechar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <form class="stack stack--lg sheet-body" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <ion-input
          formControlName="label"
          label="Apelido"
          labelPlacement="stacked"
          fill="outline"
          placeholder="Galpão, Loja centro..."
          helperText="Como você reconhece este endereço."
          errorText="Dê um apelido ao endereço"
        />
        <div class="form-grid form-grid--2">
          <ion-input
            formControlName="zipCode"
            label="CEP"
            labelPlacement="stacked"
            fill="outline"
            inputmode="numeric"
            autocomplete="postal-code"
            placeholder="01001-000"
            errorText="O CEP tem 8 dígitos"
          />
          <ion-select
            formControlName="state"
            label="Estado"
            labelPlacement="stacked"
            fill="outline"
            interface="action-sheet"
            cancelText="Cancelar"
            placeholder="UF"
            errorText="Escolha o estado"
          >
            @for (uf of states; track uf) {
              <ion-select-option [value]="uf">{{ uf }}</ion-select-option>
            }
          </ion-select>
        </div>
        <ion-input
          formControlName="street"
          label="Rua"
          labelPlacement="stacked"
          fill="outline"
          autocomplete="address-line1"
          errorText="Informe a rua"
        />
        <div class="form-grid form-grid--2">
          <ion-input
            formControlName="number"
            label="Número"
            labelPlacement="stacked"
            fill="outline"
            errorText="Informe o número"
          />
          <ion-input formControlName="complement" label="Complemento (opcional)" labelPlacement="stacked" fill="outline" />
        </div>
        <div class="form-grid form-grid--2">
          <ion-input
            formControlName="district"
            label="Bairro"
            labelPlacement="stacked"
            fill="outline"
            errorText="Informe o bairro"
          />
          <ion-input
            formControlName="city"
            label="Cidade"
            labelPlacement="stacked"
            fill="outline"
            autocomplete="address-level2"
            errorText="Informe a cidade"
          />
        </div>

        <app-problem-alert [error]="request.error()" />

        <button class="btn btn--block" type="submit" [disabled]="request.loading()">
          @if (request.loading()) {
            <ion-spinner name="crescent" />
          }
          Salvar endereço
        </button>
      </form>
    </ion-content>
  `,
  styles: `
    .sheet-body {
      padding: 4px 16px 32px;
    }
  `,
})
export class AddressSheetComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly addresses = inject(AddressesService);
  private readonly modals = inject(ModalController);

  protected readonly states = BRAZILIAN_STATES;
  protected readonly request = createRequestState();

  protected readonly form = this.fb.group({
    label: ['', [notBlank, Validators.maxLength(60)]],
    street: ['', [notBlank, Validators.maxLength(150)]],
    number: ['', [notBlank, Validators.maxLength(20)]],
    complement: ['', [Validators.maxLength(80)]],
    district: ['', [notBlank, Validators.maxLength(80)]],
    city: ['', [notBlank, Validators.maxLength(80)]],
    state: ['', [Validators.required]],
    zipCode: ['', [Validators.required, zipCode]],
  });

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const address = await this.request.run(() =>
      firstValueFrom(
        this.addresses.create({
          label: v.label.trim(),
          street: v.street.trim(),
          number: v.number.trim(),
          complement: v.complement.trim() || null,
          district: v.district.trim(),
          city: v.city.trim(),
          state: v.state,
          zipCode: normalizeZip(v.zipCode),
        }),
      ),
    );
    if (address) {
      await this.modals.dismiss(address, 'created');
    }
  }
}
