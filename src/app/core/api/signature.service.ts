import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../http/api-error';
import { ApiClient } from '../http/api-client';

export type SignatureType = 'Customer' | 'Driver';

@Injectable({ providedIn: 'root' })
export class SignatureService {
  private readonly api = inject(ApiClient);

  async submit(type: SignatureType, freightId: string, image: Blob): Promise<void> {
    const dataUrl = await toDataUrl(image);
    try {
      await firstValueFrom(this.api.post<void>('/signatures', { type, freightId, image: dataUrl }));
    } catch (error) {
      if (!(ApiError.is(error) && error.code === 'signature.already_collected')) {
        throw error;
      }
    }
  }

  image(freightId: string, type: SignatureType): Promise<Blob> {
    return firstValueFrom(this.api.getBlob(`/signatures/${freightId}/${type}`));
  }
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ApiError(0, 'signature.invalid_image', 'Não foi possível ler a assinatura.'));
    reader.readAsDataURL(blob);
  });
}
