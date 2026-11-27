import { DestroyRef, inject, signal } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { errorText } from '../core/auth.service';

export class PageState {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  private readonly toast = inject(ToastController);
  private readonly destroy = inject(DestroyRef);
  private request = 0;

  async load<T>(read: () => Promise<T>, apply: (value: T) => void, showLoading = true): Promise<void> {
    const request = ++this.request;
    if (showLoading) {
      this.loading.set(true);
      this.error.set('');
    }
    try {
      const value = await read();
      if (!this.destroy.destroyed && request === this.request) apply(value);
    } catch (cause) {
      if (!this.destroy.destroyed && request === this.request) this.error.set(errorText(cause));
    } finally {
      if (!this.destroy.destroyed && request === this.request) this.loading.set(false);
    }
  }

  async write(run: () => Promise<void>, message: string): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await run();
      if (!this.destroy.destroyed) {
        const toast = await this.toast.create({ message, duration: 2600, position: 'bottom', cssClass: 'portal-toast' });
        await toast.present();
      }
    } catch (cause) {
      if (!this.destroy.destroyed) this.error.set(errorText(cause));
    } finally {
      if (!this.destroy.destroyed) this.saving.set(false);
    }
  }
}
