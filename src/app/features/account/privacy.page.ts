import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonCheckbox, IonContent, IonIcon, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { PrivacyService } from '../../core/api/privacy.service';
import { AuthService } from '../../core/auth/auth.service';
import { SessionService } from '../../core/auth/session.service';
import { ApiError } from '../../core/http/api-error';
import { AccountDeletionResponse, PersonalDataExport } from '../../core/models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { downloadJson } from '../../core/util/download';
import { homeFor } from '../../core/auth/home-routes';
import { HeroComponent } from '../../shared/components/hero.component';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

interface ExportCount {
  readonly label: string;
  readonly value: number;
}

/**
 * The person's rights under the LGPD: download everything the platform holds about them, and delete the
 * account. Deletion anonymizes the account; freight, delivery and payment history stays without identifying anyone.
 */
@Component({
  selector: 'app-privacy-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    IonCheckbox,
    IonContent,
    IonIcon,
    IonInput,
    IonInputPasswordToggle,
    IonSpinner,
    HeroComponent,
    PageBarComponent,
    ProblemAlertComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-bar title="Privacidade" [backHref]="homeUrl()" />

    <ion-content>
      <div class="page page--with-bar">
        @if (deleted(); as result) {
          <section class="stack stack--lg">
            <app-hero title="Sua conta foi excluída" lede="Seus dados pessoais foram apagados da plataforma." />

            <div class="panel stack">
              <h3>O que continua guardado</h3>
              <p class="small muted">A lei exige que esses registros fiquem, sem identificar você:</p>
              <ul class="plain-list">
                @for (item of result.retainedData; track $index) {
                  <li>{{ item }}</li>
                }
              </ul>
              <p class="small muted">Excluída em {{ result.deletedAt | utc | date: 'dd/MM/yyyy HH:mm' }}.</p>
            </div>

            <button class="btn btn--block" type="button" (click)="leave()">Ir para o início</button>
          </section>
        } @else {
          <app-hero
            title="Privacidade e seus dados"
            lede="Veja o que guardamos sobre você e peça a exclusão quando quiser. Seus direitos pela LGPD."
          />

          <section class="panel stack" aria-labelledby="export-title">
            <div class="row">
              <ion-icon name="download-outline" class="section-icon" aria-hidden="true" />
              <h2 id="export-title" class="section-title">Baixar meus dados</h2>
            </div>
            <p class="small">
              Gera um arquivo com tudo o que a plataforma guarda sobre você: conta, documentos, veículos, endereços,
              arquivos, termos aceitos, fretes, propostas e entregas.
            </p>

            <app-problem-alert [error]="exportRequest.error()" />

            <div class="form-actions">
              <button class="btn" type="button" [disabled]="exportRequest.loading()" (click)="exportData()">
                @if (exportRequest.loading()) {
                  <ion-spinner name="crescent" />
                } @else {
                  <ion-icon name="download-outline" aria-hidden="true" />
                }
                {{ exported() ? 'Baixar de novo' : 'Baixar arquivo (JSON)' }}
              </button>
            </div>

            @if (exported(); as data) {
              <div class="notice" role="status">
                <strong>Arquivo gerado em {{ data.generatedAt | utc | date: 'dd/MM/yyyy HH:mm' }}.</strong>
                <ul class="chips">
                  @for (count of counts(); track count.label) {
                    <li class="chip chip--outline">{{ count.value }} {{ count.label }}</li>
                  }
                </ul>
                <p class="small">O arquivo tem dados pessoais. Guarde em local seguro.</p>
              </div>
            }
          </section>

          <section class="stack danger" aria-labelledby="delete-title">
            <div class="row">
              <ion-icon name="trash-outline" class="section-icon" aria-hidden="true" />
              <h2 id="delete-title" class="section-title">Excluir minha conta</h2>
            </div>

            @if (isAdmin()) {
              <p class="notice">Contas de administrador só podem ser removidas por outro administrador.</p>
            } @else {
              <div class="grid-two">
                <div class="stack">
                  <h3>O que é apagado</h3>
                  <ul class="plain-list">
                    <li>Nome, e-mail, telefone e documentos (CPF/CNPJ e CNH)</li>
                    <li>Placas e endereços completos</li>
                    <li>Arquivos enviados e sessões em outros aparelhos</li>
                    <li>Fretes abertos são cancelados e propostas pendentes são encerradas</li>
                  </ul>
                </div>
                <div class="stack">
                  <h3>O que permanece, sem identificar você</h3>
                  <ul class="plain-list">
                    <li>Histórico de fretes, propostas e entregas, para auditoria e disputas</li>
                    <li>Registros de pagamento e taxas, pelo prazo da lei fiscal</li>
                    <li>O aceite dos termos (versão e data), sem o seu IP</li>
                  </ul>
                </div>
              </div>

              <p class="small">Não dá para desfazer. O e-mail fica livre para um novo cadastro.</p>

              @if (!formOpen()) {
                <div class="form-actions">
                  <button class="btn btn--danger-outline" type="button" (click)="formOpen.set(true)">
                    Quero excluir minha conta
                  </button>
                </div>
              } @else {
                <form class="stack" [formGroup]="form" (ngSubmit)="confirmDelete()" novalidate>
                  <ion-input
                    type="password"
                    formControlName="password"
                    label="Sua senha"
                    labelPlacement="stacked"
                    fill="outline"
                    autocomplete="current-password"
                    helperText="Pedimos a senha para ter certeza de que é você."
                    errorText="Informe sua senha"
                  >
                    <ion-input-password-toggle slot="end" />
                  </ion-input>

                  <ion-checkbox formControlName="confirm" labelPlacement="end" justify="start">
                    Entendo que a exclusão é definitiva.
                  </ion-checkbox>

                  <app-problem-alert [error]="deleteError()">
                    @if (deleteRequest.error()?.code === 'privacy.active_deliveries') {
                      <p><a class="link-btn" [routerLink]="activeWorkUrl()">Ver minhas entregas</a></p>
                    }
                  </app-problem-alert>

                  <div class="form-actions">
                    <button class="btn btn--danger" type="submit" [disabled]="deleteRequest.loading() || !form.controls.confirm.value">
                      @if (deleteRequest.loading()) {
                        <ion-spinner name="crescent" />
                      }
                      Excluir conta definitivamente
                    </button>
                    <button class="btn btn--ghost" type="button" [disabled]="deleteRequest.loading()" (click)="cancelDelete()">
                      Cancelar
                    </button>
                  </div>
                </form>
              }
            }
          </section>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .section-title {
      font-size: 20px;
    }

    .section-icon {
      font-size: 24px;
      color: var(--red);
    }

    .plain-list {
      margin: 0;
      padding-left: 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
    }

    .chips {
      list-style: none;
      margin: 10px 0 8px;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .danger {
      border: 1.5px solid var(--red);
      border-radius: var(--r-md);
      padding: 18px;
    }

    .grid-two {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }

    @media (min-width: 720px) {
      .grid-two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 28px;
      }
    }
  `,
})
export class PrivacyPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly privacy = inject(PrivacyService);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly exportRequest = createRequestState();
  protected readonly deleteRequest = createRequestState();

  protected readonly exported = signal<PersonalDataExport | null>(null);
  protected readonly deleted = signal<AccountDeletionResponse | null>(null);
  protected readonly formOpen = signal(false);

  protected readonly isAdmin = computed(() => this.session.role() === 'Admin');
  protected readonly homeUrl = computed(() => homeFor(this.session.role()));
  protected readonly activeWorkUrl = computed(() =>
    this.session.role() === 'Driver' ? '/driver/deliveries' : '/customer/freights',
  );

  protected readonly form = this.fb.group({
    password: ['', [Validators.required]],
    confirm: [false],
  });

  protected readonly counts = computed<ExportCount[]>(() => {
    const data = this.exported();
    if (!data) {
      return [];
    }
    return [
      { label: 'endereços', value: data.addresses.length },
      { label: 'veículos', value: data.vehicles.length },
      { label: 'arquivos', value: data.files.length },
      { label: 'termos aceitos', value: data.consents.length },
      { label: 'fretes', value: data.freights.length },
      { label: 'propostas', value: data.proposals.length },
      { label: 'entregas', value: data.deliveries.length },
    ].filter((count) => count.value > 0);
  });

  /** A wrong password comes back as "e-mail ou senha incorretos", which would confuse on this screen. */
  protected readonly deleteError = computed<ApiError | null>(() => {
    const error = this.deleteRequest.error();
    return error?.code === 'auth.invalid_credentials'
      ? new ApiError(error.status, error.code, 'Senha incorreta. Tente de novo.')
      : error;
  });

  protected async exportData(): Promise<void> {
    const data = await this.exportRequest.run(() => firstValueFrom(this.privacy.exportData()));
    if (!data) {
      return;
    }
    this.exported.set(data);
    const day = data.generatedAt.slice(0, 10);
    downloadJson(`frota-online-meus-dados-${day}.json`, data);
    await this.toast.show('Arquivo gerado. Confira seus downloads.');
  }

  protected cancelDelete(): void {
    this.formOpen.set(false);
    this.form.reset({ password: '', confirm: false });
    this.deleteRequest.clearError();
  }

  protected async confirmDelete(): Promise<void> {
    if (this.form.invalid || !this.form.controls.confirm.value) {
      this.form.markAllAsTouched();
      return;
    }
    const sure = await this.confirm.confirm({
      header: 'Excluir a conta para sempre?',
      message: 'Seus dados pessoais serão apagados e você sairá do app. Isso não pode ser desfeito.',
      confirmText: 'Excluir',
      cancelText: 'Voltar',
      destructive: true,
    });
    if (!sure) {
      return;
    }
    const { password } = this.form.getRawValue();
    const result = await this.deleteRequest.run(() =>
      firstValueFrom(this.privacy.deleteAccount({ password, confirm: true })),
    );
    if (result) {
      // The server already deleted the sessions; drop the tokens here so they are not used again.
      this.auth.discardSession();
      this.form.reset({ password: '', confirm: false });
      this.deleted.set(result);
    }
  }

  protected leave(): void {
    void this.router.navigate(['/auth/login'], { queryParams: { deleted: 1 }, replaceUrl: true });
  }
}
