export type NotificationType =
  | 'ProposalReceived'
  | 'ProposalApproved'
  | 'ProposalNotSelected'
  | 'ProposalExpired'
  | 'FreightExpired'
  | 'DeliveryStarted'
  | 'DeliveryPickedUp'
  | 'DeliveryStopCompleted'
  | 'DeliveryCompleted'
  | 'DeliveryIncident'
  | 'DeliveryCancelled'
  | 'PaymentConfirmed'
  | 'DriverApproved'
  | 'DriverRejected'
  | 'FeeSettled'
  | 'NewFreightAvailable'
  | 'PaymentReceived'
  | 'SubscriptionActivated';

/** What the app opens when the person taps a notification. */
export type NotificationTarget = 'Freight' | 'Proposal' | 'Delivery' | 'DriverProfile' | 'Fee' | 'Subscription';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  targetType: NotificationTarget;
  targetId: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  items: AppNotification[];
  unreadCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface NotificationPreferences {
  newFreightAlerts: boolean;
  pushEnabled: boolean;
}

export type DevicePlatform = 'Android' | 'Ios' | 'Web';
