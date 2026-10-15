import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';

const matchPasswords = (group: AbstractControl): ValidationErrors | null =>
  group.get('password')?.value === group.get('confirm')?.value ? null : { mismatch: true };

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="section container auth">
      <div class="panel card">
        <h1>Create your account</h1>
        <ul class="perks">
          <li>📊 Save your statistics and game history</li>
          <li>⭐ Earn XP and level up</li>
          <li>🏆 Unlock achievements and climb leaderboards</li>
        </ul>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="username">Username</label>
            <input id="username" class="input" formControlName="username" autocomplete="username" autofocus />
            @if (touched('username') && form.controls.username.invalid) {
              <span class="error">3–30 characters: letters, numbers and underscores.</span>
            }
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" class="input" type="email" formControlName="email" autocomplete="email" />
            @if (touched('email') && form.controls.email.invalid) { <span class="error">Enter a valid email address.</span> }
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" class="input" type="password" formControlName="password" autocomplete="new-password" />
            @if (touched('password') && form.controls.password.invalid) { <span class="error">At least 8 characters.</span> }
          </div>
          <div class="field">
            <label for="confirm">Confirm password</label>
            <input id="confirm" class="input" type="password" formControlName="confirm" autocomplete="new-password" />
            @if (touched('confirm') && form.hasError('mismatch')) { <span class="error">Passwords do not match.</span> }
          </div>
          @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
          <button class="btn btn-primary btn-block btn-lg" type="submit" [disabled]="loading()">{{ loading() ? 'Creating account…' : 'Create account' }}</button>
        </form>
        <p class="switch">Already have an account? <a routerLink="/login">Log in</a></p>
      </div>
    </section>
  `,
  styleUrl: './auth.scss',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_]{3,30}$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: matchPasswords },
  );
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private readonly submitted = signal(false);

  constructor() {
    inject(SeoService).apply({ title: 'Create account | CardArena', description: 'Create a free CardArena account.', path: '/register', noindex: true });
  }

  touched(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.touched || this.submitted();
  }

  submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { username, email, password } = this.form.getRawValue();
    this.auth.register(username.trim(), email.trim(), password).subscribe({
      next: (u) => {
        this.toast.success(`Welcome to CardArena, ${u.username}!`);
        void this.router.navigateByUrl('/play/bhabhi-thulla');
      },
      error: (e: Error) => {
        this.loading.set(false);
        this.error.set(e.message);
      },
    });
  }
}
