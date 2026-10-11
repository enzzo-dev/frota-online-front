import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { ToastService } from '../../core/ui/toast.service';
import { UtcPipe } from '../pipes/utc.pipe';

/**
 * A Pix issued by the app: the QR code, the copy-and-paste code and when it expires. Presentational. Whatever
 * is projected (the split of the amount, a hint) goes above the code.
 */
@Component({
  selector: 'app-pix-card',
  imports: [CurrencyPipe, DatePipe, IonIcon, UtcPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pix card stack" aria-label="Pix">
      <div class="pix__top">
        <p class="pix__amount">{{ amount() | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</p>
        <span class="chip chip--outline">Pix</span>
      </div>
      <ng-content />

      @if (qrSrc(); as src) {
        <img class="pix__qr" [src]="src" alt="QR code do Pix" width="200" height="200" />
      }

      <div class="stack">
        <label class="strong" for="pix-code">Pix copia e cola</label>
        <textarea id="pix-code" class="pix__code" readonly rows="3" [value]="payload()"></textarea>
        <button class="btn btn--ghost btn--block" type="button" (click)="copy()">
          <ion-icon [name]="copied() ? 'checkmark-outline' : 'document-text-outline'" aria-hidden="true" />
          {{ copied() ? 'Código copiado' : 'Copiar código' }}
        </button>
        <p class="field-hint">
          Vale até {{ expiresAt() | utc | date: "dd/MM 'às' HH:mm" }}. Quando o pagamento cair, esta tela atualiza sozinha.
        </p>
      </div>
    </section>
  `,
  styles: `
    .pix__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .pix__amount {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.9rem;
      letter-spacing: -0.03em;
      margin: 0;
    }
    .pix__qr {
      align-self: center;
      width: 200px;
      height: 200px;
      padding: 8px;
      background: #fff;
      border: 1.5px solid var(--line);
      border-radius: var(--r-md);
      image-rendering: pixelated;
    }
    .pix__code {
      width: 100%;
      resize: none;
      padding: 10px 12px;
      font: 500 12px/1.4 var(--font-mono);
      color: var(--ink-soft);
      background: var(--panel);
      border: 1.5px solid var(--line);
      border-radius: var(--r-sm);
      word-break: break-all;
    }
  `,
})
export class PixCardComponent {
  private readonly toast = inject(ToastService);

  readonly amount = input.required<number>();
  readonly payload = input.required<string>();
  /** Base64 PNG, as the API sends it. */
  readonly qrCode = input<string | null>(null);
  readonly expiresAt = input.required<string>();

  protected readonly copied = signal(false);
  protected readonly qrSrc = computed(() => {
    const code = this.qrCode();
    if (!code) {
      return null;
    }
    return code.startsWith('data:') ? code : `data:image/png;base64,${code}`;
  });

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.payload());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    } catch {
      await this.toast.show('Não consegui copiar. Selecione o código e copie à mão.');
    }
  }
}
