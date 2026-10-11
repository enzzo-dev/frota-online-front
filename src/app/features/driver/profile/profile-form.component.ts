import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { IonInput, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverService } from '../../../core/api/driver.service';
import { DriverProfile } from '../../../core/models';
import { CNH_CATEGORIES } from '../../../core/ui/labels';
import { createRequestState } from '../../../core/ui/request-state';
import { maskTaxId } from '../../../core/util/masks';
import { MaskDirective } from '../../../shared/forms/mask.directive';
import { normalizeTaxId } from '../../../core/util/normalizers';
import { ProblemAlertComponent } from '../../../shared/components/problem-alert.component';
import { notBlank, taxId } from '../../../shared/forms/validators';
import { Validators } from '@angular/forms';

/** Step 2: CPF/CNPJ, CNH and category. Read-only once the profile is under review or approved. */
@Component({
  selector: 'app-driver-profile-form',
  imports: [MaskDirective, ReactiveFormsModule, IonInput, IonSelect, IonSelectOption, IonSpinner, ProblemAlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editable()) {
      <form class="stack" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <ion-input
          formControlName="taxId"
          appMask="taxId"
          label="CPF ou CNPJ"
          labelPlacement="stacked"
          fill="outline"
          inputmode="text"
          autocapitalize="characters"
          helperText="Pode digitar com ou sem pontuação. CNPJ aceita letras."
          errorText="Informe 11 dígitos (CPF) ou 14 caracteres (CNPJ)"
        />
        <div class="form-grid form-grid--2">
          <ion-input
            formControlName="cnhNumber"
            label="Número da CNH"
            labelPlacement="stacked"
            fill="outline"
            inputmode="numeric"
            errorText="Informe o número da CNH"
          />
          <ion-select
            formControlName="cnhCategory"
            label="Categoria"
            labelPlacement="stacked"
            fill="outline"
            interface="action-sheet"
            cancelText="Cancelar"
            placeholder="Selecione"
            errorText="Escolha a categoria"
          >
            @for (category of categories; track category) {
              <ion-select-option [value]="category">{{ category }}</ion-select-option>
            }
          </ion-select>
        </div>

        <app-problem-alert [error]="request.error()" />

        <div class="form-actions">
          <button class="btn" type="submit" [disabled]="request.loading()">
            @if (request.loading()) {
              <ion-spinner name="crescent" />
            }
            Salvar dados
          </button>
        </div>
      </form>
    } @else if (profile(); as p) {
      <dl class="kv">
        <dt>CPF/CNPJ</dt>
        <dd class="mono">{{ maskedTaxId(p.taxId) }}</dd>
        <dt>CNH</dt>
        <dd class="mono">{{ p.cnhNumber }}</dd>
        <dt>Categoria</dt>
        <dd>{{ p.cnhCategory }}</dd>
      </dl>
    }
  `,
})
export class DriverProfileFormComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly driver = inject(DriverService);

  readonly profile = input<DriverProfile | null>(null);
  readonly editable = input(true);
  readonly saved = output<DriverProfile>();

  protected readonly categories = CNH_CATEGORIES;
  protected readonly request = createRequestState();

  protected readonly form = this.fb.group({
    taxId: ['', [notBlank, taxId]],
    cnhNumber: ['', [notBlank, Validators.maxLength(20)]],
    cnhCategory: ['', [Validators.required]],
  });

  protected readonly maskedTaxId = maskTaxId;

  constructor() {
    // Fill the form from the saved profile whenever it changes (first load, or a refresh).
    effect(() => {
      const current = this.profile();
      if (current) {
        this.form.patchValue(
          { taxId: maskTaxId(current.taxId), cnhNumber: current.cnhNumber, cnhCategory: current.cnhCategory },
          { emitEvent: false },
        );
      }
    });
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const profile = await this.request.run(() =>
      firstValueFrom(
        this.driver.saveProfile({
          taxId: normalizeTaxId(value.taxId),
          cnhNumber: value.cnhNumber.trim(),
          cnhCategory: value.cnhCategory,
        }),
      ),
    );
    if (profile) {
      this.saved.emit(profile);
    }
  }
}
