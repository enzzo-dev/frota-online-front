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
import { AuthShellComponent } from '../../shared/components/auth-shell.component';
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
    AuthShellComponent,
    ProblemAlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth.styles.scss',
  template: `
    <ion-content [fullscreen]="true">
       <app-auth-shell
        title="O motorista define o preço. Aqui o frete anda."
        lede="Entre para pedir um frete ou para carregar um."
      >

        <form class="auth__form stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (accountDeleted) {
            <div class="notice" role="status">Sua conta foi excluída. Você pode criar uma nova quando quiser.</div>
          }
          @if (sessionExpired) {
            <div class="notice" role="status">Sua sessão expirou. Entre novamente para continuar.</div>
          }

          <div class="auth__head">
            <h2>Entrar</h2>
            <p>Use o e-mail e a senha da sua conta.</p>
          </div>

          <div class="auth__fields">
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
          <a class="link-btn auth__forgot" routerLink="/auth/forgot-password">Esqueci minha senha</a>
          </div>

          <app-problem-alert [error]="request.error()" />

          <button class="btn btn--block auth__submit" type="submit" [disabled]="request.loading()">
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
      </app-auth-shell>
    </ion-content>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly sessionExpired = inject(ActivatedRoute).snapshot.queryParamMap.has('expired');
  protected readonly accountDeleted = inject(ActivatedRoute).snapshot.queryParamMap.has('deleted');
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
