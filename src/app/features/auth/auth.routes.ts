import { Routes } from '@angular/router';
import { guestGuard } from '../../core/auth/guards';

export const AUTH_ROUTES: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./login.page').then((m) => m.LoginPage) },
  { path: 'register', canActivate: [guestGuard], loadComponent: () => import('./register.page').then((m) => m.RegisterPage) },
  { path: 'forgot-password', loadComponent: () => import('./forgot-password.page').then((m) => m.ForgotPasswordPage) },
  { path: 'reset-password', loadComponent: () => import('./reset-password.page').then((m) => m.ResetPasswordPage) },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
];
