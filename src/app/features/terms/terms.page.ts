import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonCheckbox, IonContent, IonSpinner } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { TermsService } from '../../core/api/terms.service';
import { AuthService } from '../../core/auth/auth.service';
import { homeFor } from '../../core/auth/home-routes';
import { SessionService } from '../../core/auth/session.service';
import { Term } from '../../core/models';
import { TERM_TYPE_LABEL } from '../../core/ui/labels';
import { createRequestState } from '../../core/ui/request-state';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';
import { DatePipe } from '@angular/common';

/**
 * Step after sign-in: lists the active terms the user has not accepted and records each acceptance.
 * With nothing pending it forwards the user to their home.
 */
@Component({
  selector: 'app-terms-page',
  imports: [IonContent, IonCheckbox, IonSpinner, HeroComponent, ProblemAlertComponent, UtcPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content [fullscreen]="true">
      <div class="page">
        <app-hero
          [brand]="true"
          title="Antes de começar, leia e aceite os termos."
          lede="Guardamos a data e o IP do aceite. Sem isso não dá para publicar fretes nem enviar o cadastro."
        />

        <app-problem-alert [error]="load.error()">
          <button class="btn btn--sm btn--ghost" type="button" (click)="refresh()">Tentar de novo</button>
        </app-problem-alert>

        @if (load.loading() && terms().length === 0) {
          <div class="skeleton"></div>
        }

        <div class="stack">
          @for (term of terms(); track term.id) {
            <article class="panel stack">
              <div class="row row--between row--wrap">
                <h3>{{ termLabel[term.type] }}</h3>
                <span class="chip chip--outline">v{{ term.version }}</span>
              </div>
              <p class="muted small">
                {{ term.title }}
                @if (term.publishedAt) {
                  · publicado em {{ term.publishedAt | utc | date: 'dd/MM/yyyy' }}
                }
              </p>
              <a class="link-btn" [href]="term.contentUrl" target="_blank" rel="noopener noreferrer">
                Ler o texto completo
              </a>
              <ion-checkbox
                labelPlacement="end"
                justify="start"
                [checked]="isChecked(term.id)"
                (ionChange)="toggle(term.id, $event.detail.checked)"
              >
                Li e aceito
              </ion-checkbox>
            </article>
          }
        </div>

        @if (terms().length > 0) {
          <app-problem-alert [error]="accept.error()" />
          <div class="form-actions">
            <button class="btn" type="button" [disabled]="!allChecked() || accept.loading()" (click)="acceptAll()">
              @if (accept.loading()) {
                <ion-spinner name="crescent" />
              }
              Aceitar e continuar
            </button>
            <button class="btn btn--ghost" type="button" (click)="signOut()">Sair</button>
          </div>
        }
      </div>
    </ion-content>
  `,
})
export class TermsPage {
  private readonly termsApi = inject(TermsService);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly termLabel = TERM_TYPE_LABEL;
  protected readonly load = createRequestState();
  protected readonly accept = createRequestState();
  protected readonly terms = signal<Term[]>([]);
  private readonly checked = signal<ReadonlySet<string>>(new Set());

  protected readonly allChecked = computed(
    () => this.terms().length > 0 && this.terms().every((term) => this.checked().has(term.id)),
  );

  ionViewWillEnter(): void {
    void this.refresh();
  }

  protected isChecked(id: string): boolean {
    return this.checked().has(id);
  }

  protected toggle(id: string, value: boolean): void {
    const next = new Set(this.checked());
    if (value) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.checked.set(next);
  }

  protected async refresh(): Promise<void> {
    const pending = await this.load.run(() => firstValueFrom(this.termsApi.pending()));
    if (pending === undefined) {
      return;
    }
    if (pending.length === 0) {
      await this.goHome();
      return;
    }
    this.terms.set(pending);
  }

  protected async acceptAll(): Promise<void> {
    const done = await this.accept.run(async () => {
      // One call per term, in order. Accepting twice returns the first acceptance, so a retry is safe.
      for (const term of this.terms()) {
        await firstValueFrom(this.termsApi.accept(term.id));
      }
      return true;
    });
    if (done) {
      await this.goHome();
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.logout();
  }

  private goHome(): Promise<boolean> {
    return this.router.navigateByUrl(homeFor(this.session.role()), { replaceUrl: true });
  }
}
