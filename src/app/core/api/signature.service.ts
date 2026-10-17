import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../http/api-error';
import { ApiClient } from '../http/api-client';

export type SignatureType = 'Customer' | 'Driver';

interface SignatureUploadTicket {
  readonly uploadUrl: string;
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly storagePath: string;
}

const UPLOAD_FAILED = 'Não foi possível enviar a assinatura. Confira sua conexão e tente de novo.';

@Injectable({ providedIn: 'root' })
export class SignatureService {
  private readonly api = inject(ApiClient);

  async submit(type: SignatureType, freightId: string, image: Blob): Promise<void> {
    const ticket = await firstValueFrom(
      this.api.post<SignatureUploadTicket>('/signatures/upload-url', {
        type,
        freightId,
        contentType: 'image/png',
      }),
    );
    await this.put(ticket, image);
    await firstValueFrom(this.api.post<void>('/signatures', { type, freightId, storagePath: ticket.storagePath }));
  }

  private async put(ticket: SignatureUploadTicket, image: Blob): Promise<void> {
    let response: Response;
    try {
      response = await fetch(ticket.uploadUrl, {
        method: ticket.method ?? 'PUT',
        headers: ticket.headers,
        body: image,
      });
    } catch {
      throw new ApiError(0, 'upload.failed', UPLOAD_FAILED);
    }
    if (!response.ok) {
      throw new ApiError(response.status, 'upload.failed', UPLOAD_FAILED);
    }
  }
}
