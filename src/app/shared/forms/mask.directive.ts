import { Directive, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';
import { maskPhone, maskTaxId } from '../../core/util/masks';

export type MaskKind = 'phone' | 'taxId';

const MASKS: Record<MaskKind, (value: string) => string> = {
  phone: maskPhone,
  taxId: maskTaxId,
};

/**
 * Formats a Ionic input while it is typed: `<ion-input formControlName="phone" appMask="phone" />`.
 * The control holds the masked text; screens call the normalizers before sending it to the API.
 */
@Directive({
  selector: 'ion-input[appMask]',
  host: { '(ionInput)': 'format($event)' },
})
export class MaskDirective {
  readonly appMask = input.required<MaskKind>();
  private readonly control = inject(NgControl, { optional: true });

  protected format(event: Event): void {
    const target = event.target as HTMLIonInputElement | null;
    const current = String(target?.value ?? '');
    const masked = MASKS[this.appMask()](current);
    if (masked === current) {
      return;
    }
    if (this.control?.control) {
      this.control.control.setValue(masked);
    } else if (target) {
      target.value = masked;
    }
  }
}
