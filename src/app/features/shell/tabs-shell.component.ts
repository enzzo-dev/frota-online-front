import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { NotificationBadgeService } from '../../core/api/notification-badge.service';
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
  imports: [RouterLink, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, BrandMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tabs-shell.component.scss',
  template: `
    <a class="bell" routerLink="/notifications" [attr.aria-label]="bellLabel()">
      <ion-icon name="notifications-outline" aria-hidden="true" />
      @if (unread() > 0) {
        <span class="bell__badge">{{ unread() > 99 ? '99+' : unread() }}</span>
      }
    </a>

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
export class TabsShellComponent implements OnInit, OnDestroy {
  private readonly session = inject(SessionService);
  private readonly badge = inject(NotificationBadgeService);

  protected readonly unread = this.badge.unread;
  protected readonly bellLabel = computed(() =>
    this.unread() > 0 ? `Avisos, ${this.unread()} não lidos` : 'Avisos',
  );

  ngOnInit(): void {
    this.badge.start();
  }

  ngOnDestroy(): void {
    this.badge.stop();
  }

  protected readonly tabs = (inject(ActivatedRoute).snapshot.data['tabs'] ?? []) as readonly TabItem[];
  protected readonly userName = computed(() => this.session.user()?.fullName ?? '');
  protected readonly roleLabel = computed(() => {
    const role = this.session.role();
    return role ? USER_ROLE_LABEL[role] : '';
  });
}
