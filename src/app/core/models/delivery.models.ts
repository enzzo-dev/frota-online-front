import { DeliveryStatus, FeeEntryType, PaymentMethod, PaymentStatus, VehicleType } from './enums';
import { FreightStop } from './marketplace.models';

/** Answer of every progress action of the driver (start, complete stop, incident, cancel). */
export interface DeliveryProgress {
  deliveryId: string;
  status: DeliveryStatus;
  totalStops: number;
  completedStops: number;
  /** The stop to complete next, or null when there is none left. */
  nextStopId: string | null;
}

export interface CompleteStopRequest {
  note?: string | null;
  /** Both or neither. */
  latitude?: number | null;
  longitude?: number | null;
  /** Id of a registered `DeliveryProof` media file. */
  proofMediaFileId?: string | null;
}

export interface IncidentRequest {
  note: string;
}

export interface CancelDeliveryRequest {
  reason: string;
}

export interface ConfirmPaymentRequest {
  method: PaymentMethod;
  reference?: string | null;
}

export interface PaymentResponse {
  id: string;
  deliveryId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
}

export interface FeeEntry {
  id: string;
  deliveryId: string | null;
  type: FeeEntryType;
  amount: number;
  description: string;
  createdAt: string;
}

export interface FeeStatement {
  /** What the driver still owes the platform. */
  balance: number;
  totalAccrued: number;
  totalSettled: number;
  entries: FeeEntry[];
}

export interface CustomerDeliverySummary {
  deliveryId: string;
  freightRequestId: string;
  status: DeliveryStatus;
  agreedPrice: number;
  driverName: string;
  vehicleType: VehicleType;
  vehicleModel: string;
  vehiclePlate: string;
  totalStops: number;
  completedStops: number;
  payment: PaymentStatus | null;
  createdAt: string;
}

/** What the live tracking screen polls. `version` is opaque: it changes when anything on the delivery changes. */
export interface DeliveryStatusResponse {
  deliveryId: string;
  status: DeliveryStatus;
  totalStops: number;
  completedStops: number;
  payment: PaymentStatus | null;
  lastEventAt: string | null;
  /** Where the driver is right now. Only sent while the delivery is under way. */
  driverLocation: DriverLocation | null;
  version: string;
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading: number | null;
  speedKmh: number | null;
  recordedAt: string;
}

export interface UpdateLocationRequest {
  latitude: number;
  longitude: number;
  heading: number | null;
  speedKmh: number | null;
}

export interface TimelineEvent {
  status: DeliveryStatus;
  occurredAt: string;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  hasProof: boolean;
}

export interface CustomerDeliveryDetail extends Omit<CustomerDeliverySummary, 'totalStops' | 'completedStops' | 'createdAt'> {
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  stops: FreightStop[];
  timeline: TimelineEvent[];
}
