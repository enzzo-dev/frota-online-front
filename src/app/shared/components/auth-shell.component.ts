import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { BrandMarkComponent } from './brand-mark.component';

/**
 * Dark, animated frame shared by the login and register screens: moving grid, glowing orbs, a route that draws
 * itself with a truck running along it, and the form in a glass panel (projected). Purely visual; every animation
 * is switched off for people who ask for reduced motion.
 */
@Component({
  selector: 'app-auth-shell',
  imports: [BrandMarkComponent, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell" [class.shell--compact]="compact()">
      <div class="shell__bg" aria-hidden="true">
        <span class="shell__grid"></span>
        <span class="shell__orb shell__orb--a"></span>
        <span class="shell__orb shell__orb--b"></span>
        <span class="shell__scan"></span>
      </div>

      <section class="shell__pitch">
        <p class="shell__brand"><app-brand-mark [size]="34" /> Frota Online</p>
        <h1 class="shell__title">{{ title() }}</h1>
        @if (lede()) {
          <p class="shell__lede">{{ lede() }}</p>
        }

        <svg class="shell__route" viewBox="0 0 360 120" aria-hidden="true">
          <defs>
            <linearGradient id="routeGlow" x1="0" x2="1">
              <stop offset="0" stop-color="#d7141a" stop-opacity="0.15" />
              <stop offset="1" stop-color="#ff3b41" />
            </linearGradient>
          </defs>
          <path
            id="authRoute"
            class="shell__path"
            d="M12 96 C70 96 74 28 140 28 S 220 100 268 70 S 320 24 348 24"
            fill="none"
            stroke="url(#routeGlow)"
            stroke-width="3"
            stroke-linecap="round"
          />
          <circle cx="12" cy="96" r="6" class="shell__dot" />
          <circle cx="348" cy="24" r="6" class="shell__dot shell__dot--end" />
          <g class="shell__truck">
            <circle r="10" fill="rgba(215,20,26,0.35)" />
            <circle r="6" fill="#d7141a" />
            <circle r="2.5" fill="#fff" />
          </g>
        </svg>

        <ul class="shell__perks">
          <li><ion-icon name="pricetag-outline" aria-hidden="true" /> Motorista escolhe o próprio preço</li>
          <li><ion-icon name="map-outline" aria-hidden="true" /> Rota e entrega acompanhadas no mapa</li>
          <li><ion-icon name="shield-checkmark-outline" aria-hidden="true" /> Pagamento confirmado a cada etapa</li>
        </ul>
      </section>

      <div class="shell__panel"><ng-content /></div>
    </div>
  `,
  styleUrl: './auth-shell.component.scss',
})
export class AuthShellComponent {
  readonly title = input.required<string>();
  readonly lede = input<string>('');
  readonly compact = input(false);
}
