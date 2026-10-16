import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

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
  protected readonly showSplash = signal(true);

  ngOnInit(): void {
    window.setTimeout(() => this.showSplash.set(false), 2800);
  }
}
