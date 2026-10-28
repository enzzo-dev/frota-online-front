import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { digitsOnly, normalizePhone } from '../../core/util/normalizers';

@Component({
  selector: 'app-contact-card',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .contact {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border-radius: 20px;
      border: 1.5px solid var(--line, #e4e4e7);
      background: var(--white);
    }
    .contact__head {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .avatar {
      display: grid;
      place-items: center;
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--black);
      color: #fff;
      font: 700 1.1rem/1 var(--font-display);
    }
    .contact__who {
      min-width: 0;
    }
    .contact__who strong {
      display: block;
      font: 700 1.05rem/1.2 var(--font-display);
    }
    .contact__phone {
      font: 600 0.9rem/1.2 var(--font-mono, monospace);
      color: var(--muted, #6b6b70);
    }
    .actions {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
    }
    .btn-wa,
    .btn-call {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px;
      border-radius: 16px;
      font: 700 0.92rem/1 var(--font-display);
      white-space: nowrap;
      text-decoration: none;
    }
    .btn-wa {
      background: #25d366;
      color: #06210f;
    }
    .btn-call {
      border: 1.5px solid var(--black);
      color: var(--black);
    }
    .notice {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0;
      font-size: 0.78rem;
      color: var(--muted, #6b6b70);
    }
    .notice ion-icon {
      flex: none;
      margin-top: 1px;
      font-size: 14px;
    }
  `,
  template: `
    <section class="contact" [attr.aria-label]="'Contato com ' + role().toLowerCase()">
      <div class="contact__head">
        <span class="avatar" aria-hidden="true">{{ initial() }}</span>
        <div class="contact__who">
          <strong>{{ name() || role() }}</strong>
          @if (display(); as shown) {
            <span class="contact__phone">{{ shown }}</span>
          } @else {
            <span class="contact__phone">Contato indisponível</span>
          }
        </div>
      </div>

      @if (whatsapp(); as link) {
        <div class="actions">
          <a class="btn-wa" [href]="link" target="_blank" rel="noopener">
            <ion-icon name="logo-whatsapp" aria-hidden="true" />
            Chamar no WhatsApp
          </a>
          <a class="btn-call" [href]="tel()">
            <ion-icon name="call-outline" aria-hidden="true" />
            Ligar
          </a>
        </div>
      }

      <p class="notice">
        <ion-icon name="lock-closed-outline" aria-hidden="true" />
        <span>
          O telefone só é liberado depois que o frete é aceito e fica visível apenas para você e para
          {{ counterpart() }}. Use o contato só para combinar esta entrega.
        </span>
      </p>
    </section>
  `,
})
export class ContactCardComponent {
  readonly role = input.required<'Cliente' | 'Motorista'>();
  readonly name = input<string | null | undefined>(null);
  readonly phone = input<string | null | undefined>(null);
  readonly freightLabel = input<string | null>(null);

  protected readonly initial = computed(() => (this.name() ?? this.role()).charAt(0).toUpperCase());
  protected readonly counterpart = computed(() => (this.role() === 'Cliente' ? 'o cliente' : 'o motorista'));

  private readonly e164 = computed(() => {
    const raw = this.phone();
    return raw && digitsOnly(raw).length >= 10 ? normalizePhone(raw) : null;
  });

  protected readonly display = computed(() => {
    const value = this.e164();
    if (!value) {
      return null;
    }
    const digits = digitsOnly(value);
    if (digits.startsWith('55') && digits.length >= 12) {
      const local = digits.slice(2);
      const area = local.slice(0, 2);
      const rest = local.slice(2);
      const split = rest.length === 9 ? 5 : 4;
      return `(${area}) ${rest.slice(0, split)}-${rest.slice(split)}`;
    }
    return value;
  });

  protected readonly tel = computed(() => `tel:${this.e164() ?? ''}`);

  protected readonly whatsapp = computed(() => {
    const value = this.e164();
    if (!value) {
      return null;
    }
    const greeting = this.role() === 'Cliente' ? 'Olá! Sou o motorista do seu frete pela Frota Online.' : 'Olá! Sou o cliente do frete pela Frota Online.';
    const label = this.freightLabel();
    const text = label ? `${greeting} (${label})` : greeting;
    return `https://wa.me/${digitsOnly(value)}?text=${encodeURIComponent(text)}`;
  });
}
