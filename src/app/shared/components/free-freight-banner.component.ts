import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FreeFreightService } from '../../core/api/free-freight.service';

/**
 * Tells the driver where they stand with the free freight, in the same slip style as the proposal sheet: a `0/1` or `1/1`
 * counter and plain sentences. Nothing is shown to a subscriber or while the state is unknown. `compact` is one line.
 */
@Component({
  selector: 'app-free-freight-banner',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .ff {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 14px;
      row-gap: 10px;
      padding: 16px;
      border: 1.5px solid var(--black);
      border-radius: 16px;
      background: var(--white);
    }
    .ff--used {
      border-color: var(--red);
    }
    .count {
      align-self: start;
      font: 700 15px/1 var(--font-mono);
      padding: 8px 9px;
      border-radius: 8px;
      border: 1.5px solid var(--black);
      color: var(--black);
    }
    .ff--used .count {
      border-color: var(--red);
      background: var(--red);
      color: #fff;
    }
    .ff--used .cap {
      color: var(--red);
    }
    .title {
      margin: 0;
      font: 700 1.05rem/1.25 var(--font-display);
      letter-spacing: -0.01em;
    }
    .lede {
      margin: 4px 0 0;
      font-size: 14px;
      color: var(--ink-soft);
    }
    .terms {
      grid-column: 1 / -1;
      margin: 0;
      padding: 10px 0 0;
      border-top: 1.5px dashed var(--line);
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 6px 10px;
      font-size: 13px;
      color: var(--ink-soft);
    }
    .terms dt {
      font: 600 11px/1.6 var(--font-mono);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--black);
    }
    .terms dd {
      margin: 0;
    }
    .go {
      grid-column: 1 / -1;
      justify-self: start;
      font-weight: 700;
      font-size: 14px;
      color: var(--black);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .ff--used .go {
      color: var(--red-deep);
    }
    .ff--compact {
      align-items: center;
      padding: 12px 14px;
    }
    .ff--compact .count {
      align-self: center;
      font-size: 13px;
      padding: 6px 7px;
    }
    .ff--compact p {
      margin: 0;
      font-size: 14px;
    }
    .ff--compact .go {
      grid-column: auto;
      font-size: 14px;
    }
  `,
  template: `
    @switch (state()) {
      @case ('available') {
        @if (compact()) {
          <section class="ff ff--compact" aria-label="Frete grátis">
            <span class="count">0/1</span>
            <p><strong>Frete grátis disponível.</strong> Depois dele, propostas só com assinatura.</p>
          </section>
        } @else {
          <section class="ff" aria-label="Frete grátis">
            <span class="count">0/1</span>
            <div>
              <span class="cap">Sem plano</span>
              <p class="title">Seu primeiro frete é grátis</p>
              <p class="lede">Depois dele, você só envia propostas com assinatura.</p>
            </div>
            <dl class="terms">
              <dt>Aprovação</dt>
              <dd>Pode propor em vários fretes, mas só o primeiro que o cliente aprovar usa o grátis. Os outros são recusados.</dd>
              <dt>Cancelou</dt>
              <dd>Se esse frete for cancelado, o grátis volta.</dd>
            </dl>
            @if (!hideAction()) {
              <a class="go" routerLink="/driver/billing">Ver planos</a>
            }
          </section>
        }
      }
      @case ('used') {
        @if (compact()) {
          <section class="ff ff--used ff--compact" role="alert" aria-label="Frete grátis usado">
            <span class="count">1/1</span>
            <p>
              <strong>Frete grátis usado.</strong> Assine para propor de novo.
              @if (!hideAction()) {
                <a class="go" routerLink="/driver/billing">Ver planos</a>
              }
            </p>
          </section>
        } @else {
          <section class="ff ff--used" role="alert" aria-label="Frete grátis usado">
            <span class="count">1/1</span>
            <div>
              <span class="cap">Sem plano</span>
              <p class="title">Seu frete grátis já foi usado</p>
              <p class="lede">Para enviar novas propostas, assine um plano.</p>
            </div>
            <dl class="terms">
              <dt>Abertas</dt>
              <dd>Propostas que você já enviou só podem ser aprovadas se você assinar antes.</dd>
              <dt>Cancelou</dt>
              <dd>Se o frete grátis for cancelado, você volta a ter direito a ele.</dd>
            </dl>
            @if (!hideAction()) {
              <a class="go" routerLink="/driver/billing">Assinar um plano</a>
            }
          </section>
        }
      }
    }
  `,
})
export class FreeFreightBannerComponent {
  private readonly freeFreight = inject(FreeFreightService);
  readonly compact = input(false);
  /** Hide the link to the plans (for the plans screen itself). */
  readonly hideAction = input(false);
  protected readonly state = this.freeFreight.state;
}
