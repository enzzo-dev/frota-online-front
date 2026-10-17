import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { IonContent, IonIcon, IonSpinner, ModalController } from '@ionic/angular';
import { SignaturePadComponent } from '../../shared/components/signature-pad.component';

@Component({
  selector: 'app-driver-signature-sheet',
  imports: [IonContent, IonIcon, IonSpinner, SignaturePadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .sheet {
      display: flex;
      flex-direction: column;
      gap: 20px;
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
  `,
  template: `
    <ion-content>
      <div class="sheet">
        <header class="bar">
          <span class="bar__title">Sua assinatura</span>
          <button class="bar__close" type="button" (click)="close()">Fechar</button>
        </header>

        <p class="lede">
          A assinatura do motorista é obrigatória para concluir a entrega, e o cliente também precisa assinar, pelo app
          dele. Concluir encerra a entrega e lança a taxa da plataforma no seu extrato.
        </p>

        <app-signature-pad #pad (signedChange)="signed.set($event)" />

        <button class="btn btn--block" type="button" [disabled]="!signed() || busy()" (click)="confirm()">
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
export class DriverSignatureSheetComponent {
  private readonly modals = inject(ModalController);
  private readonly pad = viewChild.required<SignaturePadComponent>('pad');

  protected readonly signed = signal(false);
  protected readonly busy = signal(false);

  protected close(): Promise<boolean> {
    return this.modals.dismiss(null, 'cancel');
  }

  protected async confirm(): Promise<void> {
    if (!this.signed()) {
      return;
    }
    this.busy.set(true);
    try {
      const image = await this.pad().toBlob();
      if (image) {
        await this.modals.dismiss(image, 'confirm');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
