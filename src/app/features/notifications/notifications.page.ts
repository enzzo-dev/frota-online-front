import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonToggle,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { NotificationBadgeService } from '../../core/api/notification-badge.service';
import { NotificationsService } from '../../core/api/notifications.service';
import { SessionService } from '../../core/auth/session.service';
import { homeFor } from '../../core/auth/home-routes';
import { AppNotification, NotificationPreferences } from '../../core/models';
import { NOTIFICATION_LOOK, notificationLink } from '../../core/ui/notification-view';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

/** The inbox of any signed-in person: what happened, what is unread, and the two push switches. */
@Component({
  selector: 'app-notifications-page',
  imports: [
    DatePipe,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonToggle,
    EmptyStateComponent,
    PageBarComponent,
    ProblemAlertComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .item {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      width: 100%;
      text-align: left;
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .item--unread {
      border-color: var(--red);
      background: #fff8f8;
    }
    .item__icon {
      flex: none;
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      font-size: 21px;
      background: var(--panel);
    }
    .item__icon--red {
      background: var(--red);
      color: #fff;
    }
    .item__icon--dark {
      background: var(--black);
      color: #fff;
    }
    .item__dot {
      flex: none;
      width: 10px;
      height: 10px;
      margin-top: 6px;
      border-radius: 50%;
      background: var(--red);
    }
    .switch {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    ion-toggle {
      --track-background-checked: var(--red);
    }
  `,
  template: `
    <app-page-bar title="Avisos" [backHref]="home()" />

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--with-bar">
        <div class="row row--between row--wrap">
          <div class="row">
            <button class="chip" type="button" [class.chip--red]="!onlyUnread()" [class.chip--outline]="onlyUnread()" (click)="setFilter(false)">Todos</button>
            <button class="chip" type="button" [class.chip--red]="onlyUnread()" [class.chip--outline]="!onlyUnread()" (click)="setFilter(true)">Não lidos</button>
          </div>
          <button class="link-btn" type="button" [disabled]="unread() === 0" (click)="readAll()">Marcar todos como lidos</button>
        </div>

        <app-problem-alert [error]="load.error()" />

        @if (load.loading() && items().length === 0) {
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        }

        <div class="stack">
          @for (n of items(); track n.id) {
            <button type="button" class="card item" [class.item--unread]="!n.isRead" (click)="open(n)">
              <span class="item__icon item__icon--{{ look[n.type].tone }}">
                <ion-icon [name]="look[n.type].icon" aria-hidden="true" />
              </span>
              <span class="grow">
                <strong class="strong" style="display: block">{{ n.title }}</strong>
                <span class="small" style="display: block">{{ n.body }}</span>
                <span class="muted small" style="display: block; margin-top: 4px">
                  {{ n.createdAt | utc | date: "dd/MM 'às' HH:mm" }}
                </span>
              </span>
              @if (!n.isRead) {
                <span class="item__dot" aria-label="Não lido"></span>
              }
            </button>
          }
        </div>

        @if (!load.loading() && items().length === 0) {
          <app-empty-state
            [title]="onlyUnread() ? 'Nada por ler' : 'Nenhum aviso ainda'"
            description="Propostas, entregas e pagamentos aparecem aqui."
          />
        }

        @if (hasMore()) {
          <button class="btn btn--ghost btn--block" type="button" [disabled]="more.loading()" (click)="loadMore()">
            @if (more.loading()) {
              <ion-spinner name="crescent" />
            }
            Carregar mais
          </button>
        }

        @if (prefs(); as p) {
          <section class="card stack" aria-label="Preferências de aviso">
            <h3>Preferências</h3>
            <div class="switch">
              <span>
                <strong class="strong" style="display: block">Receber avisos no celular</strong>
                <span class="muted small">Desligado, os avisos continuam aqui, mas o aparelho fica em silêncio.</span>
              </span>
              <ion-toggle aria-label="Receber avisos no celular" [checked]="p.pushEnabled" (ionChange)="toggle('pushEnabled', $event)" />
            </div>
            @if (isDriver()) {
              <div class="switch">
                <span>
                  <strong class="strong" style="display: block">Avisar de fretes novos</strong>
                  <span class="muted small">Quando abrir um frete que cabe em um dos seus veículos.</span>
                </span>
                <ion-toggle aria-label="Avisar de fretes novos" [checked]="p.newFreightAlerts" (ionChange)="toggle('newFreightAlerts', $event)" />
              </div>
            }
            <app-problem-alert [error]="prefRequest.error()" />
          </section>
        }
      </div>
    </ion-content>
  `,
})
export class NotificationsPage {
  private readonly api = inject(NotificationsService);
  private readonly badge = inject(NotificationBadgeService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly look = NOTIFICATION_LOOK;
  protected readonly load = createRequestState();
  protected readonly more = createRequestState();
  protected readonly prefRequest = createRequestState();

  protected readonly items = signal<AppNotification[]>([]);
  protected readonly unread = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly onlyUnread = signal(false);
  protected readonly prefs = signal<NotificationPreferences | null>(null);
  protected readonly isDriver = computed(() => this.session.role() === 'Driver');
  protected readonly home = computed(() => homeFor(this.session.role()));

  private page = 1;

  ionViewWillEnter(): void {
    void this.reload();
    void this.loadPrefs();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected setFilter(unreadOnly: boolean): void {
    if (this.onlyUnread() === unreadOnly) {
      return;
    }
    this.onlyUnread.set(unreadOnly);
    void this.reload();
  }

  protected async open(notification: AppNotification): Promise<void> {
    if (!notification.isRead) {
      this.items.update((list) => list.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
      this.setUnread(this.unread() - 1);
      firstValueFrom(this.api.markRead(notification.id)).catch(() => undefined);
    }
    const link = notificationLink(notification, this.session.role());
    if (link) {
      await this.router.navigateByUrl(link);
    }
  }

  protected async readAll(): Promise<void> {
    await firstValueFrom(this.api.markAllRead()).catch(() => undefined);
    this.setUnread(0);
    await this.reload();
  }

  protected async loadMore(): Promise<void> {
    const next = await this.more.run(() =>
      firstValueFrom(this.api.list({ unreadOnly: this.onlyUnread(), page: this.page + 1 })),
    );
    if (next) {
      this.page = next.page;
      this.items.update((list) => [...list, ...next.items]);
      this.hasMore.set(next.hasMore);
    }
  }

  protected async toggle(key: keyof NotificationPreferences, event: Event): Promise<void> {
    const checked = (event as CustomEvent<{ checked: boolean }>).detail.checked;
    if (this.prefs()?.[key] === checked) {
      return;
    }
    const updated = await this.prefRequest.run(() => firstValueFrom(this.api.updatePreferences({ [key]: checked })));
    if (updated) {
      this.prefs.set(updated);
    }
  }

  private async reload(): Promise<void> {
    const result = await this.load.run(() => firstValueFrom(this.api.list({ unreadOnly: this.onlyUnread() })));
    if (result) {
      this.page = result.page;
      this.items.set(result.items);
      this.hasMore.set(result.hasMore);
      this.setUnread(result.unreadCount);
    }
  }

  private async loadPrefs(): Promise<void> {
    const prefs = await this.prefRequest.run(() => firstValueFrom(this.api.preferences()));
    if (prefs) {
      this.prefs.set(prefs);
    }
  }

  private setUnread(count: number): void {
    this.unread.set(Math.max(0, count));
    this.badge.set(count);
  }
}
