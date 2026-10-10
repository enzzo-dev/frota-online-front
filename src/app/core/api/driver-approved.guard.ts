import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DriverProfileStore } from './driver-profile.store';

/** The freight board, proposals and deliveries need an approved profile. Others finish onboarding first. */
export const driverApprovedGuard: CanActivateFn = async () => {
  const store = inject(DriverProfileStore);
  const router = inject(Router);
  try {
    const profile = await store.ensureFresh();
    return profile?.status === 'Approved' ? true : router.createUrlTree(['/driver/profile']);
  } catch {
    // If the profile cannot be read (offline, server down), let the onboarding screen explain it.
    return router.createUrlTree(['/driver/profile']);
  }
};
