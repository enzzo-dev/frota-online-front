import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonSpinner,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { TermsService } from '../../core/api/terms.service';
import { AuthService } from '../../core/auth/auth.service';
import { RegisterRequest, Term } from '../../core/models';
import { TERM_TYPE_LABEL } from '../../core/ui/labels';
import { createRequestState } from '../../core/ui/request-state';
import { normalizePhone } from '../../core/util/normalizers';
import { AuthShellComponent } from '../../shared/components/auth-shell.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { notBlank, phone, strongPassword } from '../../shared/forms/validators';

type SignUpRole = RegisterRequest['role'];

@Component({
  selector: 'app-register-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonIcon,
    IonInput,
    IonInputPasswordToggle,
    IonSpinner,
    AuthShellComponent,
    ProblemAlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth.styles.scss',
  template: `
    <ion-content [fullscreen]="true">
       <app-auth-shell
        title="Crie sua conta em um minuto."
        lede="Cliente pede o frete. Motorista carrega e escolhe o próprio preço."
      >

        <form class="auth__form stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="auth__head">
            <h2>Criar conta</h2>
            <p>Escolha como você vai usar o Frota Online.</p>
          </div>

          <div class="auth__role" role="group" aria-label="Eu quero">
            <button type="button" [attr.aria-pressed]="role() === 'Customer'" (click)="onRoleChange('Customer')">
              <ion-icon name="cube-outline" aria-hidden="true" />
              <strong>Pedir fretes</strong>
              <span>Sou cliente e preciso enviar carga</span>
            </button>
            <button type="button" [attr.aria-pressed]="role() === 'Driver'" (click)="onRoleChange('Driver')">
              <ion-icon name="navigate-outline" aria-hidden="true" />
              <strong>Carregar fretes</strong>
              <span>Sou motorista e defino meu preço</span>
            </button>
          </div>

          <div class="auth__fields">
          <ion-input
            formControlName="fullName"
            label="Nome completo"
            labelPlacement="stacked"
            fill="outline"
            autocomplete="name"
            enterkeyhint="next"
            errorText="Informe seu nome"
          />
          <ion-input
            type="email"
            formControlName="email"
            label="E-mail"
            labelPlacement="stacked"
            fill="outline"
            autocomplete="email"
            inputmode="email"
            enterkeyhint="next"
            errorText="Informe um e-mail válido"
          />
          <ion-input
            type="tel"
            formControlName="phoneNumber"
            label="Celular com DDD"
            labelPlacement="stacked"
            fill="outline"
            autocomplete="tel"
            inputmode="tel"
            placeholder="(11) 99999-9999"
            enterkeyhint="next"
            errorText="Informe DDD e número"
          />
          <ion-input
            type="password"
            formControlName="password"
            label="Senha"
            labelPlacement="stacked"
            fill="outline"
            autocomplete="new-password"
            enterkeyhint="go"
            helperText="8 a 128 caracteres, com maiúscula, minúscula e número"
            errorText="Use 8 a 128 caracteres com maiúscula, minúscula e número"
          >
            <ion-input-password-toggle slot="end" />
          </ion-input>
          </div>

          @if (terms().length > 0) {
            <div class="notice auth__terms">
              Depois de criar a conta você vai ler e aceitar:
              <ul>
                @for (term of terms(); track term.id) {
                  <li>
                    <a [href]="term.contentUrl" target="_blank" rel="noopener noreferrer">
                      {{ termLabel[term.type] }} (v{{ term.version }})
                    </a>
                  </li>
                }
              </ul>
            </div>
          }

          <app-problem-alert [error]="request.error()" />

          <button class="btn btn--block auth__submit" type="submit" [disabled]="request.loading()">
            @if (request.loading()) {
              <ion-spinner name="crescent" />
            }
            Criar conta
          </button>

          <p class="auth__alt">
            Já tem conta?
            <a class="link-btn" routerLink="/auth/login">Entrar</a>
          </p>
        </form>
      </app-auth-shell>
    </ion-content>
  `,
})
export class RegisterPage implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly termsApi = inject(TermsService);
  private readonly router = inject(Router);

  protected readonly request = createRequestState();
  protected readonly termLabel = TERM_TYPE_LABEL;
  protected readonly role = signal<SignUpRole>('Customer');
  protected readonly terms = signal<Term[]>([]);

  protected readonly form = this.fb.group({
    fullName: ['', [notBlank, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required, phone]],
    password: ['', [Validators.required, strongPassword]],
  });

  ngOnInit(): void {
    // Show the texts before the account exists. Not essential, so a failure is ignored.
    firstValueFrom(this.termsApi.active())
      .then((terms) => this.terms.set(terms))
      .catch(() => undefined);
  }

  protected onRoleChange(value: string | number | null | undefined): void {
    if (value === 'Customer' || value === 'Driver') {
      this.role.set(value);
    }
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { fullName, email, phoneNumber, password } = this.form.getRawValue();
    const response = await this.request.run(() =>
      firstValueFrom(
        this.auth.register({
          fullName: fullName.trim(),
          email: email.trim(),
          phoneNumber: normalizePhone(phoneNumber),
          password,
          role: this.role(),
        }),
      ),
    );
    if (response) {
      await this.router.navigateByUrl(this.auth.landingUrlFor(response.user.role), {
        replaceUrl: true,
      });
    }
  }
}
