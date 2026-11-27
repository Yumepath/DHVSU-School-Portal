import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal(localStorage.getItem('dhvsu-theme')
    ? localStorage.getItem('dhvsu-theme') === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches);

  constructor() {
    this.apply();
  }

  toggle(): void {
    this.dark.update(value => !value);
    localStorage.setItem('dhvsu-theme', this.dark() ? 'dark' : 'light');
    this.apply();
  }

  private apply(): void {
    document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light';
    document.documentElement.classList.toggle('ion-palette-dark', this.dark());
  }
}
