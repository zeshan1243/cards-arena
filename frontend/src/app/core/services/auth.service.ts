import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { AuthResponse, User } from '../../shared/models/user.model';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

/** Set while a refresh cookie probably exists, so guests don't make a pointless /auth/refresh call. */
const SESSION_HINT = 'session';

/**
 * Access token lives in memory only; the refresh token is an HTTP-only cookie
 * set by the backend (spec §68), so a page reload restores the session via /auth/refresh.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);

  private readonly token = signal<string | null>(null);
  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly ready = signal(false);

  private refreshInFlight: Observable<string | null> | null = null;

  accessToken(): string | null {
    return this.token();
  }

  /** Called once on startup. Never fails — a guest session is a valid outcome. */
  restoreSession(): Observable<void> {
    if (!this.storage.get(SESSION_HINT, false)) {
      this.ready.set(true);
      return of(undefined);
    }
    return this.refresh().pipe(
      map(() => undefined),
      finalize(() => this.ready.set(true)),
    );
  }

  register(username: string, email: string, password: string): Observable<User> {
    return this.api.post<AuthResponse>('/auth/register', { username, email, password }).pipe(map((r) => this.accept(r)));
  }

  login(login: string, password: string): Observable<User> {
    return this.api.post<AuthResponse>('/auth/login', { login, password }).pipe(map((r) => this.accept(r)));
  }

  logout(): void {
    this.api.post('/auth/logout').pipe(catchError(() => of(null))).subscribe();
    this.clear();
    void this.router.navigateByUrl('/');
  }

  /** Exchange the refresh cookie for a new access token. Shared between concurrent callers. */
  refresh(): Observable<string | null> {
    this.refreshInFlight ??= this.api.post<AuthResponse>('/auth/refresh').pipe(
      map((r) => {
        this.accept(r);
        return r.accessToken;
      }),
      catchError(() => {
        this.clear();
        return of(null);
      }),
      finalize(() => (this.refreshInFlight = null)),
      shareReplay(1),
    );
    return this.refreshInFlight;
  }

  reloadUser(): Observable<User | null> {
    return this.api.get<User>('/auth/me').pipe(
      tap((u) => this.user.set(u)),
      catchError(() => of(null)),
    );
  }

  private accept(res: AuthResponse): User {
    this.storage.set(SESSION_HINT, true);
    this.token.set(res.accessToken);
    this.user.set(res.user);
    return res.user;
  }

  private clear(): void {
    this.storage.remove(SESSION_HINT);
    this.token.set(null);
    this.user.set(null);
  }
}
