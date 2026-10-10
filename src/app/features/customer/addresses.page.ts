import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent, ModalController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AddressesService } from '../../core/api/addresses.service';
import { Address } from '../../core/models';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
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

      <div class="page">
        <app-hero
          title="Meus endereços"
          lede="Cadastre cada ponto de coleta e de entrega uma vez e use em qualquer frete."
        >
          <button class="btn btn--on-dark" type="button" (click)="openSheet()">
            <ion-icon name="add-outline" aria-hidden="true" /> Novo endereço
          </button>
        </app-hero>

        <app-problem-alert [error]="load.error()" />

        @if (addresses(); as list) {
          @if (list.length === 0 && !load.loading()) {
            <app-empty-state
              title="Nenhum endereço salvo"
              description="Você precisa de pelo menos dois endereços para pedir um frete: uma coleta e uma entrega."
            >
              <button class="btn btn--sm" type="button" (click)="openSheet()">Cadastrar endereço</button>
            </app-empty-state>
          }

          <div class="stack">
            @for (address of list; track address.id) {
              <article class="card stack">
                <div class="row row--between">
                  <h3>{{ address.label }}</h3>
                </div>
                <p class="small">{{ street(address) }}</p>
                <p class="muted small">{{ area(address) }} · {{ zip(address) }}</p>
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

  protected readonly load = createRequestState();
  protected readonly addresses = signal<Address[] | null>(null);

  protected readonly street = streetLine;
  protected readonly area = areaLine;
  protected readonly zip = (address: Address) => formatZip(address.zipCode);

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected async openSheet(): Promise<void> {
    const sheet = await this.modals.create({
      component: AddressSheetComponent,
      breakpoints: [0, 0.95],
      initialBreakpoint: 0.95,
      cssClass: 'sheet',
    });
    await sheet.present();
    const { role } = await sheet.onDidDismiss();
    if (role === 'created') {
      await this.toast.show('Endereço salvo.');
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
