import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#D7141A" />
      <rect x="14" y="3" width="4" height="7" fill="#fff" />
      <rect x="14" y="12" width="4" height="7" fill="#fff" />
      <rect x="14" y="21" width="4" height="7" fill="#fff" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
  `,
})
export class BrandMarkComponent {
  readonly size = input(34);
}
