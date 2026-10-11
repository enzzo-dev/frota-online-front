import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CARD_BRAND_LABEL, CardBrand } from '../../core/util/card';

/**
 * A card drawn from what is being typed. It turns over to show the security code while that field has focus.
 * Presentational: it never sees more than the form already shows on screen.
 */
@Component({
  selector: 'app-credit-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cc" [class.cc--flipped]="flipped()" [attr.data-brand]="brand()" role="img" [attr.aria-label]="label()">
      <div class="cc__face cc__front">
        <span class="cc__glow" aria-hidden="true"></span>
        <div class="cc__top">
          <span class="cc__chip" aria-hidden="true"></span>
          <span class="cc__brand">{{ brandLabel() }}</span>
        </div>
        <p class="cc__number" [class.cc__number--empty]="!number()">{{ shownNumber() }}</p>
        <div class="cc__bottom">
          <div>
            <span class="cc__cap">Titular</span>
            <span class="cc__val cc__name">{{ holder() || 'NOME COMO NO CARTÃO' }}</span>
          </div>
          <div>
            <span class="cc__cap">Validade</span>
            <span class="cc__val">{{ expiry() || 'MM/AA' }}</span>
          </div>
        </div>
      </div>
      <div class="cc__face cc__back" aria-hidden="true">
        <span class="cc__strip"></span>
        <div class="cc__sign">
          <span class="cc__ccv">{{ shownCcv() }}</span>
        </div>
        <span class="cc__fine">Código de segurança</span>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      perspective: 1100px;
    }
    .cc {
      position: relative;
      width: 100%;
      max-width: 360px;
      aspect-ratio: 1.586;
      margin-inline: auto;
      transform-style: preserve-3d;
      transition: transform 0.7s cubic-bezier(0.3, 0.9, 0.3, 1);
    }
    .cc--flipped {
      transform: rotateY(180deg);
    }
    .cc__face {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 18px 20px;
      border-radius: 20px;
      color: #fff;
      overflow: hidden;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      background: linear-gradient(135deg, #1a1a1d 0%, #0b0b0d 55%, #2a0b0d 100%);
      box-shadow:
        0 18px 40px -18px rgba(0, 0, 0, 0.55),
        inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      transition: background 0.5s;
    }
    .cc[data-brand='visa'] .cc__face {
      background: linear-gradient(135deg, #14223f 0%, #0a1226 60%, #1b0c14 100%);
    }
    .cc[data-brand='mastercard'] .cc__face {
      background: linear-gradient(135deg, #2b1313 0%, #120a0a 60%, #1f1405 100%);
    }
    .cc[data-brand='elo'] .cc__face {
      background: linear-gradient(135deg, #0f2a22 0%, #08140f 60%, #1b0c0c 100%);
    }
    .cc[data-brand='amex'] .cc__face {
      background: linear-gradient(135deg, #123a46 0%, #081e24 60%, #170c0c 100%);
    }
    .cc__back {
      transform: rotateY(180deg);
      padding-inline: 0;
    }
    .cc__glow {
      position: absolute;
      inset: -40% -20% auto auto;
      width: 70%;
      aspect-ratio: 1;
      background: radial-gradient(circle, rgba(215, 20, 26, 0.55), transparent 65%);
      pointer-events: none;
      animation: glow 6s ease-in-out infinite alternate;
    }
    @keyframes glow {
      to {
        transform: translate(-18%, 14%) scale(1.15);
      }
    }
    .cc__top,
    .cc__bottom {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .cc__bottom {
      align-items: flex-end;
    }
    .cc__chip {
      width: 42px;
      height: 32px;
      border-radius: 7px;
      background:
        linear-gradient(90deg, transparent 31%, rgba(0, 0, 0, 0.25) 32% 34%, transparent 35% 65%, rgba(0, 0, 0, 0.25) 66% 68%, transparent 69%),
        linear-gradient(0deg, transparent 45%, rgba(0, 0, 0, 0.25) 46% 54%, transparent 55%),
        linear-gradient(135deg, #f5d98a, #c9a14a);
    }
    .cc__brand {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: 0.02em;
      font-style: italic;
      text-transform: uppercase;
    }
    .cc__number {
      position: relative;
      margin: 0;
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: clamp(1.05rem, 5.4vw, 1.4rem);
      letter-spacing: 0.06em;
      white-space: nowrap;
      text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
    }
    .cc__number--empty {
      opacity: 0.55;
    }
    .cc__cap {
      display: block;
      font-size: 9px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.6;
      margin-bottom: 2px;
    }
    .cc__val {
      display: block;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .cc__name {
      max-width: 15ch;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-transform: uppercase;
    }
    .cc__strip {
      display: block;
      height: 42px;
      margin-top: 8px;
      background: #000;
    }
    .cc__sign {
      margin: 6px 20px 0;
      padding: 8px 12px;
      border-radius: 6px;
      background: repeating-linear-gradient(135deg, #f3f3f4 0 6px, #e4e4e7 6px 12px);
      text-align: right;
    }
    .cc__ccv {
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 1rem;
      color: #111;
      letter-spacing: 0.12em;
    }
    .cc__fine {
      padding-inline: 20px;
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.55;
    }
    @media (prefers-reduced-motion: reduce) {
      .cc,
      .cc__glow {
        transition: none;
        animation: none;
      }
    }
  `,
})
export class CreditCardComponent {
  readonly number = input('');
  readonly holder = input('');
  readonly expiry = input('');
  readonly ccv = input('');
  readonly brand = input<CardBrand>('unknown');
  readonly flipped = input(false);

  protected readonly brandLabel = computed(() => (this.brand() === 'unknown' ? '' : CARD_BRAND_LABEL[this.brand()]));
  protected readonly shownNumber = computed(() => {
    const digits = this.number().replace(/\D/g, '');
    const template = this.brand() === 'amex' ? '#### ###### #####' : '#### #### #### ####';
    let i = 0;
    return template.replace(/#/g, () => (i < digits.length ? digits[i++] : '•'));
  });
  protected readonly shownCcv = computed(() => this.ccv().padEnd(this.brand() === 'amex' ? 4 : 3, '•'));
  protected readonly label = computed(() => {
    const last4 = this.number().replace(/\D/g, '').slice(-4);
    return last4.length === 4 ? `Cartão ${CARD_BRAND_LABEL[this.brand()]} final ${last4}` : 'Cartão de crédito';
  });
}
