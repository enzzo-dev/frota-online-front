import { Injectable } from '@angular/core';

/**
 * Sends a driver file to storage under the key the API will later check
 * (`drivers/{userId}/...`). The API has no upload endpoint yet, so the default only describes the
 * file and the front-end registers its key. Provide another implementation (presigned URL, SDK)
 * to really store the bytes without changing any screen.
 */
@Injectable({ providedIn: 'root', useFactory: () => new MetadataOnlyFileUploader() })
export abstract class FileUploader {
  /** True when `upload` really stores the file. */
  abstract readonly storesFiles: boolean;
  abstract upload(file: File, storageKey: string): Promise<void>;
}

export class MetadataOnlyFileUploader extends FileUploader {
  readonly storesFiles = false;

  override async upload(): Promise<void> {
    /* Nothing to send: there is no upload endpoint yet. */
  }
}

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
