import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonIcon, IonInput, IonSegment, IonSegmentButton, ModalController } from '@ionic/angular';
import { Address, StopType } from '../../core/models';
import { STOP_TYPE_LABEL } from '../../core/ui/labels';
import { areaLine, streetLine } from '../../core/util/address-format';
import { notBlank } from '../../shared/forms/validators';
import { AddressPickerSheetComponent } from './address-picker-sheet.component';
import { DraftStop, moveStop, newStopId } from './freight-draft';

/**
 * The route of a freight as a list of slots: always a pickup first and a delivery last, with optional
 * stops in between. Each slot is filled by tapping it and choosing an address.
 */
@Component({
  selector: 'app-route-planner',
  imports: [ReactiveFormsModule, IonIcon, IonInput, IonSegment, IonSegmentButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './route-planner.component.scss',
  template: `
    <ol class="planner" aria-label="Paradas do frete">
      @for (stop of stops(); track stop.id; let i = $index; let first = $first; let last = $last) {
        <li class="slot">
          <span class="slot__pin" [class.slot__pin--delivery]="stop.type === 'Delivery'" aria-hidden="true">
            {{ i + 1 }}
          </span>

          <div class="slot__body">
            <div class="row">
              <span class="slot__kind">{{ kind(stop, first, last) }}</span>
              <span class="grow"></span>
              @if (!first && !last) {
                <button class="icon-btn" type="button" aria-label="Subir parada" [disabled]="i <= 1" (click)="move(i, -1)">
                  <ion-icon name="arrow-up-outline" />
                </button>
                <button
                  class="icon-btn"
                  type="button"
                  aria-label="Descer parada"
                  [disabled]="i >= stops().length - 2"
                  (click)="move(i, 1)"
                >
                  <ion-icon name="arrow-down-outline" />
                </button>
                <button class="icon-btn" type="button" aria-label="Remover parada" (click)="remove(stop.id)">
                  <ion-icon name="trash-outline" />
                </button>
              }
            </div>

            @if (!first && !last) {
              <ion-segment [value]="stop.type" (ionChange)="onType(stop.id, $event.detail.value)">
                <ion-segment-button value="Pickup">Coletar</ion-segment-button>
                <ion-segment-button value="Delivery">Entregar</ion-segment-button>
              </ion-segment>
            }

            <button
              class="slot__pick"
              type="button"
              [class.is-empty]="!stop.addressId"
              (click)="pick(stop, first, last)"
            >
              @if (find(stop.addressId); as address) {
                <span class="slot__address">
                  <strong>{{ address.label }}</strong>
                  <small>{{ street(address) }}</small>
                  <small>{{ area(address) }}</small>
                </span>
                <span class="slot__change">Trocar</span>
              } @else {
                <ion-icon name="add-outline" aria-hidden="true" />
                <span>{{ placeholder(stop, first, last) }}</span>
              }
            </button>

            @if (stop.addressId) {
              <button class="link-btn slot__more" type="button" (click)="toggleDetails(stop.id)">
                {{ openId() === stop.id ? 'Ocultar detalhes' : detailsLabel(stop) }}
              </button>
            }

            @if (openId() === stop.id) {
              <div class="stack slot__details">
                <ion-input
                  label="Observação para o motorista"
                  labelPlacement="stacked"
                  fill="outline"
                  maxlength="200"
                  placeholder="Portão 2, falar com o João..."
                  [value]="stop.note"
                  (ionInput)="onNote(stop.id, $event.detail.value)"
                />

                @if (stop.items.length > 0) {
                  <ul class="items">
                    @for (item of stop.items; track $index) {
                      <li>
                        {{ item.quantity }}× {{ item.description }}
                        <button type="button" class="link-btn" [attr.aria-label]="'Remover ' + item.description" (click)="removeItem(stop.id, $index)">×</button>
                      </li>
                    }
                  </ul>
                }

                <form class="slot__item-form" [formGroup]="itemForm" (ngSubmit)="addItem(stop.id)" novalidate>
                  <ion-input
                    formControlName="description"
                    label="Item"
                    labelPlacement="stacked"
                    fill="outline"
                    placeholder="Pastilhas de freio"
                  />
                  <ion-input
                    formControlName="quantity"
                    label="Qtd."
                    labelPlacement="stacked"
                    fill="outline"
                    inputmode="numeric"
                  />
                  <button class="btn btn--ghost btn--sm" type="submit">Adicionar</button>
                </form>
              </div>
            }
          </div>
        </li>
      }
    </ol>

    <button class="btn btn--ghost btn--block slot__add" type="button" (click)="addMiddle()">
      <ion-icon name="add-outline" aria-hidden="true" /> Adicionar outra parada no caminho
    </button>
  `,
})
export class RoutePlannerComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly modals = inject(ModalController);

  readonly addresses = input.required<readonly Address[]>();
  readonly stops = model.required<readonly DraftStop[]>();
  /** A new address was saved from the picker, so the page can add it to its list. */
  readonly addressSaved = output<Address>();

  protected readonly typeLabel = STOP_TYPE_LABEL;
  /** The stop whose note and items are being edited. Only one is open at a time. */
  protected readonly openId = signal<string | null>(null);

  protected readonly itemForm = this.fb.group({
    description: ['', [Validators.maxLength(120)]],
    quantity: ['1', [Validators.pattern(/^[1-9]\d{0,5}$/)]],
  });

  private readonly byId = computed(() => new Map(this.addresses().map((address) => [address.id, address] as const)));

  protected find(addressId: string): Address | undefined {
    return addressId ? this.byId().get(addressId) : undefined;
  }

  protected street(address: Address): string {
    return streetLine(address);
  }

  protected area(address: Address): string {
    return areaLine(address);
  }

  protected kind(stop: DraftStop, first: boolean, last: boolean): string {
    if (first) {
      return 'Onde coletar';
    }
    if (last) {
      return 'Onde entregar (destino final)';
    }
    return `Parada extra · ${this.typeLabel[stop.type].toLowerCase()}`;
  }

  protected placeholder(stop: DraftStop, first: boolean, last: boolean): string {
    if (first) {
      return 'Escolher endereço de coleta';
    }
    if (last) {
      return 'Escolher endereço de entrega';
    }
    return stop.type === 'Pickup' ? 'Escolher endereço da coleta' : 'Escolher endereço da entrega';
  }

  protected detailsLabel(stop: DraftStop): string {
    const parts = [stop.note ? 'observação' : '', stop.items.length > 0 ? `${stop.items.length} item(ns)` : ''].filter(Boolean);
    return parts.length > 0 ? `Detalhes: ${parts.join(' e ')}` : 'Adicionar observação ou itens';
  }

  protected async pick(stop: DraftStop, first: boolean, last: boolean): Promise<void> {
    const sheet = await this.modals.create({
      component: AddressPickerSheetComponent,
      componentProps: {
        heading: this.placeholder(stop, first, last),
        addresses: this.addresses(),
        usedIds: this.stops()
          .filter((other) => other.id !== stop.id && other.addressId !== '')
          .map((other) => other.addressId),
        selectedId: stop.addressId,
      },
      breakpoints: [0, 0.7, 0.95],
      initialBreakpoint: 0.7,
      cssClass: 'sheet',
    });
    await sheet.present();
    const { role, data } = await sheet.onDidDismiss<Address>();
    if (role !== 'picked' || !data) {
      return;
    }
    if (!this.byId().has(data.id)) {
      this.addressSaved.emit(data);
    }
    this.patch(stop.id, { addressId: data.id });
  }

  protected addMiddle(): void {
    this.stops.update((list) => {
      const next = [...list];
      next.splice(next.length - 1, 0, { id: newStopId(), type: 'Pickup', addressId: '', note: '', items: [] });
      return next;
    });
  }

  protected remove(id: string): void {
    this.stops.update((list) => list.filter((stop) => stop.id !== id));
    if (this.openId() === id) {
      this.openId.set(null);
    }
  }

  protected move(index: number, delta: -1 | 1): void {
    this.stops.update((list) => moveStop(list, index, delta));
  }

  protected onType(id: string, value: string | number | null | undefined): void {
    if (value === 'Pickup' || value === 'Delivery') {
      this.patch(id, { type: value as StopType });
    }
  }

  protected onNote(id: string, value: string | number | null | undefined): void {
    this.patch(id, { note: typeof value === 'string' ? value : '' });
  }

  protected toggleDetails(id: string): void {
    this.openId.update((current) => (current === id ? null : id));
    this.itemForm.reset({ description: '', quantity: '1' });
  }

  protected addItem(id: string): void {
    const { description, quantity } = this.itemForm.getRawValue();
    if (notBlank(this.itemForm.controls.description) !== null || this.itemForm.controls.quantity.invalid) {
      this.itemForm.markAllAsTouched();
      return;
    }
    const stop = this.stops().find((candidate) => candidate.id === id);
    if (stop) {
      this.patch(id, { items: [...stop.items, { description: description.trim(), quantity: Number(quantity) }] });
    }
    this.itemForm.reset({ description: '', quantity: '1' });
  }

  protected removeItem(id: string, index: number): void {
    const stop = this.stops().find((candidate) => candidate.id === id);
    if (stop) {
      this.patch(id, { items: stop.items.filter((_, i) => i !== index) });
    }
  }

  private patch(id: string, change: Partial<DraftStop>): void {
    this.stops.update((list) => list.map((stop) => (stop.id === id ? { ...stop, ...change } : stop)));
  }
}
