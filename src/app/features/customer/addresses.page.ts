import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent, ModalController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AddressesService } from '../../core/api/addresses.service';
import { Address } from '../../core/models';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { areaLine, formatZip, streetLine } from '../../core/util/address-format';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { AddressSheetComponent } from './address-sheet.component';

/** The customer's saved addresses. Each freight stop points at one of them. */
@Component({
  selector: 'app-addresses-page',
  imports: [
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    EmptyStateComponent,
    HeroComponent,
    ProblemAlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide">
        <app-hero
          title="Meus endereços"
          lede="Cadastre cada ponto de coleta e de entrega uma vez e use em qualquer frete."
        >
          <button class="btn btn--on-dark" type="button" (click)="openSheet()">
            <ion-icon name="add-outline" aria-hidden="true" /> Novo endereço
          </button>
        </app-hero>

        <app-problem-alert [error]="load.error()" />
        <app-problem-alert [error]="action.error()" />

        @if (addresses(); as list) {
          @if (list.length === 0 && !load.loading()) {
            <app-empty-state
              title="Nenhum endereço salvo"
              description="Você precisa de pelo menos dois endereços para pedir um frete: uma coleta e uma entrega."
            >
              <button class="btn btn--sm" type="button" (click)="openSheet()">Cadastrar endereço</button>
            </app-empty-state>
          }

          <div class="grid-cards">
            @for (address of list; track address.id) {
              <article class="card stack">
                <div class="row row--between">
                  <h3>{{ address.label }}</h3>
                  @if (hasPosition(address)) {
                    <span class="chip chip--outline"><ion-icon name="location-outline" aria-hidden="true" /> No mapa</span>
                  } @else {
                    <span class="chip chip--muted">Sem posição</span>
                  }
                </div>
                <p class="small">{{ street(address) }}</p>
                <p class="muted small">{{ area(address) }} · {{ zip(address) }}</p>
                @if (!hasPosition(address)) {
                  <p class="field-hint">
                    Sem posição, este endereço não entra na rota desenhada. Edite-o e use "Localizar no mapa".
                  </p>
                }
                <div class="row">
                  <button class="btn btn--ghost btn--sm" type="button" [disabled]="busy() !== null" (click)="openSheet(address)">
                    Editar
                  </button>
                  <button class="btn btn--danger-outline btn--sm" type="button" [disabled]="busy() !== null" (click)="remove(address)">
                    <ion-icon name="trash-outline" aria-hidden="true" /> Excluir
                  </button>
                </div>
              </article>
            }
          </div>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class AddressesPage {
  private readonly api = inject(AddressesService);
  private readonly modals = inject(ModalController);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly load = createRequestState();
  protected readonly action = createRequestState();
  /** The address with a call in flight, so its buttons (and the others') lock. */
  protected readonly busy = signal<string | null>(null);
  protected readonly addresses = signal<Address[] | null>(null);

  protected readonly street = streetLine;
  protected readonly area = areaLine;
  protected readonly hasPosition = (address: Address) => address.latitude !== null && address.longitude !== null;
  protected readonly zip = (address: Address) => formatZip(address.zipCode);

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected async remove(address: Address): Promise<void> {
    const confirmed = await this.confirm.confirm({
      header: 'Excluir endereço?',
      message: `"${address.label}" sai da sua lista. Fretes já concluídos continuam com o histórico.`,
      confirmText: 'Excluir',
      cancelText: 'Manter',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(address.id);
    const done = await this.action.run(async () => {
      await firstValueFrom(this.api.delete(address.id));
      return true;
    });
    this.busy.set(null);
    if (done) {
      await this.toast.show('Endereço excluído.');
    }
    // After address.in_active_use / not_found / request.conflict the list shows what is really there.
    await this.reload();
  }

  protected async openSheet(address: Address | null = null): Promise<void> {
    this.action.clearError();
    const sheet = await this.modals.create({
      component: AddressSheetComponent,
      componentProps: { address },
      breakpoints: [0, 0.95],
      initialBreakpoint: 0.95,
      cssClass: 'sheet',
    });
    await sheet.present();
    const { role } = await sheet.onDidDismiss();
    if (role === 'created' || role === 'updated') {
      await this.toast.show(role === 'created' ? 'Endereço salvo.' : 'Endereço atualizado.');
      await this.reload();
    }
  }

  private async reload(): Promise<void> {
    const list = await this.load.run(() => firstValueFrom(this.api.list()));
    if (list) {
      this.addresses.set(list);
    }
  }
}
