import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
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
import { GeocodingService } from '../../core/api/geocoding.service';
import { GeoPoint } from '../../core/models';
import { BRAZILIAN_STATES } from '../../core/ui/labels';
import { createRequestState } from '../../core/ui/request-state';
import { normalizeZip } from '../../core/util/normalizers';
import { MapViewComponent } from '../../shared/components/map-view.component';
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
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
    MapViewComponent,
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
      <form class="stack sheet-body" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <ion-input
          formControlName="label"
          label="Apelido"
          labelPlacement="stacked"
          fill="outline"
          placeholder="Galpão, Loja centro..."
          helperText="Como você reconhece este endereço."
          errorText="Dê um apelido ao endereço"
        />
        <div class="form-pair" style="--cols: 1.2fr 1fr">
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
        <div class="form-pair" style="--cols: 0.8fr 1.2fr">
          <ion-input
            formControlName="number"
            label="Número"
            labelPlacement="stacked"
            fill="outline"
            errorText="Informe o número"
          />
          <ion-input formControlName="complement" label="Complemento" labelPlacement="stacked" fill="outline" placeholder="Opcional" />
        </div>
        <div class="form-pair">
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

        <section class="panel stack" aria-labelledby="geo-title">
          <div>
            <h3 id="geo-title" class="geo-title">Posição no mapa</h3>
            <p class="muted small">
              Com a posição, a rota do frete pode ser desenhada e o motorista vê a distância. Sem ela o endereço
              funciona, mas não aparece no mapa.
            </p>
          </div>

          <button class="btn btn--ghost btn--sm btn--block" type="button" (click)="locate()" [disabled]="locating()">
            @if (locating()) {
              <ion-spinner name="crescent" />
            } @else {
              <ion-icon name="navigate-outline" aria-hidden="true" />
            }
            {{ position() ? 'Localizar de novo' : 'Localizar no mapa' }}
          </button>

          @switch (geoState()) {
            @case ('incomplete') {
              <p class="field-hint">Preencha CEP, estado, rua, número e cidade para localizar.</p>
            }
            @case ('notfound') {
              <p class="notice small">
                Não achamos este endereço no mapa. Revise rua e número, ou salve sem posição.
              </p>
            }
            @case ('error') {
              <p class="notice notice--error small">
                O serviço de mapas não respondeu. Tente de novo em instantes ou salve sem posição.
              </p>
            }
          }

          @if (position(); as point) {
            <app-map-view
              [pins]="[point]"
              [draggable]="true"
              ariaLabel="Posição do endereço no mapa. Arraste o pino para ajustar."
              (pinMoved)="position.set($event)"
            />
            <p class="small muted">Arraste o pino ou toque no mapa para ajustar a posição exata.</p>
            <button class="link-btn" type="button" (click)="clearPosition()">Salvar sem posição</button>
          }
        </section>

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
    .geo-title {
      font-size: 1rem;
    }
    .sheet-body {
      padding: 16px 16px calc(32px + var(--ion-safe-area-bottom, 0px));
    }
  `,
})
export class AddressSheetComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly addresses = inject(AddressesService);
  private readonly modals = inject(ModalController);
  private readonly geocoder = inject(GeocodingService);

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

  /** Where the address is on the map. Both coordinates or none: the API rejects only one of them. */
  protected readonly position = signal<GeoPoint | null>(null);
  protected readonly locating = signal(false);
  protected readonly geoState = signal<'idle' | 'incomplete' | 'notfound' | 'error'>('idle');

  protected async locate(): Promise<void> {
    const v = this.form.getRawValue();
    const zip = normalizeZip(v.zipCode);
    if (!v.street.trim() || !v.number.trim() || !v.city.trim() || !v.state || zip.length !== 8) {
      this.geoState.set('incomplete');
      return;
    }
    this.locating.set(true);
    this.geoState.set('idle');
    try {
      const point = await this.geocoder.locate({
        street: v.street.trim(),
        number: v.number.trim(),
        district: v.district.trim(),
        city: v.city.trim(),
        state: v.state,
        zipCode: zip,
      });
      if (point) {
        this.position.set(point);
      } else {
        this.geoState.set('notfound');
      }
    } catch {
      this.geoState.set('error');
    } finally {
      this.locating.set(false);
    }
  }

  protected clearPosition(): void {
    this.position.set(null);
    this.geoState.set('idle');
  }

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const point = this.position();
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
          latitude: point?.latitude ?? null,
          longitude: point?.longitude ?? null,
        }),
      ),
    );
    if (address) {
      await this.modals.dismiss(address, 'created');
    }
  }
}
