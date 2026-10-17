import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';

interface Point {
  readonly x: number;
  readonly y: number;
}

const INK = '#0d0d0f';
const LINE_WIDTH = 2.6;

@Component({
  selector: 'app-signature-pad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pad" [class.pad--signed]="signed()">
      <canvas
        #canvas
        class="pad__canvas"
        role="img"
        aria-label="Área para assinar com o dedo"
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up($event)"
        (pointercancel)="up($event)"
      ></canvas>
      @if (!signed()) {
        <span class="pad__hint" aria-hidden="true">Assine aqui</span>
      }
      <span class="pad__line" aria-hidden="true"></span>
    </div>
    <button class="link-btn pad__clear" type="button" [disabled]="!signed()" (click)="clear()">Limpar</button>
  `,
  styles: `
    :host {
      display: block;
    }
    .pad {
      position: relative;
      height: 180px;
      border: 1.5px solid var(--field-line);
      border-radius: 16px;
      background: #fff;
      overflow: hidden;
    }
    .pad--signed {
      border-color: var(--black);
    }
    .pad__canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      touch-action: none;
      cursor: crosshair;
    }
    .pad__hint {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--ink-mute);
      font-size: 15px;
      pointer-events: none;
    }
    .pad__line {
      position: absolute;
      left: 16px;
      right: 16px;
      bottom: 40px;
      border-bottom: 1.5px dashed var(--line);
      pointer-events: none;
    }
    .pad__clear {
      margin-top: 8px;
      font-size: 13px;
    }
    .pad__clear:disabled {
      opacity: 0.4;
    }
  `,
})
export class SignaturePadComponent implements OnDestroy {
  readonly signedChange = output<boolean>();

  protected readonly signed = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private strokes: Point[][] = [];
  private current: Point[] | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private resizer: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.ctx = this.canvas().nativeElement.getContext('2d');
      this.resizer = new ResizeObserver(() => this.fit());
      this.resizer.observe(this.host.nativeElement);
      this.fit();
    });
  }

  ngOnDestroy(): void {
    this.resizer?.disconnect();
  }

  clear(): void {
    this.strokes = [];
    this.current = null;
    this.redraw();
    this.setSigned(false);
  }

  async toBlob(): Promise<Blob | null> {
    if (!this.signed()) {
      return null;
    }
    const source = this.canvas().nativeElement;
    const out = document.createElement('canvas');
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, 0);
    return new Promise((resolve) => out.toBlob((blob) => resolve(blob), 'image/png'));
  }

  protected down(event: PointerEvent): void {
    event.preventDefault();
    (event.target as Element).setPointerCapture(event.pointerId);
    this.current = [this.pointOf(event)];
    this.strokes.push(this.current);
    this.redraw();
  }

  protected move(event: PointerEvent): void {
    if (!this.current) {
      return;
    }
    event.preventDefault();
    this.current.push(this.pointOf(event));
    this.redraw();
  }

  protected up(event: PointerEvent): void {
    if (!this.current) {
      return;
    }
    event.preventDefault();
    this.current = null;
    this.setSigned(this.strokes.some((stroke) => stroke.length > 3));
  }

  private setSigned(value: boolean): void {
    if (this.signed() !== value) {
      this.signed.set(value);
      this.signedChange.emit(value);
    }
  }

  private pointOf(event: PointerEvent): Point {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private fit(): void {
    const canvas = this.canvas().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (width === 0 || height === 0 || (canvas.width === width && canvas.height === height)) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    this.redraw();
  }

  private redraw(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    const canvas = this.canvas().nativeElement;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of this.strokes) {
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, LINE_WIDTH / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length - 1; i++) {
        const mid = { x: (stroke[i].x + stroke[i + 1].x) / 2, y: (stroke[i].y + stroke[i + 1].y) / 2 };
        ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, mid.x, mid.y);
      }
      const last = stroke[stroke.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  }
}
