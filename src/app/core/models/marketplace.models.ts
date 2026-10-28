import { Address } from './address.models';
import {
  DeliveryStatus,
  FreightStatus,
  PaymentStatus,
  ProposalStatus,
  RouteView,
  StopType,
  VehicleType,
} from './enums';

export interface FreightItem {
  description: string;
  quantity: number;
}

export interface CreateFreightStopRequest {
  type: StopType;
  addressId: string;
  note?: string | null;
  items?: FreightItem[] | null;
}

export interface CreateFreightRequest {
  stops: CreateFreightStopRequest[];
  cargoDescription: string;
  cargoWeightKg: number;
  requiredVehicleType: VehicleType;
  /** UTC ISO string ending in Z, or null for a same-day freight. */
  scheduledPickupAt: string | null;
  driverNote?: string | null;
}

export interface FreightStop {
  id: string;
  sequence: number;
  type: StopType;
  address: Address;
  note: string | null;
  items: FreightItem[];
  completedAt: string | null;
}

export interface Freight {
  id: string;
  status: FreightStatus;
  cargoDescription: string;
  cargoWeightKg: number;
  requiredVehicleType: VehicleType;
  scheduledPickupAt: string | null;
  proposalDeadline: string;
  pickupCount: number;
  deliveryCount: number;
  stops: FreightStop[];
  approvedProposalId: string | null;
  pendingProposals: number;
  driverNote?: string | null;
  hasCargoPhoto?: boolean;
  /** Null while the routing engine is out or an address has no position. */
  routeDistanceMeters: number | null;
  routeDurationSeconds: number | null;
  createdAt: string;
}

export interface RankedProposal {
  rank: number;
  proposalId: string;
  price: number;
  message: string | null;
  driverName: string;
  vehicleType: VehicleType;
  vehicleModel: string;
  expiresAt: string;
  createdAt: string;
}

export interface ApprovedDelivery {
  deliveryId: string;
  freightRequestId: string;
  proposalId: string;
  driverProfileId: string;
  agreedPrice: number;
  platformFee: number;
  status: DeliveryStatus;
  agendaStartsAt: string;
  agendaEndsAt: string;
}

/** A stop as a driver sees it before winning: area and cargo, no street. */
export interface OpenStop {
  sequence: number;
  type: StopType;
  district: string;
  city: string;
  state: string;
  /** Rounded to about 1 km on purpose: marks the region, never the street. */
  approxLatitude: number | null;
  approxLongitude: number | null;
  items: FreightItem[];
}

export interface OpenFreight {
  id: string;
  cargoDescription: string;
  cargoWeightKg: number;
  requiredVehicleType: VehicleType;
  scheduledPickupAt: string | null;
  proposalDeadline: string;
  pickupCount: number;
  deliveryCount: number;
  routeDistanceMeters: number | null;
  routeDurationSeconds: number | null;
  stops: OpenStop[];
  driverNote?: string | null;
  hasCargoPhoto?: boolean;
}

export interface SubmitProposalRequest {
  vehicleId: string;
  price: number;
  message?: string | null;
}

export interface Proposal {
  id: string;
  freightRequestId: string;
  vehicleId: string;
  price: number;
  message: string | null;
  status: ProposalStatus;
  expiresAt: string;
  createdAt: string;
}

export interface DriverDeliverySummary {
  deliveryId: string;
  freightRequestId: string;
  status: DeliveryStatus;
  agreedPrice: number;
  scheduledPickupAt: string | null;
  totalStops: number;
  completedStops: number;
  /** Payment of the freight, or null when none was started. Absent on API versions that predate the field. */
  payment?: PaymentStatus | null;
  /** Absent on API versions that predate the signatures. */
  driverSigned?: boolean;
  customerSigned?: boolean;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface RouteStop {
  stopId: string;
  sequence: number;
  type: StopType;
  address: Address;
  note: string | null;
  items: FreightItem[];
  completedAt: string | null;
}

export interface DeliveryRoute {
  deliveryId: string;
  freightRequestId: string;
  cargoDescription: string;
  cargoWeightKg: number;
  driverNote?: string | null;
  hasCargoPhoto?: boolean;
  view: RouteView;
  totalStops: number;
  completedStops: number;
  stops: RouteStop[];
}
