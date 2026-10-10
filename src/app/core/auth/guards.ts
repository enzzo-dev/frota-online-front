import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../models';
import { homeFor } from './home-routes';
import { SessionService } from './session.service';

/** Only signed-in users. Everyone else goes to the sign-in screen. */
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.isAuthenticated() ? true : inject(Router).createUrlTree(['/auth/login']);
};

/** Only anonymous visitors. Signed-in users go to their home. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.isAuthenticated() ? inject(Router).parseUrl(homeFor(session.role())) : true;
};

/** Only the given role. Anyone else is sent to their own home. */
export function roleGuard(role: UserRole): CanActivateFn {
  return () => {
    const session = inject(SessionService);
    const router = inject(Router);
    if (!session.isAuthenticated()) {
      return router.createUrlTree(['/auth/login']);
    }
    return session.role() === role ? true : router.parseUrl(homeFor(session.role()));
  };
}

/** `/` sends each user to the right place. */
export const homeRedirectGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return inject(Router).parseUrl(homeFor(session.role()));
};
