import { Routes } from '@angular/router';
import { driverApprovedGuard } from '../../core/api/driver-approved.guard';
import type { TabItem } from '../shell/tabs-shell.component';

const DRIVER_TABS: readonly TabItem[] = [
  { tab: 'freights', label: 'Fretes', icon: 'cube-outline' },
  { tab: 'proposals', label: 'Propostas', icon: 'pricetag-outline' },
  { tab: 'deliveries', label: 'Corridas', icon: 'map-outline' },
  { tab: 'profile', label: 'Cadastro', icon: 'id-card-outline' },
  { tab: 'account', label: 'Conta', icon: 'person-circle-outline' },
];

export const DRIVER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../shell/tabs-shell.component').then((m) => m.TabsShellComponent),
    data: { tabs: DRIVER_TABS },
    children: [
      {
        path: 'freights',
        canActivate: [driverApprovedGuard],
        loadComponent: () => import('./freight-board.page').then((m) => m.FreightBoardPage),
      },
      {
        path: 'proposals',
        canActivate: [driverApprovedGuard],
        loadComponent: () => import('./proposals.page').then((m) => m.ProposalsPage),
      },
      {
        path: 'deliveries',
        canActivate: [driverApprovedGuard],
        loadComponent: () => import('./deliveries.page').then((m) => m.DeliveriesPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./profile/profile.page').then((m) => m.DriverProfilePage),
      },
      {
        path: 'account',
        loadComponent: () => import('../account/account.page').then((m) => m.AccountPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'freights' },
    ],
  },
  // Pushed over the tabs, full screen, with a back button.
  {
    path: 'deliveries/:id',
    canActivate: [driverApprovedGuard],
    loadComponent: () => import('./delivery-route.page').then((m) => m.DeliveryRoutePage),
  },
];
