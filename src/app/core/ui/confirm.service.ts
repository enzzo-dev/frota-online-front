import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';

export interface ConfirmOptions {
  readonly header: string;
  readonly message?: string;
  readonly confirmText: string;
  readonly cancelText?: string;
  /** Draws the confirm button in red, for actions that cannot be undone. */
  readonly destructive?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  readonly label: string;
  readonly placeholder?: string;
  readonly maxLength?: number;
}

/** Confirmation dialogs, so screens ask "are you sure?" the same way. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly alerts = inject(AlertController);

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const alert = await this.alerts.create({
      header: options.header,
      message: options.message,
      buttons: [
        { text: options.cancelText ?? 'Cancelar', role: 'cancel' },
        {
          text: options.confirmText,
          role: options.destructive ? 'destructive' : 'confirm',
        },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm' || role === 'destructive';
  }

  /** Asks for a required text. Resolves to the trimmed text, or `null` if the user cancelled. */
  async promptText(options: PromptOptions): Promise<string | null> {
    const alert = await this.alerts.create({
      header: options.header,
      message: options.message,
      inputs: [
        {
          name: 'text',
          type: 'textarea',
          label: options.label,
          placeholder: options.placeholder ?? options.label,
          attributes: { maxlength: options.maxLength ?? 500 },
        },
      ],
      buttons: [
        { text: options.cancelText ?? 'Cancelar', role: 'cancel' },
        {
          text: options.confirmText,
          role: options.destructive ? 'destructive' : 'confirm',
          // Keep the dialog open until something is typed.
          handler: (value: { text?: string }) => (value.text ?? '').trim().length > 0,
        },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values?: { text?: string } }>();
    if (role !== 'confirm' && role !== 'destructive') {
      return null;
    }
    const text = data?.values?.text?.trim();
    return text ? text : null;
  }
}
