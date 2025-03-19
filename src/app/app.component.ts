import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['home.page.scss'],
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {}
}