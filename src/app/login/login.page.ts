import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonSpinner } from '@ionic/angular/standalone';
import { AuthService, errorText } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';

@Component({
  imports: [FormsModule, RouterLink, IonSpinner],
  templateUrl: './login.page.html',
})
export class LoginPage {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  readonly resetPage = inject(ActivatedRoute).snapshot.routeConfig?.path === 'reset-password';
  readonly forgot = signal(false);
  readonly pending = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  email = '';
  password = '';

  toggleForgot(): void {
    this.error.set('');
    this.message.set('');
    this.password = '';
    this.forgot.update(value => !value);
  }

  async submit(): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    this.error.set('');
    this.message.set('');
    try {
      if (this.resetPage) {
        await this.auth.replacePassword(this.password);
        await this.router.navigateByUrl('/sign-in', { state: { passwordUpdated: true } });
      } else if (this.forgot()) {
        await this.auth.requestReset(this.email);
        this.message.set('If this email is registered, a password reset link will arrive shortly.');
      } else {
        const profile = await this.auth.signIn(this.email, this.password);
        await this.router.navigate(['/portal', profile.role, 'overview']);
      }
    } catch (error) {
      this.error.set(errorText(error));
    } finally {
      this.pending.set(false);
    }
  }

  constructor() {
    if (history.state?.passwordUpdated) this.message.set('Password updated. Sign in with your new password.');
  }
}
