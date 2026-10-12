import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { FreeFreightService } from '../../core/api/free-freight.service';

/**
 * Tells the driver where they stand with the free freight. Nothing is shown to a subscriber or while the state is
 * unknown. `compact` is a single line for screens where the full explanation would be noise.
 */
@Component({
  selector: 'app-free-freight-banner',
  imports: [IonIcon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .ff {
      display: flex;
      gap: 14px;
      padding: 16px;
      border-radius: var(--r-md);
      background: linear-gradient(180deg, #fff, #fff7f7);
      border: 1.5px solid #f1c5c7;
    }
    .ff--used {
      background: #fff3f3;
      border-color: var(--red);
    }
    .ff__icon {
      flex: none;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      color: #fff;
      background: var(--red);
      font-size: 22px;
    }
    .ff--used .ff__icon {
      background: var(--red-deep);
    }
    .ff__body {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ff__title {
      margin: 0;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: -0.01em;
    }
    .ff__list {
      margin: 0;
      padding-left: 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
      color: #2b2b30;
    }
    .ff__list strong {
      color: var(--red-deep);
    }
    .ff__cta {
      align-self: flex-start;
    }
    .ff--compact {
      align-items: center;
      padding: 12px 14px;
    }
    .ff--compact .ff__icon {
      width: 36px;
      height: 36px;
      font-size: 18px;
      border-radius: 12px;
    }
    .ff--compact p {
      margin: 0;
      font-size: 14px;
    }
  `,
  template: `
    @switch (state()) {
      @case ('available') {
        <section class="ff" [class.ff--compact]="compact()" aria-label="Frete grátis">
          <span class="ff__icon"><ion-icon name="gift-outline" aria-hidden="true" /></span>
          <div class="ff__body">
            @if (compact()) {
              <p><strong>Você tem 1 frete grátis.</strong> Depois dele, só com assinatura.</p>
            } @else {
              <h2 class="ff__title">Você tem 1 frete grátis</h2>
              <ul class="ff__list">
                <li>Sem assinatura, você pode pegar <strong>um único frete</strong>. Depois dele, só envia propostas com um plano.</li>
                <li>
                  Pode enviar várias propostas agora, mas <strong>só a primeira que o cliente aprovar</strong> leva o frete grátis.
                  As outras serão recusadas.
                </li>
                <li>Se esse frete for cancelado, o frete grátis volta.</li>
              </ul>
              @if (!hideAction()) {
                <a class="btn btn--ghost btn--sm ff__cta" routerLink="/driver/billing">Ver planos</a>
              }
            }
          </div>
        </section>
      }
      @case ('used') {
        <section class="ff ff--used" [class.ff--compact]="compact()" role="alert" aria-label="Frete grátis usado">
          <span class="ff__icon"><ion-icon name="warning-outline" aria-hidden="true" /></span>
          <div class="ff__body">
            @if (compact()) {
              <p>
                <strong>Seu frete grátis já foi usado.</strong> Para propor de novo, assine um plano.
                <a class="link-btn" routerLink="/driver/billing">Ver planos</a>
              </p>
            } @else {
              <h2 class="ff__title">Seu frete grátis já foi usado</h2>
              <ul class="ff__list">
                <li><strong>Sem assinatura, você não consegue enviar novas propostas.</strong></li>
                <li>Propostas que você já enviou só podem ser aprovadas pelo cliente se você assinar antes.</li>
                <li>Se o frete grátis for cancelado, você volta a ter direito a ele.</li>
              </ul>
              @if (!hideAction()) {
                <a class="btn btn--sm ff__cta" routerLink="/driver/billing">Assinar um plano</a>
              }
            }
          </div>
        </section>
      }
    }
  `,
})
export class FreeFreightBannerComponent {
  private readonly freeFreight = inject(FreeFreightService);
  readonly compact = input(false);
  /** Hide the button that goes to the plans (for the plans screen itself). */
  readonly hideAction = input(false);
  protected readonly state = this.freeFreight.state;
}
