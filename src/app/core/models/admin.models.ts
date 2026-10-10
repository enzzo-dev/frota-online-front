import { DriverStatus } from './enums';
import { MediaFile, Vehicle } from './driver.models';

export interface DriverReviewSummary {
  driverId: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  status: DriverStatus;
  lastUpdatedAt: string | null;
}

export interface DriverReviewDetail {
  driverId: string;
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  taxId: string;
  cnhNumber: string;
  cnhCategory: string;
  status: DriverStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  vehicles: Vehicle[];
  files: MediaFile[];
}
