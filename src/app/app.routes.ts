import { Routes } from '@angular/router';
import { authGuard, guestGuard, homeRedirectGuard, roleGuard } from './core/auth/guards';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'terms',
    canActivate: [authGuard],
    loadComponent: () => import('./features/terms/terms.page').then((m) => m.TermsPage),
  },
  {
    path: 'privacy',
    canActivate: [authGuard],
    loadComponent: () => import('./features/account/privacy.page').then((m) => m.PrivacyPage),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () => import('./features/notifications/notifications.page').then((m) => m.NotificationsPage),
  },
  {
    path: 'driver',
    canActivate: [roleGuard('Driver')],
    loadChildren: () => import('./features/driver/driver.routes').then((m) => m.DRIVER_ROUTES),
  },
  {
    path: 'customer',
    canActivate: [roleGuard('Customer')],
    loadChildren: () => import('./features/customer/customer.routes').then((m) => m.CUSTOMER_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [roleGuard('Admin')],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },
  { path: '**', redirectTo: '' },
];
