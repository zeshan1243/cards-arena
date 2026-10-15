import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="section container auth">
      <div class="panel card">
        <h1>Welcome back</h1>
        <p class="text-secondary">Log in to track your stats, XP and achievements.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="login">Username or email</label>
            <input id="login" class="input" formControlName="login" autocomplete="username" autofocus />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" class="input" type="password" formControlName="password" autocomplete="current-password" />
          </div>
          @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
          <button class="btn btn-primary btn-block btn-lg" type="submit" [disabled]="loading()">{{ loading() ? 'Logging in…' : 'Log in' }}</button>
        </form>
        <p class="switch">New to CardArena? <a routerLink="/register">Create a free account</a></p>
      </div>
    </section>
  `,
  styleUrl: '../register/auth.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly returnUrl = input<string>('/profile');

  readonly form = inject(FormBuilder).nonNullable.group({
    login: ['', Validators.required],
    password: ['', Validators.required],
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    inject(SeoService).apply({ title: 'Log in | CardArena', description: 'Log in to CardArena.', path: '/login', noindex: true });
  }

  submit(): void {
    if (this.form.invalid) {
      this.error.set('Enter your username or email and password.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { login, password } = this.form.getRawValue();
    this.auth.login(login.trim(), password).subscribe({
      next: (u) => {
        this.toast.success(`Welcome back, ${u.username}!`);
        void this.router.navigateByUrl(this.returnUrl() || '/profile');
      },
      error: (e: Error) => {
        this.loading.set(false);
        this.error.set(e.message);
      },
    });
  }
}
