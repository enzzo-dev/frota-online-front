import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal, viewChild } from '@angular/core';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { SignatureService } from '../../core/api/signature.service';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { SignaturePadComponent } from '../../shared/components/signature-pad.component';

const STORAGE_PREFIX = 'frota.signature.customer.';

@Component({
  selector: 'app-delivery-signature',
  imports: [IonIcon, IonSpinner, ProblemAlertComponent, SignaturePadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card stack" aria-labelledby="signature-title">
      <h3 id="signature-title">Assinatura da entrega</h3>
      @if (sent()) {
        <p class="row">
          <ion-icon name="checkmark-circle-outline" aria-hidden="true" />
          <span>Assinatura enviada. O motorista já pode concluir a entrega.</span>
        </p>
      } @else {
        <p class="field-hint">
          Para a entrega ser concluída, a sua assinatura e a do motorista são obrigatórias. Assine abaixo com o dedo.
        </p>
        <app-signature-pad #pad (signedChange)="signed.set($event)" />
        <app-problem-alert [error]="request.error()" />
        <button class="btn btn--block" type="button" [disabled]="!signed() || request.loading()" (click)="send()">
          @if (request.loading()) {
            <ion-spinner name="crescent" />
          } @else {
            <ion-icon name="create-outline" aria-hidden="true" />
          }
          Enviar assinatura
        </button>
      }
    </section>
  `,
})
export class DeliverySignatureComponent implements OnInit {
  readonly freightId = input.required<string>();

  private readonly signatures = inject(SignatureService);
  private readonly toast = inject(ToastService);
  private readonly pad = viewChild<SignaturePadComponent>('pad');

  protected readonly request = createRequestState();
  protected readonly signed = signal(false);
  protected readonly sent = signal(false);

  ngOnInit(): void {
    this.sent.set(this.wasSent());
  }

  protected async send(): Promise<void> {
    const image = await this.pad()?.toBlob();
    if (!image) {
      return;
    }
    const done = await this.request.run(async () => {
      await this.signatures.submit('Customer', this.freightId(), image);
      return true;
    });
    if (done) {
      this.remember();
      this.sent.set(true);
      await this.toast.show('Assinatura enviada.');
    }
  }

  private wasSent(): boolean {
    try {
      return localStorage.getItem(STORAGE_PREFIX + this.freightId()) === '1';
    } catch {
      return false;
    }
  }

  private remember(): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + this.freightId(), '1');
    } catch {
      return;
    }
  }
}
