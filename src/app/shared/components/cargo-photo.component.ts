import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FreightsService } from '../../core/api/freights.service';

@Component({
  selector: 'app-cargo-photo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url(); as src) {
      <img class="photo" [src]="src" alt="Foto da carga" />
    }
  `,
  styles: `
    .photo {
      display: block;
      width: 100%;
      max-height: 240px;
      object-fit: cover;
      border-radius: 14px;
    }
  `,
})
export class CargoPhotoComponent {
  private readonly freights = inject(FreightsService);

  readonly freightId = input.required<string>();

  protected readonly url = signal<string | null>(null);
  private current: string | null = null;

  constructor() {
    effect((onCleanup) => {
      const id = this.freightId();
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });
      this.freights.cargoPhoto(id).subscribe({
        next: (blob) => {
          if (!cancelled) {
            this.release();
            this.current = URL.createObjectURL(blob);
            this.url.set(this.current);
          }
        },
        error: () => {
          if (!cancelled) {
            this.url.set(null);
          }
        },
      });
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private release(): void {
    if (this.current) {
      URL.revokeObjectURL(this.current);
      this.current = null;
    }
  }
}
