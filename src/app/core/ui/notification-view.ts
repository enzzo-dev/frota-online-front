import { AppNotification, NotificationType, UserRole } from '../models';

export interface NotificationLook {
  readonly icon: string;
  readonly tone: 'red' | 'dark' | 'outline';
}

export const NOTIFICATION_LOOK: Readonly<Record<NotificationType, NotificationLook>> = {
  ProposalReceived: { icon: 'pricetag-outline', tone: 'red' },
  ProposalApproved: { icon: 'checkmark-circle-outline', tone: 'red' },
  ProposalNotSelected: { icon: 'pricetag-outline', tone: 'outline' },
  ProposalExpired: { icon: 'time-outline', tone: 'outline' },
  FreightExpired: { icon: 'time-outline', tone: 'outline' },
  DeliveryStarted: { icon: 'navigate-outline', tone: 'dark' },
  DeliveryPickedUp: { icon: 'cube-outline', tone: 'dark' },
  DeliveryStopCompleted: { icon: 'location-outline', tone: 'dark' },
  DeliveryCompleted: { icon: 'checkmark-circle-outline', tone: 'red' },
  DeliveryIncident: { icon: 'alert-circle-outline', tone: 'red' },
  DeliveryCancelled: { icon: 'close-outline', tone: 'outline' },
  PaymentConfirmed: { icon: 'card-outline', tone: 'red' },
  PaymentReceived: { icon: 'wallet-outline', tone: 'red' },
  DriverApproved: { icon: 'shield-checkmark-outline', tone: 'red' },
  DriverRejected: { icon: 'alert-circle-outline', tone: 'outline' },
  FeeSettled: { icon: 'document-text-outline', tone: 'dark' },
  NewFreightAvailable: { icon: 'cube-outline', tone: 'red' },
  SubscriptionActivated: { icon: 'ribbon-outline', tone: 'red' },
  PaymentFailed: { icon: 'alert-circle-outline', tone: 'red' },
};

/** Where a tap on a notification goes, by what it points at and who is reading. `null`: nothing to open. */
export function notificationLink(notification: AppNotification, role: UserRole | null): string | null {
  const { targetType: target, targetId: id } = notification;
  if (role === 'Customer') {
    if (target === 'Freight') return `/customer/freights/${id}`;
    if (target === 'Delivery') return `/customer/deliveries/${id}`;
    return null;
  }
  if (role === 'Driver') {
    switch (target) {
      case 'Delivery':
        return `/driver/deliveries/${id}`;
      case 'Freight':
        return '/driver/freights';
      case 'Proposal':
        return '/driver/proposals';
      case 'DriverProfile':
        return '/driver/profile';
      case 'Fee':
        return '/driver/fees';
      case 'Subscription':
        return '/driver/billing';
    }
  }
  return null;
}
