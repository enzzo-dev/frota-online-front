import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('./login.page').then((m) => m.LoginPage) },
  { path: 'register', loadComponent: () => import('./register.page').then((m) => m.RegisterPage) },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
];
