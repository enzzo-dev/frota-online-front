import { UserRole } from '../models';

/** Where each role lands after signing in. */
export function homeFor(role: UserRole | null): string {
  switch (role) {
    case 'Driver':
      return '/driver/freights';
    case 'Customer':
      return '/customer/freights';
    case 'Admin':
      return '/admin/drivers';
    default:
      return '/auth/login';
  }
}
