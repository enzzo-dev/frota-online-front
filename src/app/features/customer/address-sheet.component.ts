import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
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
import { ZipLookupService } from '../../core/api/zip-lookup.service';
import { Address, CreateAddressRequest, GeoPoint } from '../../core/models';
import { BRAZILIAN_STATES } from '../../core/ui/labels';
import { createRequestState } from '../../core/ui/request-state';
import { normalizeZip } from '../../core/util/normalizers';
import { MapViewComponent } from '../../shared/components/map-view.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { notBlank, zipCode } from '../../shared/forms/validators';

/**
 * Bottom sheet that saves a pickup or delivery address, or edits one when `address` is given.
 * Dismisses with the saved address on role `created` (new) or `updated` (edited).
 */
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
        <ion-title>{{ address() ? 'Editar endereço' : 'Novo endereço' }}</ion-title>
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
        @switch (zipState()) {
          @case ('searching') {
            <p class="field-hint zip-hint"><ion-spinner name="crescent" /> Buscando o endereço pelo CEP...</p>
          }
          @case ('filled') {
            <p class="field-hint">Preenchemos o endereço pelo CEP. Confira e informe o número.</p>
          }
          @case ('notfound') {
            <p class="field-hint">Não encontramos esse CEP. Preencha o endereço à mão.</p>
          }
          @case ('error') {
            <p class="field-hint">O serviço de CEP não respondeu. Preencha o endereço à mão.</p>
          }
        }
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

        <app-problem-alert [error]="request.error()">
          @if (request.error()?.code === 'address.in_use') {
            <button class="btn btn--ghost btn--sm" type="button" [disabled]="request.loading()" (click)="save(true)">
              Salvar como novo endereço
            </button>
          }
        </app-problem-alert>

        <button class="btn btn--block" type="submit" [disabled]="request.loading()">
          @if (request.loading()) {
            <ion-spinner name="crescent" />
          }
          {{ address() ? 'Salvar alterações' : 'Salvar endereço' }}
        </button>
      </form>
    </ion-content>
  `,
  styles: `
    .zip-hint {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .zip-hint ion-spinner {
      width: 16px;
      height: 16px;
    }
    .geo-title {
      font-size: 1rem;
    }
    .sheet-body {
      padding: 16px 16px calc(32px + var(--ion-safe-area-bottom, 0px));
    }
  `,
})
export class AddressSheetComponent implements OnInit {
  /** The address being edited. Absent when saving a new one. */
  readonly address = input<Address | null>(null);

  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly addresses = inject(AddressesService);
  private readonly modals = inject(ModalController);
  private readonly geocoder = inject(GeocodingService);
  private readonly zipLookup = inject(ZipLookupService);

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
  protected readonly zipState = signal<'idle' | 'searching' | 'filled' | 'notfound' | 'error'>('idle');
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

  /** The last CEP looked up (or the one loaded for editing), so the same CEP is not fetched twice. */
  private lastZip = '';
  private zipToken = 0;

  constructor() {
    this.form.controls.zipCode.valueChanges.subscribe((value) => void this.onZipChange(value));
  }

  /** Fills street, district, city and state once the CEP has its 8 digits. Never blocks: the fields stay editable. */
  private async onZipChange(value: string): Promise<void> {
    const zip = normalizeZip(value);
    if (zip.length !== 8) {
      this.zipToken += 1;
      this.zipState.set('idle');
      return;
    }
    if (zip === this.lastZip) {
      return;
    }
    this.lastZip = zip;
    const token = (this.zipToken += 1);
    this.zipState.set('searching');
    try {
      const found = await this.zipLookup.lookup(zip);
      if (token !== this.zipToken) {
        return;
      }
      if (!found) {
        this.zipState.set('notfound');
        return;
      }
      // Only what the CEP knows: a city with a single CEP has no street, so the typed one is kept.
      const patch: Partial<{ street: string; district: string; city: string; state: string }> = {};
      if (found.street) patch.street = found.street;
      if (found.district) patch.district = found.district;
      if (found.city) patch.city = found.city;
      if (found.state && this.states.includes(found.state)) patch.state = found.state;
      this.form.patchValue(patch);
      // The pin belonged to the old address.
      this.position.set(null);
      this.geoState.set('idle');
      this.zipState.set('filled');
    } catch {
      if (token === this.zipToken) {
        this.zipState.set('error');
      }
    }
  }

  ngOnInit(): void {
    const current = this.address();
    if (!current) {
      return;
    }
    // Editing starts from a saved address: do not overwrite it by looking its CEP up again.
    this.lastZip = normalizeZip(current.zipCode);
    this.form.patchValue({
      label: current.label,
      street: current.street,
      number: current.number,
      complement: current.complement ?? '',
      district: current.district,
      city: current.city,
      state: current.state,
      zipCode: current.zipCode,
    });
    if (current.latitude !== null && current.longitude !== null) {
      this.position.set({ latitude: current.latitude, longitude: current.longitude });
    }
  }

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }

  /** `asNew` saves a copy instead of editing, for an address a freight already used. */
  protected async save(asNew = false): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const point = this.position();
    const payload: CreateAddressRequest = {
      label: v.label.trim(),
      street: v.street.trim(),
      number: v.number.trim(),
      complement: v.complement.trim() || null,
      district: v.district.trim(),
      city: v.city.trim(),
      state: v.state,
      zipCode: normalizeZip(v.zipCode),
      // Both or neither. On an edit, leaving them out would clear the position.
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
    };
    const target = asNew ? null : this.address();
    const saved = await this.request.run(() =>
      firstValueFrom(target ? this.addresses.update(target.id, payload) : this.addresses.create(payload)),
    );
    if (saved) {
      await this.modals.dismiss(saved, target ? 'updated' : 'created');
    }
  }
}
