import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonInput, IonSpinner } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { PasswordRecoveryService } from '../../core/auth/password-recovery.service';
import { createRequestState } from '../../core/ui/request-state';
import { AuthShellComponent } from '../../shared/components/auth-shell.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, IonContent, IonInput, IonSpinner, AuthShellComponent, ProblemAlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth.styles.scss',
  template: `
    <ion-content [fullscreen]="true">
      <app-auth-shell title="Vamos recuperar seu acesso." lede="Enviaremos as instruções para o e-mail da sua conta.">
        <form class="auth__form stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="auth__head">
            <h2>Esqueci minha senha</h2>
            <p>Informe o e-mail usado no Frota Online.</p>
          </div>

          @if (sent()) {
            <div class="notice" role="status">
              Se houver uma conta com esse e-mail, você receberá instruções para criar uma nova senha.
            </div>
          } @else {
            <div class="auth__fields">
              <ion-input
                type="email"
                formControlName="email"
                label="E-mail"
                labelPlacement="stacked"
                fill="outline"
                autocomplete="email"
                inputmode="email"
                errorText="Informe um e-mail válido"
              />
            </div>
            <app-problem-alert [error]="request.error()" />
            <button class="btn btn--block auth__submit" type="submit" [disabled]="request.loading()">
              @if (request.loading()) { <ion-spinner name="crescent" /> }
              Enviar instruções
            </button>
          }

          <p class="auth__alt"><a class="link-btn" routerLink="/auth/login">Voltar para entrar</a></p>
        </form>
      </app-auth-shell>
    </ion-content>
  `,
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly recovery = inject(PasswordRecoveryService);

  protected readonly request = createRequestState();
  protected readonly sent = signal(false);
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const email = this.form.controls.email.value.trim();
    await this.request.run(() => firstValueFrom(this.recovery.requestReset(email)));
    // A successful void response is also represented as undefined by request state.
    if (!this.request.error()) {
      this.sent.set(true);
    }
  }
}
