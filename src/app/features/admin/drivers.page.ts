import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../core/api/admin.service';
import { DriverReviewSummary, DriverStatus } from '../../core/models';
import { DRIVER_STATUS_VIEW } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

type ReviewFilter = Extract<DriverStatus, 'PendingReview' | 'Approved' | 'Rejected'>;

/** The driver review queue: pending first, plus the ones already decided. */
@Component({
  selector: 'app-admin-drivers-page',
  imports: [
    DatePipe,
    RouterLink,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    EmptyStateComponent,
    HeroComponent,
    ProblemAlertComponent,
    StatusChipComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide">
        <app-hero
          title="Análise de motoristas"
          lede="Confira CNH, veículos e documentos antes de liberar o motorista para enviar propostas."
        />

        <ion-segment [value]="filter()" (ionChange)="onFilter($event.detail.value)">
          <ion-segment-button value="PendingReview">Pendentes</ion-segment-button>
          <ion-segment-button value="Approved">Aprovados</ion-segment-button>
          <ion-segment-button value="Rejected">Recusados</ion-segment-button>
        </ion-segment>

        <app-problem-alert [error]="load.error()" />

        @if (drivers(); as list) {
          @if (list.length === 0 && !load.loading()) {
            <app-empty-state title="Ninguém nesta lista" description="Quando houver motoristas nesta etapa, eles aparecem aqui." />
          }
          <div class="grid-cards">
            @for (driver of list; track driver.driverId) {
              <a class="card card--link stack" [routerLink]="['/admin/drivers', driver.driverId]">
                <div class="row row--between row--wrap">
                  <h3 class="grow break">{{ driver.fullName }}</h3>
                  <app-status-chip [view]="statusView[driver.status]" />
                </div>
                <p class="muted small break">{{ driver.email }} · {{ driver.phoneNumber }}</p>
                @if (driver.lastUpdatedAt; as updated) {
                  <p class="muted small">Atualizado em {{ updated | utc | date: 'dd/MM/yyyy HH:mm' }}</p>
                }
              </a>
            }
          </div>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class AdminDriversPage {
  private readonly admin = inject(AdminService);

  protected readonly statusView = DRIVER_STATUS_VIEW;
  protected readonly load = createRequestState();
  protected readonly filter = signal<ReviewFilter>('PendingReview');
  protected readonly drivers = signal<DriverReviewSummary[] | null>(null);

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected onFilter(value: string | number | null | undefined): void {
    if ((value === 'PendingReview' || value === 'Approved' || value === 'Rejected') && value !== this.filter()) {
      this.filter.set(value);
      this.drivers.set(null);
      void this.reload();
    }
  }

  private async reload(): Promise<void> {
    const status = this.filter();
    const list = await this.load.run(() => firstValueFrom(this.admin.drivers(status)));
    // Ignore an answer that arrives after the admin switched to another tab.
    if (list && status === this.filter()) {
      this.drivers.set(list);
    }
  }
}
