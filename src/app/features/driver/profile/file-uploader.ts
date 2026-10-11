import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DriverService } from '../../../core/api/driver.service';
import { ApiError } from '../../../core/http/api-error';
import { MediaKind } from '../../../core/models';

/**
 * Sends a driver file straight to storage with a signed URL and hands back the `storageKey` to register.
 * 1) POST /driver/documents/upload-url, 2) PUT the bytes to `uploadUrl` with exactly the headers returned.
 * The PUT goes through `fetch`, not HttpClient: the interceptors would attach the API token to the storage host.
 * Where the API has no storage (`409 storage.not_configured`, local development) it falls back to registering
 * only a client-made key, and `storesFiles` turns false so the screens can say so.
 */
@Injectable({ providedIn: 'root' })
export class FileUploader {
  private readonly driver = inject(DriverService);

  /** False after the API answered that storage is not configured. */
  readonly storesFiles = signal(true);

  async upload(file: File, kind: MediaKind, userId: string): Promise<string> {
    let ticket;
    try {
      ticket = await firstValueFrom(this.driver.uploadUrl(kind, file.type));
    } catch (error) {
      if (ApiError.is(error) && error.code === 'storage.not_configured') {
        this.storesFiles.set(false);
        return buildStorageKey(userId, file.name);
      }
      throw error;
    }
    this.storesFiles.set(true);

    let response: Response;
    try {
      response = await fetch(ticket.uploadUrl, { method: ticket.method, headers: ticket.headers, body: file });
    } catch {
      throw new ApiError(0, 'upload.failed', UPLOAD_FAILED);
    }
    if (!response.ok) {
      throw new ApiError(response.status, 'upload.failed', UPLOAD_FAILED);
    }
    return ticket.storageKey;
  }
}

const UPLOAD_FAILED = 'Não foi possível enviar o arquivo. Confira sua conexão e tente de novo.';

export const ACCEPTED_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** `drivers/{userId}/1730000000000-cnh-frente.jpg`. The name is cleaned so the key stays URL-safe. */
export function buildStorageKey(userId: string, fileName: string, now = Date.now()): string {
  const cleaned = fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80);
  return `drivers/${userId}/${now}-${cleaned || 'arquivo'}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
