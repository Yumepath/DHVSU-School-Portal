import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bookOutline, businessOutline, calendarOutline, checkboxOutline, clipboardOutline, documentTextOutline, gridOutline,
  layersOutline, listOutline, logOutOutline, megaphoneOutline, menuOutline, moonOutline, notificationsOutline, optionsOutline,
  peopleOutline, personCircleOutline, schoolOutline, sunnyOutline, timeOutline,
} from 'ionicons/icons';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService, errorText } from '../core/auth.service';
import { ROLE_LABEL } from '../core/database';
import { ThemeService } from '../core/theme.service';
import { NAVIGATION } from './navigation';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IonIcon],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  readonly roleLabel = ROLE_LABEL;
  readonly groups = computed(() => NAVIGATION[this.auth.profile()?.role ?? 'student']);
  readonly initials = computed(() => this.auth.profile()?.full_name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join(''));
  readonly desktopCollapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly header = signal('Overview');
  readonly error = signal('');

  constructor() {
    addIcons({ bookOutline, businessOutline, calendarOutline, checkboxOutline, clipboardOutline, documentTextOutline, gridOutline,
      layersOutline, listOutline, logOutOutline, megaphoneOutline, menuOutline, moonOutline, notificationsOutline, optionsOutline,
      peopleOutline, personCircleOutline, schoolOutline, sunnyOutline, timeOutline });
    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationEnd) {
        const view = event.urlAfterRedirects.split('/').at(-1)?.split('?')[0];
        this.header.set(this.groups().flatMap(group => group.links).find(link => link.view === view)?.label ?? 'Overview');
        this.mobileOpen.set(false);
      }
    });
    effect(() => {
      if (!this.auth.profile()) void this.router.navigateByUrl('/sign-in');
    });
  }

  toggleMenu(): void {
    if (matchMedia('(max-width: 850px)').matches) this.mobileOpen.update(value => !value);
    else this.desktopCollapsed.update(value => !value);
  }

  async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
      await this.router.navigateByUrl('/sign-in');
    } catch (error) {
      this.error.set(errorText(error));
    }
  }
}
