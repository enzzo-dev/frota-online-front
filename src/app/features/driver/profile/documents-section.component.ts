import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { IonIcon, IonSelect, IonSelectOption, IonSpinner } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DriverService } from '../../../core/api/driver.service';
import { SessionService } from '../../../core/auth/session.service';
import { MediaFile, MediaKind } from '../../../core/models';
import { MEDIA_KIND_LABEL } from '../../../core/ui/labels';
import { createRequestState } from '../../../core/ui/request-state';
import { ToastService } from '../../../core/ui/toast.service';
import { ProblemAlertComponent } from '../../../shared/components/problem-alert.component';
import { UtcPipe } from '../../../shared/pipes/utc.pipe';
import {
  ACCEPTED_DOCUMENT_TYPES,
  FileUploader,
  MAX_DOCUMENT_BYTES,
  buildStorageKey,
  formatBytes,
} from './file-uploader';

/** Step 4: the driver's documents and vehicle photos. At least one document is needed to submit. */
@Component({
  selector: 'app-documents-section',
  imports: [DatePipe, FormsModule, IonIcon, IonSelect, IonSelectOption, IonSpinner, ProblemAlertComponent, UtcPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @for (file of files(); track file.id) {
        <div class="card row">
          <div class="grow">
            <p class="strong">{{ kindLabel[file.kind] }}</p>
            <p class="muted small break">
              {{ fileName(file.storageKey) }} · {{ size(file.sizeBytes) }} ·
              {{ file.createdAt | utc | date: 'dd/MM/yyyy' }}
            </p>
          </div>
        </div>
      } @empty {
        <p class="muted small">Nenhum documento registrado ainda.</p>
      }

      <div class="card stack">
        <ion-select
          label="Tipo de arquivo"
          labelPlacement="stacked"
          fill="outline"
          interface="action-sheet"
          cancelText="Cancelar"
          [value]="kind()"
          (ionChange)="onKindChange($event.detail.value)"
        >
          @for (option of kinds; track option) {
            <ion-select-option [value]="option">{{ kindLabel[option] }}</ion-select-option>
          }
        </ion-select>

        <label class="btn btn--ghost btn--sm file-pick" [class.is-disabled]="!enabled()">
          <ion-icon name="add-outline" aria-hidden="true" />
          {{ picked() ? picked()!.name : 'Escolher foto ou PDF' }}
          <input
            type="file"
            class="sr-only"
            accept="image/jpeg,image/png,application/pdf"
            [disabled]="!enabled()"
            (change)="onPick($event)"
          />
        </label>
        <p class="field-hint">JPEG, PNG ou PDF, até 10 MB.</p>

        @if (!uploader.storesFiles) {
          <div class="notice" role="note">
            O envio do arquivo para o armazenamento ainda não existe na API. Por enquanto o app registra
            apenas a referência (chave, tipo e tamanho) do arquivo escolhido.
          </div>
        }

        @if (localError()) {
          <div class="notice notice--error" role="alert">{{ localError() }}</div>
        }
        <app-problem-alert [error]="request.error()" />

        <div class="form-actions">
          <button class="btn" type="button" [disabled]="!picked() || request.loading() || !enabled()" (click)="register()">
            @if (request.loading()) {
              <ion-spinner name="crescent" />
            }
            Registrar arquivo
          </button>
          @if (!enabled()) {
            <span class="field-hint">Salve seus dados (passo 2) antes de enviar arquivos.</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .file-pick {
      position: relative;
      justify-content: flex-start;
      overflow: hidden;
      max-width: 100%;
    }

    .file-pick.is-disabled {
      opacity: 0.5;
      pointer-events: none;
    }
  `,
})
export class DocumentsSectionComponent {
  private readonly driver = inject(DriverService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  protected readonly uploader = inject(FileUploader);

  readonly files = input.required<readonly MediaFile[]>();
  readonly enabled = input(true);
  readonly changed = output<void>();

  protected readonly kinds: readonly MediaKind[] = ['DriverDocument', 'VehiclePhoto'];
  protected readonly kindLabel = MEDIA_KIND_LABEL;
  protected readonly kind = signal<MediaKind>('DriverDocument');
  protected readonly picked = signal<File | null>(null);
  protected readonly localError = signal<string | null>(null);
  protected readonly request = createRequestState();

  protected readonly userId = computed(() => this.session.user()?.id ?? '');

  protected fileName(storageKey: string): string {
    return storageKey.split('/').pop() ?? storageKey;
  }

  protected size(bytes: number): string {
    return formatBytes(bytes);
  }

  protected onKindChange(value: unknown): void {
    if (value === 'DriverDocument' || value === 'VehiclePhoto') {
      this.kind.set(value);
    }
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.localError.set(null);
    if (!file) {
      this.picked.set(null);
      return;
    }
    if (!(ACCEPTED_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
      this.picked.set(null);
      this.localError.set('Envie um arquivo JPEG, PNG ou PDF.');
      input.value = '';
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      this.picked.set(null);
      this.localError.set('O arquivo passa de 10 MB.');
      input.value = '';
      return;
    }
    this.picked.set(file);
  }

  protected async register(): Promise<void> {
    const file = this.picked();
    if (!file) {
      return;
    }
    const storageKey = buildStorageKey(this.userId(), file.name);
    const result = await this.request.run(async () => {
      await this.uploader.upload(file, storageKey);
      return firstValueFrom(
        this.driver.registerDocument({
          kind: this.kind(),
          storageKey,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      );
    });
    if (result) {
      this.picked.set(null);
      await this.toast.show('Arquivo registrado.');
      this.changed.emit();
    }
  }
}
