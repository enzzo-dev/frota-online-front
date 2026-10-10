import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { ApiError } from '../http/api-error';
import {
  DriverProfile,
  MediaFile,
  RegisterMediaRequest,
  RegisterVehicleRequest,
  UpsertDriverProfileRequest,
  Vehicle,
} from '../models';

/** Onboarding calls of a driver: profile, vehicles and documents. */
@Injectable({ providedIn: 'root' })
export class DriverService {
  private readonly api = inject(ApiClient);

  /** `null` when the driver has no profile yet (the API answers 404). */
  profile(): Observable<DriverProfile | null> {
    return this.api.get<DriverProfile | null>('/driver/profile').pipe(
      catchError((error: unknown) => {
        if (ApiError.is(error) && error.status === 404) {
          return of(null);
        }
        throw error;
      }),
    );
  }

  saveProfile(request: UpsertDriverProfileRequest): Observable<DriverProfile> {
    return this.api.put<DriverProfile>('/driver/profile', request);
  }

  submitForReview(): Observable<DriverProfile> {
    return this.api.post<DriverProfile>('/driver/submit');
  }

  vehicles(): Observable<Vehicle[]> {
    return this.api.get<Vehicle[]>('/driver/vehicles');
  }

  registerVehicle(request: RegisterVehicleRequest): Observable<Vehicle> {
    return this.api.post<Vehicle>('/driver/vehicles', request);
  }

  deactivateVehicle(vehicleId: string): Observable<void> {
    return this.api.delete<void>(`/driver/vehicles/${vehicleId}`);
  }

  documents(): Observable<MediaFile[]> {
    return this.api.get<MediaFile[]>('/driver/documents');
  }

  registerDocument(request: RegisterMediaRequest): Observable<MediaFile> {
    return this.api.post<MediaFile>('/driver/documents', request);
  }
}
