import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverFeesService } from '../../core/api/driver-fees.service';
import { FeeStatement } from '../../core/models';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

/** What the driver owes the platform: one fee per delivered run, reduced when an admin records a settlement. */
@Component({
  selector: 'app-fees-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    EmptyStateComponent,
    PageBarComponent,
    ProblemAlertComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .balance {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: clamp(2.2rem, 8vw, 3.2rem);
      letter-spacing: -0.03em;
      line-height: 1.05;
    }
    .entry__chip {
      margin-right: 8px;
    }
    .entry__amount {
      font-family: var(--font-mono);
      font-weight: 700;
      white-space: nowrap;
    }
    .entry__amount--settled {
      color: var(--ink-soft);
    }
  `,
  template: `
    <app-page-bar title="Taxas da plataforma" backHref="/driver/deliveries" />

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide page--with-bar">
        <app-problem-alert [error]="load.error()" />

        @if (statement(); as s) {
          <section class="dark-panel stack" aria-label="Saldo em aberto">
            <p class="muted small">Saldo em aberto</p>
            <p class="balance">{{ s.balance | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</p>
            <p class="small">
              @if (s.balance > 0) {
                É o que você deve à plataforma. O acerto é registrado por um administrador depois que você paga.
              } @else {
                Nada em aberto. Novas taxas aparecem aqui a cada entrega concluída.
              }
            </p>
          </section>

          <div class="stats stats--2">
            <div class="stat">
              <span class="stat__num">{{ s.totalAccrued | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
              <span class="stat__label">Taxas lançadas</span>
            </div>
            <div class="stat">
              <span class="stat__num">{{ s.totalSettled | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
              <span class="stat__label">Já acertado</span>
            </div>
          </div>

          <section class="stack">
            <h2>Extrato</h2>
            <p class="muted small">Os 200 lançamentos mais recentes, do mais novo para o mais antigo.</p>

            @if (s.entries.length === 0) {
              <app-empty-state title="Nenhum lançamento" description="A taxa de cada entrega concluída aparece aqui." />
            }

            <div class="stack">
              @for (entry of s.entries; track entry.id) {
                <article class="card row row--between">
                  <div class="grow">
                    <p class="strong break">{{ entry.description }}</p>
                    <p class="muted small">
                      <span class="chip entry__chip" [class.chip--red]="entry.type === 'FeeAccrued'" [class.chip--outline]="entry.type === 'FeeSettled'">
                        {{ entry.type === 'FeeAccrued' ? 'Taxa' : 'Acerto' }}
                      </span>
                      {{ entry.createdAt | utc | date: "dd/MM/yyyy 'às' HH:mm" }}
                    </p>
                  </div>
                  <span class="entry__amount" [class.entry__amount--settled]="entry.type === 'FeeSettled'">
                    {{ entry.type === 'FeeSettled' ? '−' : '+' }} {{ entry.amount | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                  </span>
                </article>
              }
            </div>
          </section>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class FeesPage {
  private readonly api = inject(DriverFeesService);

  protected readonly load = createRequestState();
  protected readonly statement = signal<FeeStatement | null>(null);

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  private async reload(): Promise<void> {
    const statement = await this.load.run(() => firstValueFrom(this.api.statement()));
    if (statement) {
      this.statement.set(statement);
    }
  }
}
