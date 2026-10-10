import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../core/api/admin.service';
import { DriverReviewDetail } from '../../core/models';
import { DRIVER_STATUS_VIEW, MEDIA_KIND_LABEL, VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { ConfirmService } from '../../core/ui/confirm.service';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

/** One driver under review: identity, CNH, vehicles and files, with approve and reject. */
@Component({
  selector: 'app-driver-review-page',
  imports: [
    DatePipe,
    DecimalPipe,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    PageBarComponent,
    ProblemAlertComponent,
    StatusChipComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-bar title="Motorista" backHref="/admin/drivers" />

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--with-bar">
        <app-problem-alert [error]="load.error()" />
        <app-problem-alert [error]="decision.error()" />

        @if (driver(); as d) {
          <section class="dark-panel stack">
            <div class="row row--between row--wrap">
              <h2 class="grow break">{{ d.fullName }}</h2>
              <app-status-chip [view]="statusView[d.status]" />
            </div>
            <p class="muted small break">{{ d.email }} · {{ d.phoneNumber }}</p>
          </section>

          <section class="panel stack">
            <h3>Documentos pessoais</h3>
            <dl class="kv">
              <dt>CPF/CNPJ</dt>
              <dd>{{ d.taxId }}</dd>
              <dt>CNH</dt>
              <dd>{{ d.cnhNumber }}</dd>
              <dt>Categoria</dt>
              <dd>{{ d.cnhCategory }}</dd>
            </dl>
          </section>

          <section class="stack">
            <h3>Veículos</h3>
            @for (vehicle of d.vehicles; track vehicle.id) {
              <article class="card row row--between">
                <div>
                  <p class="strong">{{ typeLabel[vehicle.type] }} · {{ vehicle.plate }}</p>
                  <p class="muted small">
                    {{ vehicle.model }} · {{ vehicle.year }} · {{ vehicle.capacityKg | number: '1.0-0' : 'pt-BR' }} kg
                  </p>
                </div>
                @if (!vehicle.isActive) {
                  <span class="chip chip--muted">Inativo</span>
                }
              </article>
            } @empty {
              <p class="notice">Nenhum veículo cadastrado.</p>
            }
          </section>

          <section class="stack">
            <h3>Arquivos</h3>
            @for (file of d.files; track file.id) {
              <article class="card">
                <p class="strong">{{ kindLabel[file.kind] }}</p>
                <p class="muted small break">{{ file.storageKey }} · {{ file.contentType }}</p>
                <p class="muted small">{{ file.createdAt | utc | date: 'dd/MM/yyyy HH:mm' }}</p>
              </article>
            } @empty {
              <p class="notice">Nenhum arquivo registrado.</p>
            }
          </section>

          @if (d.rejectionReason) {
            <p class="notice notice--error">Motivo da recusa: {{ d.rejectionReason }}</p>
          }

          @if (d.status === 'PendingReview') {
            <div class="form-actions">
              <button class="btn grow" type="button" [disabled]="decision.loading()" (click)="approve(d)">Aprovar</button>
              <button class="btn btn--ghost grow" type="button" [disabled]="decision.loading()" (click)="reject(d)">Recusar</button>
            </div>
          } @else if (d.reviewedAt; as reviewed) {
            <p class="muted small">Analisado em {{ reviewed | utc | date: 'dd/MM/yyyy HH:mm' }}</p>
          }
        } @else if (load.loading()) {
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class DriverReviewPage {
  private readonly admin = inject(AdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly driverId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly statusView = DRIVER_STATUS_VIEW;
  protected readonly typeLabel = VEHICLE_TYPE_LABEL;
  protected readonly kindLabel = MEDIA_KIND_LABEL;
  protected readonly load = createRequestState();
  protected readonly decision = createRequestState();
  protected readonly driver = signal<DriverReviewDetail | null>(null);

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected async approve(driver: DriverReviewDetail): Promise<void> {
    const confirmed = await this.confirm.confirm({
      header: 'Aprovar motorista?',
      message: `${driver.fullName} poderá ver fretes abertos e enviar propostas.`,
      confirmText: 'Aprovar',
      cancelText: 'Voltar',
    });
    if (!confirmed) {
      return;
    }
    const done = await this.decision.run(async () => {
      await firstValueFrom(this.admin.approveDriver(driver.driverId));
      return true;
    });
    if (done) {
      await this.toast.show('Motorista aprovado.');
      await this.reload();
    }
  }

  protected async reject(driver: DriverReviewDetail): Promise<void> {
    const reason = await this.confirm.promptText({
      header: 'Recusar motorista',
      message: 'O motivo é mostrado ao motorista para que ele possa corrigir o cadastro.',
      label: 'Motivo',
      placeholder: 'Ex.: foto da CNH ilegível',
      confirmText: 'Recusar',
      cancelText: 'Voltar',
      destructive: true,
      maxLength: 500,
    });
    if (reason === null) {
      return;
    }
    const done = await this.decision.run(async () => {
      await firstValueFrom(this.admin.rejectDriver(driver.driverId, reason));
      return true;
    });
    if (done) {
      await this.toast.show('Motorista recusado.');
      await this.reload();
    }
  }

  private async reload(): Promise<void> {
    const detail = await this.load.run(() => firstValueFrom(this.admin.driver(this.driverId)));
    if (detail) {
      this.driver.set(detail);
    }
  }
}
