import { DriverStatus, MediaKind, VehicleType } from './enums';

export interface UpsertDriverProfileRequest {
  taxId: string;
  cnhNumber: string;
  cnhCategory: string;
}

export interface SubmissionChecklist {
  termsAccepted: boolean;
  hasActiveVehicle: boolean;
  hasDocument: boolean;
  isReady: boolean;
}

export interface DriverProfile {
  id: string;
  taxId: string;
  cnhNumber: string;
  cnhCategory: string;
  status: DriverStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  checklist: SubmissionChecklist;
}

export interface RegisterVehicleRequest {
  type: VehicleType;
  plate: string;
  model: string;
  year: number;
  capacityKg: number;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  plate: string;
  model: string;
  year: number;
  capacityKg: number;
  isActive: boolean;
}

export interface RegisterMediaRequest {
  kind: MediaKind;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
}

export interface MediaFile {
  id: string;
  kind: MediaKind;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}
