import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ApiError } from '../http/api-error';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toasts = inject(ToastController);

  async show(message: string): Promise<void> {
    await this.present(message, undefined);
  }

  async error(error: unknown): Promise<void> {
    await this.present(ApiError.from(error).message, 'toast--error');
  }

  private async present(message: string, cssClass: string | undefined): Promise<void> {
    const toast = await this.toasts.create({
      message,
      duration: 3400,
      position: 'top',
      swipeGesture: 'vertical',
      cssClass,
    });
    await toast.present();
  }
}
