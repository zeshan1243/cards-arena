import { Component, ElementRef, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, filter, of, switchMap } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { GameService } from '../../../core/services/game.service';
import { PlayerAvatar } from '../player-avatar/player-avatar';

interface PlayerHit {
  username: string;
  level: number;
  avatarUrl: string | null;
}

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, PlayerAvatar],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  readonly auth = inject(AuthService);
  private readonly games = inject(GameService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly menuOpen = signal(false);
  readonly searchOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly query = signal('');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly gameHits = computed(() => (this.query().trim() ? this.games.query('all', 'popular', this.query()).slice(0, 5) : []));

  readonly playerHits = toSignal(
    toObservable(this.query).pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) =>
        q.trim().length < 2 ? of([]) : this.api.get<PlayerHit[]>('/users/search', { q: q.trim() }).pipe(catchError(() => of([]))),
      ),
    ),
    { initialValue: [] as PlayerHit[] },
  );

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuOpen.set(false);
      this.closeSearch();
      this.userMenuOpen.set(false);
    });
    effect(() => {
      if (this.searchOpen()) queueMicrotask(() => this.searchInput()?.nativeElement.focus());
    });
  }

  toggleSearch(): void {
    this.searchOpen.update((v) => !v);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
    this.query.set('');
  }

  goFirstResult(): void {
    const g = this.gameHits()[0];
    if (g) void this.router.navigate(['/games', g.slug]);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeSearch();
    this.menuOpen.set(false);
    this.userMenuOpen.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      e.preventDefault();
      this.searchOpen.set(true);
    }
  }
}
