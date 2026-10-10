import { Address } from './address.models';
import {
  DeliveryStatus,
  DriverStatus,
  FreightStatus,
  ProposalStatus,
  TermType,
  UserRole,
} from './enums';
import { MediaFile, Vehicle } from './driver.models';

/** Password confirms the owner; `confirm` must be true so a stray call cannot erase an account. */
export interface DeleteAccountRequest {
  password: string;
  confirm: boolean;
}

export interface AccountDeletionResponse {
  deletedAt: string;
  /** What the platform keeps after the erasure, in plain words. */
  retainedData: string[];
}

export interface PersonalAccountData {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PersonalDriverData {
  taxId: string;
  cnhNumber: string;
  cnhCategory: string;
  status: DriverStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

export interface PersonalConsentData {
  termType: TermType;
  version: string;
  acceptedAt: string;
  ipAddress: string | null;
}

export interface PersonalFreightData {
  id: string;
  status: FreightStatus;
  cargoDescription: string;
  cargoWeightKg: number;
  stopCount: number;
  createdAt: string;
}

export interface PersonalProposalData {
  id: string;
  freightRequestId: string;
  price: number;
  message: string | null;
  status: ProposalStatus;
  createdAt: string;
}

export interface PersonalDeliveryData {
  id: string;
  freightRequestId: string;
  /** Whether the person was the customer or the driver of the delivery. */
  role: string;
  status: DeliveryStatus;
  agreedPrice: number;
  platformFee: number;
  createdAt: string;
}

/** Everything the platform holds about the signed-in person (LGPD art. 18, II and V). */
export interface PersonalDataExport {
  generatedAt: string;
  account: PersonalAccountData;
  customerDocumentNumber: string | null;
  driver: PersonalDriverData | null;
  vehicles: Vehicle[];
  addresses: Address[];
  files: MediaFile[];
  consents: PersonalConsentData[];
  freights: PersonalFreightData[];
  proposals: PersonalProposalData[];
  deliveries: PersonalDeliveryData[];
}
