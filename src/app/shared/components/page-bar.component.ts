import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonBackButton, IonButtons, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/** Top bar of a pushed screen: back button and title, with no chrome. */
@Component({
  selector: 'app-page-bar',
  imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="plain-header" [translucent]="false">
      <ion-toolbar class="plain">
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="backHref()" text="Voltar" />
        </ion-buttons>
        <ion-title>{{ title() }}</ion-title>
      </ion-toolbar>
    </ion-header>
  `,
})
export class PageBarComponent {
  readonly title = input.required<string>();
  readonly backHref = input.required<string>();
}
