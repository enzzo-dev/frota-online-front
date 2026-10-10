import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BrandMarkComponent } from './brand-mark.component';

/** The black header card with the grid and red rings, from the API guide. Projected content becomes its actions. */
@Component({
  selector: 'app-hero',
  imports: [BrandMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      @if (brand()) {
        <p class="hero__eyebrow"><app-brand-mark [size]="32" /> Frota Online</p>
      }
      <h1 class="hero__title">{{ title() }}</h1>
      @if (lede()) {
        <p class="hero__lede">{{ lede() }}</p>
      }
      <div class="hero__actions"><ng-content /></div>
      <div class="roadline" aria-hidden="true"></div>
    </section>
  `,
  styles: `
    .hero__actions:empty {
      display: none;
    }
  `,
})
export class HeroComponent {
  readonly title = input.required<string>();
  readonly lede = input<string>('');
  readonly brand = input(false);
}
