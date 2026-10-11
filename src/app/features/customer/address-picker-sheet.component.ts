import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { Address } from '../../core/models';
import { areaLine, streetLine } from '../../core/util/address-format';
import { AddressSheetComponent } from './address-sheet.component';

/**
 * Sheet to choose one of the saved addresses for a stop, or save a new one on the spot.
 * Dismisses with the chosen address on role `picked`.
 */
@Component({
  selector: 'app-address-picker-sheet',
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="plain-header">
      <ion-toolbar class="plain">
        <ion-title>{{ heading() }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()">Fechar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="stack picker">
        @if (addresses().length === 0) {
          <p class="muted">Você ainda não tem endereços salvos. Cadastre o primeiro agora, é rápido.</p>
        }

        @for (address of addresses(); track address.id) {
          <button
            class="choice choice--row"
            type="button"
            [class.is-selected]="address.id === selectedId()"
            [disabled]="usedIds().includes(address.id)"
            (click)="choose(address)"
          >
            <ion-icon name="location-outline" aria-hidden="true" />
            <span class="choice__text">
              <strong>{{ address.label }}</strong>
              <small>{{ street(address) }}</small>
              <small>{{ area(address) }}</small>
              @if (address.latitude === null || address.longitude === null) {
                <small class="no-pos">Sem posição no mapa: a rota não será desenhada</small>
              }
              @if (usedIds().includes(address.id)) {
                <small class="choice__note">Já usado em outra parada</small>
              }
            </span>
            @if (address.id === selectedId()) {
              <ion-icon name="checkmark-circle-outline" class="choice__check" aria-hidden="true" />
            }
          </button>
        }

        <button class="btn btn--ghost btn--block" type="button" (click)="createNew()">
          <ion-icon name="add-outline" aria-hidden="true" /> Cadastrar novo endereço
        </button>
      </div>
    </ion-content>
  `,
  styles: `
    .picker {
      padding: 4px 16px calc(24px + var(--ion-safe-area-bottom, 0px));
    }
  `,
})
export class AddressPickerSheetComponent {
  private readonly modals = inject(ModalController);

  readonly heading = input('Escolher endereço');
  readonly addresses = input<readonly Address[]>([]);
  /** Addresses already used by other stops. They cannot be picked twice. */
  readonly usedIds = input<readonly string[]>([]);
  readonly selectedId = input('');

  protected street(address: Address): string {
    return streetLine(address);
  }

  protected area(address: Address): string {
    return areaLine(address);
  }

  protected choose(address: Address): Promise<boolean> {
    return this.modals.dismiss(address, 'picked');
  }

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }

  protected async createNew(): Promise<void> {
    const sheet = await this.modals.create({
      component: AddressSheetComponent,
      breakpoints: [0, 0.95],
      initialBreakpoint: 0.95,
      cssClass: 'sheet',
    });
    await sheet.present();
    const { role, data } = await sheet.onDidDismiss<Address>();
    if (role === 'created' && data) {
      // The new address is the one the customer wanted: pick it straight away.
      await this.modals.dismiss(data, 'picked');
    }
  }
}
