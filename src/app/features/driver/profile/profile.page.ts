import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent, IonSpinner } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverProfileStore } from '../../../core/api/driver-profile.store';
import { DriverService } from '../../../core/api/driver.service';
import { TermsService } from '../../../core/api/terms.service';
import { DriverProfile, MediaFile, Vehicle } from '../../../core/models';
import { DRIVER_STATUS_VIEW } from '../../../core/ui/labels';
import { completeRefresh } from '../../../core/ui/refresher';
import { createRequestState } from '../../../core/ui/request-state';
import { ToastService } from '../../../core/ui/toast.service';
import { Poller } from '../../../core/util/poller';
import { HeroComponent } from '../../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../../shared/components/status-chip.component';
import { UtcPipe } from '../../../shared/pipes/utc.pipe';
import { DocumentsSectionComponent } from './documents-section.component';
import { DriverProfileFormComponent } from './profile-form.component';
import { VehiclesSectionComponent } from './vehicles-section.component';

const REVIEW_POLL_MS = 15_000;

/**
 * Driver onboarding, in the order of the API: terms, profile, vehicles, documents, submit.
 * While the profile is in review the screen polls until the admin decides.
 */
@Component({
  selector: 'app-driver-profile-page',
  imports: [
    DatePipe,
    RouterLink,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    HeroComponent,
    ProblemAlertComponent,
    StatusChipComponent,
    UtcPipe,
    DriverProfileFormComponent,
    VehiclesSectionComponent,
    DocumentsSectionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './profile.page.scss',
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page">
        <app-hero [title]="heroTitle()" [lede]="heroLede()">
          @if (status() === 'Approved') {
            <a class="btn btn--on-dark" routerLink="/driver/freights">Ver fretes abertos</a>
          }
        </app-hero>

        @if (status() === 'Rejected' && profile()?.rejectionReason) {
          <div class="notice notice--error" role="status">
            <strong>Motivo da recusa</strong>
            <p>{{ profile()?.rejectionReason }}</p>
          </div>
        }

        @if (status() === 'PendingReview') {
          <div class="notice row" role="status">
            <ion-spinner name="dots" />
            <span>Aguardando a decisão de um administrador. Você também recebe um e-mail.</span>
          </div>
        }

        <app-problem-alert [error]="load.error()" />

        @if (loaded()) {
          <div class="section-head">
            <div>
              <h2>Seu cadastro</h2>
              <p>Siga os passos na ordem.</p>
            </div>
            @if (status(); as s) {
              <app-status-chip [view]="statusView[s]" />
            }
          </div>

          @if (status() !== 'PendingReview' && status() !== 'Approved') {
            <section class="onboarding-progress" aria-label="Progresso do cadastro">
              <div class="row row--between row--wrap">
                <strong>{{ completedSteps() }} de 5 etapas concluídas</strong>
                <span class="small muted">Próximo: {{ nextStep().label }}</span>
              </div>
              <div
                class="progress"
                role="progressbar"
                aria-label="Etapas concluídas do cadastro"
                aria-valuemin="0"
                aria-valuemax="5"
                [attr.aria-valuenow]="completedSteps()"
              >
                <span [style.width.%]="completedSteps() * 20"></span>
              </div>
              @if (nextStep().key === 'terms') {
                <a class="btn btn--sm btn--dark" routerLink="/terms">Ler e aceitar termos</a>
              } @else {
                <button class="btn btn--sm btn--dark" type="button" (click)="goToNextStep()">
                  {{ nextStep().key === 'submit' ? 'Revisar e enviar' : 'Continuar cadastro' }}
                </button>
              }
            </section>
          }

          <ol class="route">
            <li id="driver-step-terms" class="stop" [class.stop--done]="termsDone()">
              <span class="stop-pin" aria-hidden="true">1</span>
              <div class="stop-body stack">
                <h3>Termos</h3>
                @if (termsDone()) {
                  <p class="small"><ion-icon name="checkmark-circle-outline" aria-hidden="true" /> Todos os termos ativos foram aceitos.</p>
                } @else {
                  <p class="small">Aceite os termos ativos antes de enviar o cadastro.</p>
                  <a class="btn btn--sm btn--dark" routerLink="/terms">Ler e aceitar</a>
                }
              </div>
            </li>

            <li id="driver-step-profile" class="stop" [class.stop--done]="hasProfile()">
              <span class="stop-pin" aria-hidden="true">2</span>
              <div class="stop-body stack">
                <h3>Dados do motorista</h3>
                <p class="small">CPF ou CNPJ, número e categoria da CNH.</p>
                <app-driver-profile-form [profile]="profile() ?? null" [editable]="canEdit()" (saved)="onProfileSaved($event)" />
              </div>
            </li>

            <li id="driver-step-vehicle" class="stop" [class.stop--done]="checklist()?.hasActiveVehicle">
              <span class="stop-pin" aria-hidden="true">3</span>
              <div class="stop-body stack">
                <h3>Veículos</h3>
                <p class="small">Cadastre ao menos um veículo. Placas aceitam ABC1234 e ABC1D23.</p>
                <app-vehicles-section [vehicles]="vehicles()" [enabled]="hasProfile()" (changed)="reloadLists()" />
              </div>
            </li>

            <li id="driver-step-documents" class="stop" [class.stop--done]="checklist()?.hasDocument">
              <span class="stop-pin" aria-hidden="true">4</span>
              <div class="stop-body stack">
                <h3>Documentos</h3>
                <p class="small">Foto da CNH e, se quiser, do veículo.</p>
                <app-documents-section [files]="documents()" [enabled]="hasProfile()" (changed)="reloadLists()" />
              </div>
            </li>

            <li id="driver-step-submit" class="stop" [class.stop--done]="status() === 'PendingReview' || status() === 'Approved'">
              <span class="stop-pin" aria-hidden="true">5</span>
              <div class="stop-body stack">
                <h3>Enviar para análise</h3>

                <ul class="checklist">
                  <li [class.ok]="termsDone()">Termos aceitos</li>
                  <li [class.ok]="checklist()?.hasActiveVehicle">Pelo menos um veículo ativo</li>
                  <li [class.ok]="checklist()?.hasDocument">Pelo menos um documento</li>
                </ul>

                @if (canEdit()) {
                  <app-problem-alert [error]="submitRequest.error()" />
                  <div class="form-actions">
                    <button class="btn" type="button" [disabled]="!isReady() || submitRequest.loading()" (click)="submit()">
                      @if (submitRequest.loading()) {
                        <ion-spinner name="crescent" />
                      }
                      Enviar para análise
                    </button>
                    @if (!isReady()) {
                      <span class="field-hint">Complete os passos acima para liberar o envio.</span>
                    }
                  </div>
                } @else if (profile()?.reviewedAt; as reviewedAt) {
                  <p class="small muted">Última decisão em {{ reviewedAt | utc | date: 'dd/MM/yyyy HH:mm' }}.</p>
                } @else {
                  <p class="small muted">Cadastro enviado. O perfil fica travado até a decisão.</p>
                }
              </div>
            </li>
          </ol>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class DriverProfilePage {
  private readonly store = inject(DriverProfileStore);
  private readonly driver = inject(DriverService);
  private readonly terms = inject(TermsService);
  private readonly toast = inject(ToastService);

  protected readonly statusView = DRIVER_STATUS_VIEW;
  protected readonly load = createRequestState();
  protected readonly submitRequest = createRequestState();

  protected readonly vehicles = signal<Vehicle[]>([]);
  protected readonly documents = signal<MediaFile[]>([]);
  /** How many active terms are still unaccepted. `null` until known. */
  private readonly pendingTerms = signal<number | null>(null);

  protected readonly profile = this.store.profile;
  protected readonly status = this.store.status;
  protected readonly loaded = computed(() => this.store.profile() !== undefined);
  protected readonly hasProfile = computed(() => !!this.store.profile());
  protected readonly checklist = computed(() => this.store.profile()?.checklist ?? null);
  protected readonly termsDone = computed(() => this.pendingTerms() === 0);
  protected readonly nextStep = computed(() => {
    if (!this.termsDone()) return { key: 'terms', label: 'aceitar os termos' } as const;
    if (!this.hasProfile()) return { key: 'profile', label: 'preencher seus dados' } as const;
    if (!this.checklist()?.hasActiveVehicle) return { key: 'vehicle', label: 'cadastrar um veículo' } as const;
    if (!this.checklist()?.hasDocument) return { key: 'documents', label: 'enviar seus documentos' } as const;
    return { key: 'submit', label: 'enviar para análise' } as const;
  });
  protected readonly completedSteps = computed(() =>
    Number(this.termsDone()) +
    Number(this.hasProfile()) +
    Number(!!this.checklist()?.hasActiveVehicle) +
    Number(!!this.checklist()?.hasDocument) +
    Number(this.status() === 'PendingReview' || this.status() === 'Approved'),
  );
  protected readonly isReady = computed(
    () => this.hasProfile() && this.termsDone() && !!this.checklist()?.hasActiveVehicle && !!this.checklist()?.hasDocument,
  );
  protected readonly canEdit = computed(() => {
    const status = this.status();
    return status === null || status === 'Draft' || status === 'Rejected';
  });

  protected readonly heroTitle = computed(() => {
    switch (this.status()) {
      case 'PendingReview':
        return 'Cadastro em análise';
      case 'Approved':
        return 'Cadastro aprovado';
      case 'Rejected':
        return 'Cadastro recusado';
      default:
        return 'Complete seu cadastro';
    }
  });

  protected readonly heroLede = computed(() => {
    switch (this.status()) {
      case 'PendingReview':
        return 'Esta tela se atualiza sozinha enquanto um administrador analisa seus dados.';
      case 'Approved':
        return 'Agora você vê os fretes abertos e envia propostas com o seu preço.';
      case 'Rejected':
        return 'Veja o motivo, corrija o que for preciso e envie de novo.';
      default:
        return 'Cinco passos e um administrador libera os fretes. Antes da aprovação você não vê fretes abertos.';
    }
  });

  private readonly poller = new Poller(() => this.pollReview(), REVIEW_POLL_MS);

  ionViewWillEnter(): void {
    void this.refreshAll();
  }

  ionViewWillLeave(): void {
    this.poller.stop();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.refreshAll();
    completeRefresh(event);
  }

  protected goToNextStep(): void {
    const targetId = `driver-step-${this.nextStep().key}`;
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  protected onProfileSaved(profile: DriverProfile): void {
    this.store.set(profile);
    void this.reloadLists();
    void this.toast.show('Dados salvos.');
  }

  protected async reloadLists(): Promise<void> {
    if (!this.store.profile()) {
      return;
    }
    // The checklist lives on the profile, so read it again with the lists.
    await Promise.all([this.store.load(), this.loadLists(), this.loadPendingTerms()]);
  }

  protected async submit(): Promise<void> {
    const profile = await this.submitRequest.run(() => firstValueFrom(this.driver.submitForReview()));
    if (profile) {
      this.store.set(profile);
      this.syncPolling();
      await this.toast.show('Cadastro enviado para análise.');
    }
  }

  private async refreshAll(): Promise<void> {
    const profile = await this.load.run(() => this.store.load());
    if (profile === undefined) {
      return;
    }
    await Promise.all([this.loadLists(), this.loadPendingTerms()]);
    this.syncPolling();
  }

  private async loadLists(): Promise<void> {
    if (!this.store.profile()) {
      this.vehicles.set([]);
      this.documents.set([]);
      return;
    }
    const lists = await this.load.run(async () => ({
      vehicles: await firstValueFrom(this.driver.vehicles()),
      documents: await firstValueFrom(this.driver.documents()),
    }));
    if (lists) {
      this.vehicles.set(lists.vehicles);
      this.documents.set(lists.documents);
    }
  }

  private async loadPendingTerms(): Promise<void> {
    try {
      const pending = await firstValueFrom(this.terms.pending());
      this.pendingTerms.set(pending.length);
    } catch {
      // Leave the step as "not confirmed" instead of failing the whole screen.
    }
  }

  private syncPolling(): void {
    if (this.status() === 'PendingReview') {
      this.poller.start();
    } else {
      this.poller.stop();
    }
  }

  private async pollReview(): Promise<void> {
    const before = this.status();
    const after = (await this.store.load())?.status ?? null;
    if (before === 'PendingReview' && after !== 'PendingReview') {
      this.syncPolling();
      await this.toast.show(after === 'Approved' ? 'Cadastro aprovado! Já dá para ver fretes.' : 'Seu cadastro foi analisado.');
    }
  }
}
