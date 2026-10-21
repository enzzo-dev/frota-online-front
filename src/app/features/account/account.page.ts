import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSpinner } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { TermsService } from '../../core/api/terms.service';
import { AuthService } from '../../core/auth/auth.service';
import { SessionService } from '../../core/auth/session.service';
import { Consent, Term } from '../../core/models';
import { TERM_TYPE_LABEL, USER_ROLE_LABEL } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

/** The signed-in user, the terms they accepted and the sign-out button. Shared by every role. */
@Component({
  selector: 'app-account-page',
  imports: [
    RouterLink,
    DatePipe,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    HeroComponent,
    ProblemAlertComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .terms {
      padding: 0;
    }
    .terms__toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      padding: 16px;
      border: 0;
      background: none;
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .terms__count {
      display: block;
    }
    .terms__chevron {
      flex: none;
      font-size: 20px;
      transition: transform 0.2s ease;
    }
    .terms__chevron--open {
      transform: rotate(180deg);
    }
    .terms__body {
      padding: 0 16px 16px;
      border-top: 1.5px dashed var(--line);
      padding-top: 14px;
    }
    .terms__item + .terms__item {
      padding-top: 12px;
      border-top: 1px solid var(--line);
    }
  `,
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page">
        <app-hero [title]="user()?.fullName ?? 'Minha conta'" [lede]="user()?.email ?? ''">
          <span class="chip chip--outline">{{ roleLabel() }}</span>
        </app-hero>

        @if (pending().length > 0) {
          <div class="notice notice--error" role="status">
            <strong>Você tem termos para aceitar.</strong>
            <p class="small">Há {{ pending().length }} {{ pending().length === 1 ? 'texto novo' : 'textos novos' }} aguardando seu aceite.</p>
            <a class="btn btn--sm btn--dark" routerLink="/terms" style="margin-top: 10px">Ver termos</a>
          </div>
        }

        <section class="card terms">
          <button
            class="terms__toggle"
            type="button"
            [attr.aria-expanded]="termsOpen()"
            aria-controls="accepted-terms"
            (click)="toggleTerms()"
          >
            <span class="row">
              <ion-icon name="document-text-outline" aria-hidden="true" />
              <span>
                <strong class="strong">Termos aceitos</strong>
                <span class="muted small terms__count">{{ termsSummary() }}</span>
              </span>
            </span>
            <ion-icon class="terms__chevron" [class.terms__chevron--open]="termsOpen()" name="chevron-down-outline" aria-hidden="true" />
          </button>

          @if (termsOpen()) {
            <div id="accepted-terms" class="stack terms__body">
              <app-problem-alert [error]="request.error()" />
              @if (request.loading() && consents().length === 0) {
                <div class="skeleton"></div>
              }
              @for (consent of consents(); track consent.termDocumentId) {
                <div class="row row--between terms__item">
                  <div class="grow">
                    <p class="strong">{{ termLabel[consent.type] }}</p>
                    <p class="muted small">Aceito em {{ consent.acceptedAt | utc | date: 'dd/MM/yyyy HH:mm' }}</p>
                  </div>
                  <span class="chip chip--outline">v{{ consent.version }}</span>
                </div>
              } @empty {
                @if (!request.loading()) {
                  <p class="muted">Nenhum termo aceito ainda.</p>
                }
              }
              <a class="link-btn" routerLink="/terms">Ler os termos</a>
            </div>
          }
        </section>

        <a class="card card--link row row--between" routerLink="/notifications">
          <span class="row">
            <ion-icon name="notifications-outline" aria-hidden="true" />
            <span>
              <strong class="strong">Avisos</strong>
              <span class="muted small" style="display: block">Caixa de entrada e preferências de aviso</span>
            </span>
          </span>
        </a>

        @if (isDriver()) {
          <a class="card card--link row row--between" routerLink="/driver/billing">
            <span class="row">
              <ion-icon name="ribbon-outline" aria-hidden="true" />
              <span>
                <strong class="strong">Assinatura e recebimento</strong>
                <span class="muted small" style="display: block">Plano mensal e conta que recebe o Pix</span>
              </span>
            </span>
          </a>
        }

        <a class="card card--link row row--between" routerLink="/privacy">
          <span class="row">
            <ion-icon name="shield-checkmark-outline" aria-hidden="true" />
            <span>
              <strong class="strong">Privacidade e meus dados</strong>
              <span class="muted small" style="display: block">Baixar meus dados ou excluir a conta</span>
            </span>
          </span>
        </a>

        <button class="btn btn--ghost btn--block" type="button" [disabled]="signingOut()" (click)="signOut()">
          @if (signingOut()) {
            <ion-spinner name="crescent" />
          } @else {
            <ion-icon name="log-out-outline" aria-hidden="true" />
          }
          Sair da conta
        </button>
      </div>
    </ion-content>
  `,
})
export class AccountPage {
  private readonly session = inject(SessionService);
  private readonly auth = inject(AuthService);
  private readonly terms = inject(TermsService);

  protected readonly termLabel = TERM_TYPE_LABEL;
  protected readonly user = this.session.user;
  protected readonly request = createRequestState();
  protected readonly consents = signal<Consent[]>([]);
  protected readonly pending = signal<Term[]>([]);
  protected readonly signingOut = signal(false);
  protected readonly termsOpen = signal(false);
  protected readonly termsSummary = computed(() => {
    const total = this.consents().length;
    if (this.request.loading() && total === 0) {
      return 'Carregando...';
    }
    return total === 1 ? '1 termo aceito' : `${total} termos aceitos`;
  });
  protected readonly isDriver = computed(() => this.session.role() === 'Driver');

  protected roleLabel(): string {
    const role = this.session.role();
    return role ? USER_ROLE_LABEL[role] : '';
  }

  ionViewWillEnter(): void {
    void this.load();
  }

  protected toggleTerms(): void {
    this.termsOpen.update((open) => !open);
  }

  protected async refresh(event: Event): Promise<void> {
    await this.load();
    completeRefresh(event);
  }

  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.auth.logout();
    } finally {
      this.signingOut.set(false);
    }
  }

  private async load(): Promise<void> {
    const result = await this.request.run(async () => ({
      consents: await firstValueFrom(this.terms.consents()),
      pending: await firstValueFrom(this.terms.pending()),
    }));
    if (result) {
      this.consents.set(
        [...result.consents].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt)),
      );
      this.pending.set(result.pending);
    }
  }
}
