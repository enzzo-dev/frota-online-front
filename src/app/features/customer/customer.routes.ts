import { Routes } from '@angular/router';
import type { TabItem } from '../shell/tabs-shell.component';

const CUSTOMER_TABS: readonly TabItem[] = [
  { tab: 'freights', label: 'Fretes', icon: 'cube-outline' },
  { tab: 'addresses', label: 'Endereços', icon: 'location-outline' },
  { tab: 'account', label: 'Conta', icon: 'person-circle-outline' },
];

export const CUSTOMER_ROUTES: Routes = [
  // Pushed over the tabs. `freights/new` must come before `freights/:id`.
  {
    path: 'freights/new',
    loadComponent: () => import('./new-freight.page').then((m) => m.NewFreightPage),
  },
  {
    path: 'freights/:id',
    loadComponent: () => import('./freight-detail.page').then((m) => m.FreightDetailPage),
  },
  {
    path: '',
    loadComponent: () => import('../shell/tabs-shell.component').then((m) => m.TabsShellComponent),
    data: { tabs: CUSTOMER_TABS },
    children: [
      {
        path: 'freights',
        loadComponent: () => import('./freights.page').then((m) => m.FreightsPage),
      },
      {
        path: 'addresses',
        loadComponent: () => import('./addresses.page').then((m) => m.AddressesPage),
      },
      {
        path: 'account',
        loadComponent: () => import('../account/account.page').then((m) => m.AccountPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'freights' },
    ],
  },
];
