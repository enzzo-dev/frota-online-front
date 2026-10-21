import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { PasswordRecoveryService } from '../../core/auth/password-recovery.service';
import { createRequestState } from '../../core/ui/request-state';
import { AuthShellComponent } from '../../shared/components/auth-shell.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { strongPassword } from '../../shared/forms/validators';

const matchingPasswords = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmation = control.get('confirmation')?.value;
  return !confirmation || password === confirmation ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-reset-password-page',
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
      <app-auth-shell title="Crie uma nova senha." lede="Use uma senha forte para proteger sua conta.">
        <form class="auth__form stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="auth__head">
            <h2>Redefinir senha</h2>
            <p>Escolha uma senha que você ainda não usa nesta conta.</p>
          </div>

          @if (!token) {
            <div class="notice notice--error" role="alert">
              Este link está incompleto. Solicite novas instruções para redefinir sua senha.
            </div>
            <a class="btn btn--block" routerLink="/auth/forgot-password">Solicitar novo link</a>
          } @else if (done()) {
            <div class="notice" role="status">Senha alterada. Entre com sua nova senha.</div>
            <a class="btn btn--block" routerLink="/auth/login">Ir para entrar</a>
          } @else {
            <div class="auth__fields">
              <ion-input
                type="password"
                formControlName="password"
                label="Nova senha"
                labelPlacement="stacked"
                fill="outline"
                autocomplete="new-password"
                helperText="8 a 128 caracteres, com maiúscula, minúscula e número"
                errorText="Use 8 a 128 caracteres com maiúscula, minúscula e número"
              >
                <ion-input-password-toggle slot="end" />
              </ion-input>
              <ion-input
                type="password"
                formControlName="confirmation"
                label="Confirme a nova senha"
                labelPlacement="stacked"
                fill="outline"
                autocomplete="new-password"
                errorText="Confirme sua nova senha"
              >
                <ion-input-password-toggle slot="end" />
              </ion-input>
            </div>
            @if (form.hasError('passwordMismatch') && form.controls.confirmation.touched) {
              <p class="notice notice--error" role="alert">As senhas não coincidem.</p>
            }

            <app-problem-alert [error]="request.error()" />
            <button class="btn btn--block auth__submit" type="submit" [disabled]="request.loading()">
              @if (request.loading()) { <ion-spinner name="crescent" /> }
              Salvar nova senha
            </button>
          }

          <p class="auth__alt"><a class="link-btn" routerLink="/auth/login">Voltar para entrar</a></p>
        </form>
      </app-auth-shell>
    </ion-content>
  `,
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly recovery = inject(PasswordRecoveryService);

  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token')?.trim() ?? '';
  protected readonly request = createRequestState();
  protected readonly done = signal(false);
  protected readonly form = this.fb.group(
    {
      password: ['', [Validators.required, strongPassword]],
      confirmation: ['', Validators.required],
    },
    { validators: matchingPasswords },
  );

  protected async submit(): Promise<void> {
    if (!this.token || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { password } = this.form.getRawValue();
    await this.request.run(() => firstValueFrom(this.recovery.resetPassword(this.token, password)));
    if (!this.request.error()) {
      this.done.set(true);
      this.form.reset();
    }
  }
}
