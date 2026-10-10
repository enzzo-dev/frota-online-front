import { Address } from './address.models';
import {
  DeliveryStatus,
  FreightStatus,
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
  stops: OpenStop[];
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
  view: RouteView;
  totalStops: number;
  completedStops: number;
  stops: RouteStop[];
}
