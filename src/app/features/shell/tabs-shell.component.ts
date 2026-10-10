import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { SessionService } from '../../core/auth/session.service';
import { USER_ROLE_LABEL } from '../../core/ui/labels';
import { BrandMarkComponent } from '../../shared/components/brand-mark.component';

export interface TabItem {
  /** Route path of the tab, relative to the role's root (`/driver/freights` -> `freights`). */
  readonly tab: string;
  readonly label: string;
  readonly icon: string;
}

/**
 * Bottom tab bar on phones, the black side rail of the API guide on wide screens.
 * The tabs of each role come from the route data, so one shell serves every role.
 */
@Component({
  selector: 'app-tabs-shell',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, BrandMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tabs-shell.component.scss',
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" class="dock">
        <div class="dock__brand">
          <app-brand-mark [size]="38" />
          <span>Frota Online</span>
        </div>

        @for (item of tabs; track item.tab) {
          <ion-tab-button [tab]="item.tab">
            <ion-icon [name]="item.icon" aria-hidden="true" />
            <ion-label>{{ item.label }}</ion-label>
          </ion-tab-button>
        }

        <div class="dock__session">
          <p class="dock__session-title">Sua sessão</p>
          <p class="dock__session-name">{{ userName() }}</p>
          <p class="dock__session-sub">{{ roleLabel() }}</p>
        </div>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsShellComponent {
  private readonly session = inject(SessionService);

  protected readonly tabs = (inject(ActivatedRoute).snapshot.data['tabs'] ?? []) as readonly TabItem[];
  protected readonly userName = computed(() => this.session.user()?.fullName ?? '');
  protected readonly roleLabel = computed(() => {
    const role = this.session.role();
    return role ? USER_ROLE_LABEL[role] : '';
  });
}
