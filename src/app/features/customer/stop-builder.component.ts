import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonIcon,
  IonInput,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular';
import { Address, FreightItem, StopType } from '../../core/models';
import { STOP_TYPE_LABEL } from '../../core/ui/labels';
import { areaLine, streetLine } from '../../core/util/address-format';
import { notBlank } from '../../shared/forms/validators';
import { DraftStop, moveStop } from './freight-draft';

let localCounter = 0;
function localId(): string {
  localCounter += 1;
  return `stop-${Date.now().toString(36)}-${localCounter}`;
}

/**
 * Builds the ordered stops of a freight. The order of the list is the order the driver follows:
 * first a pickup, last a delivery. Addresses already used are not offered again.
 */
@Component({
  selector: 'app-stop-builder',
  imports: [ReactiveFormsModule, IonIcon, IonInput, IonSegment, IonSegmentButton, IonSelect, IonSelectOption],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @for (stop of stops(); track stop.id; let i = $index; let last = $last) {
        <article class="card stack">
          <div class="row">
            <span class="rank">{{ i + 1 }}</span>
            <span class="chip" [class.chip--red]="stop.type === 'Delivery'">{{ typeLabel[stop.type] }}</span>
            <span class="grow"></span>
            <button class="icon-btn" type="button" aria-label="Subir parada" [disabled]="i === 0" (click)="move(i, -1)">
              <ion-icon name="arrow-up-outline" />
            </button>
            <button class="icon-btn" type="button" aria-label="Descer parada" [disabled]="last" (click)="move(i, 1)">
              <ion-icon name="arrow-down-outline" />
            </button>
            <button class="icon-btn" type="button" aria-label="Remover parada" (click)="remove(stop.id)">
              <ion-icon name="trash-outline" />
            </button>
          </div>
          <p class="strong break">{{ addressTitle(stop.addressId) }}</p>
          <p class="muted small">{{ addressSubtitle(stop.addressId) }}</p>
          @if (stop.note) {
            <p class="small">Obs.: {{ stop.note }}</p>
          }
          @if (stop.items.length > 0) {
            <ul class="items">
              @for (item of stop.items; track $index) {
                <li>{{ item.quantity }}× {{ item.description }}</li>
              }
            </ul>
          }
        </article>
      }

      <form class="card stack" [formGroup]="form" (ngSubmit)="addStop()" novalidate>
        <strong class="small">Adicionar parada</strong>

        <ion-segment [value]="type()" (ionChange)="onType($event.detail.value)">
          <ion-segment-button value="Pickup">Coleta</ion-segment-button>
          <ion-segment-button value="Delivery">Entrega</ion-segment-button>
        </ion-segment>

        @if (available().length === 0) {
          <div class="notice">
            @if (addresses().length === 0) {
              Você ainda não tem endereços salvos.
            } @else {
              Todos os seus endereços já estão no frete.
            }
            <button class="link-btn" type="button" (click)="addAddress.emit()">Cadastrar endereço</button>
          </div>
        } @else {
          <ion-select
            formControlName="addressId"
            label="Endereço"
            labelPlacement="stacked"
            fill="outline"
            interface="action-sheet"
            cancelText="Cancelar"
            placeholder="Escolha um endereço"
            errorText="Escolha o endereço da parada"
          >
            @for (address of available(); track address.id) {
              <ion-select-option [value]="address.id">
                {{ address.label }} · {{ address.city }} - {{ address.state }}
              </ion-select-option>
            }
          </ion-select>
          <button class="link-btn" type="button" (click)="addAddress.emit()">Cadastrar outro endereço</button>
        }

        <ion-input
          formControlName="note"
          label="Observação (opcional)"
          labelPlacement="stacked"
          fill="outline"
          placeholder="Portão 2, falar com o João..."
        />

        <div class="stack">
          <strong class="small">Itens (opcional)</strong>
          @if (draftItems().length > 0) {
            <ul class="items">
              @for (item of draftItems(); track $index) {
                <li>
                  {{ item.quantity }}× {{ item.description }}
                  <button class="link-btn" type="button" [attr.aria-label]="'Remover ' + item.description" (click)="removeItem($index)">×</button>
                </li>
              }
            </ul>
          }
          <div class="form-grid form-grid--2 items-form" [formGroup]="itemForm">
            <ion-input formControlName="description" label="Descrição" labelPlacement="stacked" fill="outline" placeholder="Pastilhas de freio" />
            <ion-input formControlName="quantity" label="Quantidade" labelPlacement="stacked" fill="outline" inputmode="numeric" errorText="Use um número inteiro maior que zero" />
          </div>
          <div class="form-actions">
            <button class="btn btn--ghost btn--sm" type="button" (click)="addItem()">
              <ion-icon name="add-outline" aria-hidden="true" /> Incluir item
            </button>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn--dark" type="submit" [disabled]="available().length === 0">
            <ion-icon name="add-outline" aria-hidden="true" /> Adicionar parada
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .items li button {
      margin-left: 4px;
      text-decoration: none;
      font-size: 16px;
      line-height: 1;
    }
  `,
})
export class StopBuilderComponent {
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly addresses = input.required<readonly Address[]>();
  readonly stops = model.required<readonly DraftStop[]>();
  /** The customer wants to save another address. The page opens the address sheet. */
  readonly addAddress = output<void>();

  protected readonly typeLabel = STOP_TYPE_LABEL;
  protected readonly type = signal<StopType>('Pickup');
  protected readonly draftItems = signal<readonly FreightItem[]>([]);

  protected readonly form = this.fb.group({
    addressId: ['', [Validators.required]],
    note: ['', [Validators.maxLength(200)]],
  });

  protected readonly itemForm = this.fb.group({
    description: ['', [Validators.maxLength(120)]],
    quantity: ['1', [Validators.pattern(/^[1-9]\d{0,5}$/)]],
  });

  /** Addresses not used by any stop yet. */
  protected readonly available = computed(() => {
    const used = new Set(this.stops().map((stop) => stop.addressId));
    return this.addresses().filter((address) => !used.has(address.id));
  });

  protected onType(value: string | number | null | undefined): void {
    if (value === 'Pickup' || value === 'Delivery') {
      this.type.set(value);
    }
  }

  protected addItem(): void {
    const { description, quantity } = this.itemForm.getRawValue();
    if (notBlank(this.itemForm.controls.description) !== null || this.itemForm.controls.quantity.invalid) {
      this.itemForm.markAllAsTouched();
      return;
    }
    this.draftItems.update((items) => [...items, { description: description.trim(), quantity: Number(quantity) }]);
    this.itemForm.reset({ description: '', quantity: '1' });
  }

  protected removeItem(index: number): void {
    this.draftItems.update((items) => items.filter((_, i) => i !== index));
  }

  protected addStop(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { addressId, note } = this.form.getRawValue();
    this.stops.update((list) => [
      ...list,
      { id: localId(), type: this.type(), addressId, note: note.trim(), items: this.draftItems() },
    ]);
    // After a pickup the next stop is usually another pickup or the first delivery: keep the type.
    this.form.reset({ addressId: '', note: '' });
    this.draftItems.set([]);
    this.itemForm.reset({ description: '', quantity: '1' });
  }

  protected remove(id: string): void {
    this.stops.update((list) => list.filter((stop) => stop.id !== id));
  }

  protected move(index: number, delta: -1 | 1): void {
    this.stops.update((list) => moveStop(list, index, delta));
  }

  protected addressTitle(addressId: string): string {
    const address = this.find(addressId);
    return address ? `${address.label} · ${streetLine(address)}` : 'Endereço removido';
  }

  protected addressSubtitle(addressId: string): string {
    const address = this.find(addressId);
    return address ? areaLine(address) : '';
  }

  private find(addressId: string): Address | undefined {
    return this.addresses().find((address) => address.id === addressId);
  }
}
