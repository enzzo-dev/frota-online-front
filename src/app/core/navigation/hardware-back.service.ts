import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ActionSheetController, AlertController, ModalController, PopoverController } from '@ionic/angular';

const VISIBLE_BACK_BUTTON = 'ion-router-outlet .ion-page:not(.ion-page-hidden) ion-back-button';

@Injectable({ providedIn: 'root' })
export class HardwareBackService {
  private readonly modals = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly sheets = inject(ActionSheetController);
  private readonly popovers = inject(PopoverController);

  private started = false;

  start(): void {
    if (this.started || !Capacitor.isNativePlatform()) {
      return;
    }
    this.started = true;
    void App.addListener('backButton', () => void this.handle());
  }

  private async handle(): Promise<void> {
    if (await this.dismissOverlay()) {
      return;
    }
    const back = document.querySelector<HTMLElement>(VISIBLE_BACK_BUTTON);
    if (back) {
      back.click();
      return;
    }
    await App.minimizeApp();
  }

  private async dismissOverlay(): Promise<boolean> {
    for (const controller of [this.alerts, this.sheets, this.popovers, this.modals]) {
      const top = await controller.getTop();
      if (top) {
        await top.dismiss(undefined, 'cancel');
        return true;
      }
    }
    return false;
  }
}
