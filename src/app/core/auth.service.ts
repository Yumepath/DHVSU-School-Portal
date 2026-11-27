import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../environments/supabase.generated';
import { Database, Profile } from './database';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  readonly configured = Boolean(config.url && config.key);
  readonly client = createClient<Database>(
    config.url || 'http://127.0.0.1:54321',
    config.key || 'unconfigured',
    { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
  );
  readonly profile = signal<Profile | null>(null);
  readonly recovery = signal(false);
  readonly ready: Promise<void>;
  private request = 0;
  private signingIn = false;
  private profileLoad?: Promise<void>;

  constructor() {
    this.client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') this.recovery.set(true);
      if (event === 'SIGNED_OUT') {
        this.request++;
        this.profileLoad = undefined;
        this.profile.set(null);
        this.recovery.set(false);
        if (this.router.url.startsWith('/portal')) void this.router.navigateByUrl('/sign-in');
      }
      if (event === 'SIGNED_IN' && !this.signingIn && session?.user.id !== this.profile()?.id) {
        setTimeout(() => { void this.refreshProfile().catch(() => undefined); });
      }
    });
    this.ready = this.configured ? this.refreshProfile().catch(() => undefined) : Promise.resolve();
  }

  refreshProfile(): Promise<void> {
    if (this.profileLoad) return this.profileLoad;
    const pending = this.readProfile().finally(() => {
      if (this.profileLoad === pending) this.profileLoad = undefined;
    });
    this.profileLoad = pending;
    return pending;
  }

  private async readProfile(): Promise<void> {
    const request = ++this.request;
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      if (request === this.request) this.profile.set(null);
      return;
    }
    const result = await this.client.from('profiles')
      .select('*').eq('id', data.session.user.id).eq('active', true).maybeSingle();
    if (result.error) throw result.error;
    if (request === this.request) this.profile.set(result.data);
  }

  async signIn(email: string, password: string): Promise<Profile> {
    if (!this.configured) throw new Error('Configure the portal connection before signing in.');
    this.signingIn = true;
    try {
      const { error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await this.refreshProfile();
      const profile = this.profile();
      if (!profile) {
        await this.signOut();
        throw new Error('This account has no active portal access. Contact an administrator.');
      }
      return profile;
    } finally {
      this.signingIn = false;
    }
  }

  async requestReset(email: string): Promise<void> {
    if (!this.configured) throw new Error('Configure the portal connection before requesting a reset.');
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw error;
  }

  async replacePassword(password: string): Promise<void> {
    if (!this.recovery()) throw new Error('Open a valid password reset link in this browser.');
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw error;
    await this.signOut();
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    this.profile.set(null);
    this.recovery.set(false);
  }
}

export function errorText(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') {
    return cause.message;
  }
  return 'The operation could not be completed. Try again.';
}
