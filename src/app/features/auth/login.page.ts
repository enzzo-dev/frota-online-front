import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonSpinner,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { createRequestState } from '../../core/ui/request-state';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { notBlank } from '../../shared/forms/validators';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
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
          title="O motorista define o preço. Aqui o frete anda."
          lede="Entre para pedir um frete ou para carregar um."
        />

        <form class="stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (sessionExpired) {
            <div class="notice" role="status">Sua sessão expirou. Entre novamente para continuar.</div>
          }

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
            type="password"
            formControlName="password"
            label="Senha"
            labelPlacement="stacked"
            fill="outline"
            autocomplete="current-password"
            enterkeyhint="go"
            errorText="Informe sua senha"
          >
            <ion-input-password-toggle slot="end" />
          </ion-input>

          <app-problem-alert [error]="request.error()" />

          <button class="btn btn--block" type="submit" [disabled]="request.loading()">
            @if (request.loading()) {
              <ion-spinner name="crescent" />
            }
            Entrar
          </button>

          <p class="auth__alt">
            Ainda não tem conta?
            <a class="link-btn" routerLink="/auth/register">Criar conta</a>
          </p>
        </form>
      </div>
    </ion-content>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly sessionExpired = inject(ActivatedRoute).snapshot.queryParamMap.has('expired');
  protected readonly request = createRequestState();

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [notBlank]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    const response = await this.request.run(() =>
      firstValueFrom(this.auth.login({ email: email.trim(), password })),
    );
    if (response) {
      await this.router.navigateByUrl(this.auth.landingUrlFor(response.user.role), {
        replaceUrl: true,
      });
    }
  }
}
