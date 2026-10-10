import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent,
  IonInput,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../core/api/admin.service';
import { TermsService } from '../../core/api/terms.service';
import { TERM_TYPES, Term } from '../../core/models';
import { TERM_TYPE_LABEL } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { notBlank, webUrl } from '../../shared/forms/validators';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

/** Active terms and the form to publish a new version. Publishing makes every user accept it again. */
@Component({
  selector: 'app-terms-admin-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    IonContent,
    IonInput,
    IonRefresher,
    IonRefresherContent,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    HeroComponent,
    ProblemAlertComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page">
        <app-hero title="Termos" lede="Publique uma nova versão quando os termos mudarem. Cada usuário precisa aceitar de novo." />

        <app-problem-alert [error]="load.error()" />

        <section class="stack">
          <h2>Versões ativas</h2>
          @for (term of active(); track term.id) {
            <article class="card stack">
              <div class="row row--between row--wrap">
                <h3 class="grow break">{{ term.title }}</h3>
                <span class="chip chip--outline">v{{ term.version }}</span>
              </div>
              <p class="muted small">
                {{ typeLabel[term.type] }}
                @if (term.publishedAt; as published) {
                  · publicado em {{ published | utc | date: 'dd/MM/yyyy' }}
                }
              </p>
              <a class="link-btn break" [href]="term.contentUrl" target="_blank" rel="noopener noreferrer">{{ term.contentUrl }}</a>
            </article>
          } @empty {
            @if (!load.loading()) {
              <p class="notice">Nenhum termo ativo ainda.</p>
            }
          }
        </section>

        <section class="panel stack">
          <h2>Publicar nova versão</h2>
          <form class="form-grid" [formGroup]="form" (ngSubmit)="publish()" novalidate>
            <ion-select
              formControlName="type"
              label="Tipo"
              labelPlacement="stacked"
              fill="outline"
              interface="action-sheet"
              cancelText="Cancelar"
            >
              @for (type of types; track type) {
                <ion-select-option [value]="type">{{ typeLabel[type] }}</ion-select-option>
              }
            </ion-select>
            <ion-input
              formControlName="version"
              label="Versão"
              labelPlacement="stacked"
              fill="outline"
              placeholder="2.0"
              errorText="Informe a versão"
            />
            <ion-input
              formControlName="title"
              label="Título"
              labelPlacement="stacked"
              fill="outline"
              placeholder="Termos de uso"
              errorText="Informe o título"
            />
            <ion-input
              formControlName="contentUrl"
              type="url"
              inputmode="url"
              label="Endereço do documento"
              labelPlacement="stacked"
              fill="outline"
              placeholder="https://…"
              errorText="Informe um endereço http ou https válido"
            />
            <app-problem-alert [error]="publishing.error()" />
            <button class="btn btn--block" type="submit" [disabled]="publishing.loading()">
              @if (publishing.loading()) {
                <ion-spinner name="crescent" />
              }
              Publicar versão
            </button>
          </form>
        </section>
      </div>
    </ion-content>
  `,
})
export class TermsAdminPage {
  private readonly admin = inject(AdminService);
  private readonly terms = inject(TermsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly types = TERM_TYPES;
  protected readonly typeLabel = TERM_TYPE_LABEL;
  protected readonly load = createRequestState();
  protected readonly publishing = createRequestState();
  protected readonly active = signal<Term[]>([]);

  protected readonly form = this.fb.group({
    type: this.fb.control<(typeof TERM_TYPES)[number]>('TermsOfUse', Validators.required),
    version: this.fb.control('', [Validators.required, notBlank, Validators.maxLength(20)]),
    title: this.fb.control('', [Validators.required, notBlank, Validators.maxLength(200)]),
    contentUrl: this.fb.control('', [Validators.required, webUrl]),
  });

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected async publish(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const term = await this.publishing.run(() =>
      firstValueFrom(
        this.admin.publishTerm({
          type: value.type,
          version: value.version.trim(),
          title: value.title.trim(),
          contentUrl: value.contentUrl.trim(),
        }),
      ),
    );
    if (term) {
      this.form.patchValue({ version: '', title: '', contentUrl: '' });
      this.form.markAsUntouched();
      await this.toast.show('Nova versão publicada.');
      await this.reload();
    }
  }

  private async reload(): Promise<void> {
    const list = await this.load.run(() => firstValueFrom(this.terms.active()));
    if (list) {
      this.active.set(list);
    }
  }
}
