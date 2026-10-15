import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { ToastService } from '../../core/services/toast.service';
import { Loader } from '../../shared/components/loader/loader';
import { PlayerAvatar } from '../../shared/components/player-avatar/player-avatar';
import { User, UserStatistics } from '../../shared/models/user.model';

/** XP needed to reach a level: 100 · (level − 1)². Must match backend `level_for_xp`. */
export const xpForLevel = (level: number) => 100 * (level - 1) ** 2;

const AVATARS = ['🦊', '🐯', '🦉', '🐼', '🦁', '🐺', '🐸', '🐙', '🦄', '🐲', '👑', '🃏'];

@Component({
  selector: 'app-profile',
  imports: [RouterLink, Loader, PlayerAvatar, DecimalPipe, DatePipe],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfilePage {
  private readonly stats = inject(StatisticsService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  /** Optional `?u=username` to view someone else's public profile. */
  readonly u = input<string | undefined>();
  readonly data = signal<UserStatistics | null>(null);
  readonly error = signal<string | null>(null);
  readonly pickingAvatar = signal(false);
  readonly avatars = AVATARS;

  readonly isSelf = computed(() => !this.u() || this.u() === this.auth.user()?.username);
  readonly user = computed(() => (this.isSelf() ? (this.auth.user() ?? this.data()?.user) : this.data()?.user) ?? null);
  readonly progress = computed(() => {
    const u = this.user();
    if (!u) return { pct: 0, current: 0, needed: 0 };
    const start = xpForLevel(u.level);
    const end = xpForLevel(u.level + 1);
    return { pct: Math.min(100, ((u.xp - start) / (end - start)) * 100), current: u.xp - start, needed: end - start };
  });
  readonly favourites = computed(() => [...(this.data()?.games ?? [])].sort((a, b) => b.gamesPlayed - a.gamesPlayed).slice(0, 3));
  readonly unlocked = computed(() => (this.data()?.achievements ?? []).filter((a) => a.unlockedAt).length);

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const name = this.u() ?? this.auth.user()?.username ?? 'Profile';
      seo.apply({ title: `${name} | CardArena`, description: `${name}'s CardArena profile.`, path: '/profile', noindex: true });
      this.load();
    });
  }

  load(): void {
    this.data.set(null);
    this.error.set(null);
    const req = this.isSelf() ? this.stats.myStatistics() : this.stats.userStatistics(this.u()!);
    req.subscribe({ next: (d) => this.data.set(d), error: (e: Error) => this.error.set(e.message) });
  }

  setAvatar(avatar: string): void {
    this.api.put<User>('/users/me', { avatarUrl: avatar }).subscribe({
      next: (u) => {
        this.auth.user.set(u);
        this.pickingAvatar.set(false);
        this.toast.success('Avatar updated');
      },
      error: (e: Error) => this.toast.error('Could not update avatar', e.message),
    });
  }
}
