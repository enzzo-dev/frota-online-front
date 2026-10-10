import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { TermsService } from '../../core/api/terms.service';
import { AuthService } from '../../core/auth/auth.service';
import { RegisterRequest, Term } from '../../core/models';
import { TERM_TYPE_LABEL } from '../../core/ui/labels';
import { createRequestState } from '../../core/ui/request-state';
import { normalizePhone } from '../../core/util/normalizers';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { notBlank, phone, strongPassword } from '../../shared/forms/validators';

type SignUpRole = RegisterRequest['role'];

@Component({
  selector: 'app-register-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    HeroComponent,
    ProblemAlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth.styles.scss',
  template: `
    <ion-content [fullscreen]="true">
      <div class="page auth">
        <app-hero
          [brand]="true"
          title="Crie sua conta em um minuto."
          lede="Cliente pede o frete. Motorista carrega e escolhe o próprio preço."
        />

        <form class="stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="stack">
            <strong class="small">Eu quero</strong>
            <ion-segment [value]="role()" (ionChange)="onRoleChange($event.detail.value)">
              <ion-segment-button value="Customer">Pedir fretes</ion-segment-button>
              <ion-segment-button value="Driver">Carregar fretes</ion-segment-button>
            </ion-segment>
          </div>

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

          <button class="btn btn--block" type="submit" [disabled]="request.loading()">
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
      </div>
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
