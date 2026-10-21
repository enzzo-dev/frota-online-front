import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { HardwareBackService } from './core/navigation/hardware-back.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-app>
      <ion-router-outlet />
      @if (showSplash()) {
        <div class="splash-intro" role="status" aria-label="Frota Online">
          <img src="icons/splash-intro.svg" alt="Frota Online" />
        </div>
      }
    </ion-app>
  `,
  styles: `
    .splash-intro {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #ffffff;
    }

    .splash-intro img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class App implements OnInit {
  private readonly hardwareBack = inject(HardwareBackService);

  protected readonly showSplash = signal(true);

  ngOnInit(): void {
    this.hardwareBack.start();
    window.setTimeout(() => this.showSplash.set(false), 2800);
  }
}
