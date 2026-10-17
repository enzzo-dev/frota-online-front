import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { IonContent, IonIcon, IonSpinner, ModalController } from '@ionic/angular';
import { SignaturePadComponent } from '../../shared/components/signature-pad.component';

export interface DeliverySignatures {
  readonly driver: Blob;
  readonly customer: Blob;
}

@Component({
  selector: 'app-delivery-signatures-sheet',
  imports: [IonContent, IonIcon, IonSpinner, SignaturePadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .sheet {
      display: flex;
      flex-direction: column;
      gap: 22px;
      padding: 8px 18px calc(24px + var(--ion-safe-area-bottom, 0px));
    }
    .bar {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-top: 10px;
    }
    .bar__title {
      font: 700 1.25rem/1 var(--font-display);
      letter-spacing: -0.02em;
    }
    .bar__close {
      border: 0;
      background: none;
      padding: 6px 0;
      font: 600 14px var(--font-body);
      color: var(--ink-soft);
      cursor: pointer;
    }
    .lede {
      margin: 0;
      color: var(--ink-soft);
      font-size: 15px;
    }
    .party {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .party__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .party__title {
      font: 700 1rem/1.2 var(--font-display);
    }
    .party__ok {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      font-weight: 700;
    }
    .party__todo {
      font-size: 13px;
      color: var(--ink-mute);
    }
  `,
  template: `
    <ion-content>
      <div class="sheet">
        <header class="bar">
          <span class="bar__title">Assinaturas da entrega</span>
          <button class="bar__close" type="button" [disabled]="busy()" (click)="close()">Fechar</button>
        </header>

        <p class="lede">
          Para concluir a entrega, as assinaturas do motorista e do cliente são obrigatórias. Assine e depois passe o celular ao
          cliente. Concluir encerra a entrega e lança a taxa da plataforma no seu extrato.
        </p>

        <section class="party" aria-label="Assinatura do motorista">
          <div class="party__head">
            <span class="party__title">Motorista</span>
            @if (driverSigned()) {
              <span class="party__ok"><ion-icon name="checkmark-circle-outline" aria-hidden="true" /> Assinado</span>
            } @else {
              <span class="party__todo">Obrigatória</span>
            }
          </div>
          <app-signature-pad #driverPad (signedChange)="driverSigned.set($event)" />
        </section>

        <section class="party" aria-label="Assinatura do cliente">
          <div class="party__head">
            <span class="party__title">Cliente</span>
            @if (customerSigned()) {
              <span class="party__ok"><ion-icon name="checkmark-circle-outline" aria-hidden="true" /> Assinado</span>
            } @else {
              <span class="party__todo">Obrigatória</span>
            }
          </div>
          <app-signature-pad #customerPad (signedChange)="customerSigned.set($event)" />
        </section>

        <button class="btn btn--block" type="button" [disabled]="!ready() || busy()" (click)="confirm()">
          @if (busy()) {
            <ion-spinner name="crescent" />
          } @else {
            <ion-icon name="checkmark-outline" aria-hidden="true" />
          }
          Assinar e concluir
        </button>
      </div>
    </ion-content>
  `,
})
export class DeliverySignaturesSheetComponent {
  private readonly modals = inject(ModalController);
  private readonly driverPad = viewChild.required<SignaturePadComponent>('driverPad');
  private readonly customerPad = viewChild.required<SignaturePadComponent>('customerPad');

  protected readonly driverSigned = signal(false);
  protected readonly customerSigned = signal(false);
  protected readonly busy = signal(false);
  protected readonly ready = computed(() => this.driverSigned() && this.customerSigned());

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }

  protected async confirm(): Promise<void> {
    if (!this.ready()) {
      return;
    }
    this.busy.set(true);
    try {
      const [driver, customer] = await Promise.all([this.driverPad().toBlob(), this.customerPad().toBlob()]);
      if (driver && customer) {
        await this.modals.dismiss({ driver, customer } satisfies DeliverySignatures, 'confirm');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
