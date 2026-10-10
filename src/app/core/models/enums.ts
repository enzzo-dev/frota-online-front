/** Enums travel as strings (JsonStringEnumConverter on the API). */

export const USER_ROLES = ['Customer', 'Driver', 'Admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DRIVER_STATUSES = ['Draft', 'PendingReview', 'Approved', 'Rejected'] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const VEHICLE_TYPES = ['Fiorino', 'Van', 'Pickup', 'Truck34', 'Truck', 'Trailer'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const STOP_TYPES = ['Pickup', 'Delivery'] as const;
export type StopType = (typeof STOP_TYPES)[number];

export const FREIGHT_STATUSES = ['Open', 'Approved', 'Expired', 'Cancelled'] as const;
export type FreightStatus = (typeof FREIGHT_STATUSES)[number];

export const PROPOSAL_STATUSES = ['Pending', 'Accepted', 'Rejected', 'Expired', 'Withdrawn'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const DELIVERY_STATUSES = [
  'Scheduled',
  'ToPickup',
  'PickedUp',
  'InTransit',
  'Delivered',
  'Cancelled',
  'Incident',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const MEDIA_KINDS = ['DriverDocument', 'VehiclePhoto', 'CargoPhoto', 'DeliveryProof'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const TERM_TYPES = ['TermsOfUse', 'PrivacyPolicy'] as const;
export type TermType = (typeof TERM_TYPES)[number];

export const ROUTE_VIEWS = ['Full', 'Next'] as const;
export type RouteView = (typeof ROUTE_VIEWS)[number];
