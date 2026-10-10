import { Routes } from '@angular/router';
import type { TabItem } from '../shell/tabs-shell.component';

const ADMIN_TABS: readonly TabItem[] = [
  { tab: 'drivers', label: 'Motoristas', icon: 'id-card-outline' },
  { tab: 'terms', label: 'Termos', icon: 'document-text-outline' },
  { tab: 'account', label: 'Conta', icon: 'person-circle-outline' },
];

export const ADMIN_ROUTES: Routes = [
  {
    path: 'drivers/:id',
    loadComponent: () => import('./driver-review.page').then((m) => m.DriverReviewPage),
  },
  {
    path: '',
    loadComponent: () => import('../shell/tabs-shell.component').then((m) => m.TabsShellComponent),
    data: { tabs: ADMIN_TABS },
    children: [
      {
        path: 'drivers',
        loadComponent: () => import('./drivers.page').then((m) => m.AdminDriversPage),
      },
      {
        path: 'terms',
        loadComponent: () => import('./terms-admin.page').then((m) => m.TermsAdminPage),
      },
      {
        path: 'account',
        loadComponent: () => import('../account/account.page').then((m) => m.AccountPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'drivers' },
    ],
  },
];
