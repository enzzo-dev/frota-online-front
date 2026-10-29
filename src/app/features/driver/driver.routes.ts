import { Routes } from '@angular/router';
import { driverApprovedGuard } from '../../core/api/driver-approved.guard';
import type { TabItem } from '../shell/tabs-shell.component';

const DRIVER_TABS: readonly TabItem[] = [
  { tab: 'home', label: 'Início', icon: 'home-outline' },
  { tab: 'freights', label: 'Fretes', icon: 'cube-outline' },
  { tab: 'agenda', label: 'Agenda', icon: 'calendar-outline' },
  { tab: 'deliveries', label: 'Corridas', icon: 'map-outline' },
  { tab: 'account', label: 'Conta', icon: 'person-circle-outline' },
];

export const DRIVER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../shell/tabs-shell.component').then((m) => m.TabsShellComponent),
    data: { tabs: DRIVER_TABS },
    children: [
      {
        path: 'home',
        canActivate: [driverApprovedGuard],
        loadComponent: () => import('./home.page').then((m) => m.DriverHomePage),
      },
      {
        path: 'freights',
        canActivate: [driverApprovedGuard],
        loadComponent: () => import('./freight-board.page').then((m) => m.FreightBoardPage),
      },
      {
        path: 'agenda',
        canActivate: [driverApprovedGuard],
        loadComponent: () => import('./agenda.page').then((m) => m.AgendaPage),
      },
      {
        path: 'deliveries',
        canActivate: [driverApprovedGuard],
        loadComponent: () => import('./deliveries.page').then((m) => m.DeliveriesPage),
      },
      {
        path: 'account',
        loadComponent: () => import('../account/account.page').then((m) => m.AccountPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'home' },
    ],
  },
  // Pushed over the tabs, full screen, with a back button.
  {
    path: 'agenda/:id',
    canActivate: [driverApprovedGuard],
    loadComponent: () => import('./agenda-detail.page').then((m) => m.AgendaDetailPage),
  },
  {
    path: 'proposals',
    canActivate: [driverApprovedGuard],
    loadComponent: () => import('./proposals.page').then((m) => m.ProposalsPage),
  },
  {
    path: 'performance',
    canActivate: [driverApprovedGuard],
    loadComponent: () => import('./performance.page').then((m) => m.PerformancePage),
  },
  {
    path: 'fees',
    canActivate: [driverApprovedGuard],
    loadComponent: () => import('./fees.page').then((m) => m.FeesPage),
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.page').then((m) => m.DriverProfilePage),
  },
  {
    path: 'billing',
    loadComponent: () => import('./billing.page').then((m) => m.BillingPage),
  },
  {
    path: 'deliveries/:id',
    canActivate: [driverApprovedGuard],
    loadComponent: () => import('./delivery-route.page').then((m) => m.DeliveryRoutePage),
  },
];
