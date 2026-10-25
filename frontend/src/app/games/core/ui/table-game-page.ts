import { Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { GameService } from '../../../core/services/game.service';
import { SeoService } from '../../../core/services/seo.service';
import { SettingsService } from '../../../core/services/settings.service';
import { GameTimer } from '../../../shared/components/game-timer/game-timer';
import { AdBanner } from '../../../shared/components/ad-banner/ad-banner';
import { Loader } from '../../../shared/components/loader/loader';
import { Modal } from '../../../shared/components/modal/modal';
import { PlayerAvatar } from '../../../shared/components/player-avatar/player-avatar';
import { Difficulty } from '../../../shared/models/game.model';
import { GAME_DEFINITIONS } from '../../registry';
import { SUIT_GLYPH } from '../tricks';
import { ActionPanel } from './action-panel';
import { SeatPosition, seatPositions } from './seat-layout';
import { HUMAN_ID, TableGameStore } from './table-game.store';
import { TableFloor } from './table-floor';
import { TableHand } from './table-hand';
import { TableScores } from './table-scores';
import { TableSeat } from './table-seat';
import { TableTrick } from './table-trick';

const RESULT_COPY = {
  win: { emoji: '🎉', title: 'You win!' },
  loss: { emoji: '😤', title: 'You lose' },
  draw: { emoji: '🤝', title: 'It’s a draw' },
  safe: { emoji: '👏', title: 'Well played' },
} as const;

/** Arrow angle (pointing right = 0°) towards each opponent seat. */
const PASS_ROTATION: Record<SeatPosition, number> = { left: 180, 'top-left': -135, top: -90, 'top-right': -45, right: 0, bottom: 90 };

@Component({
  selector: 'app-table-game-page',
  imports: [AdBanner, RouterLink, Loader, Modal, GameTimer, PlayerAvatar, ActionPanel, TableFloor, TableHand, TableScores, TableSeat, TableTrick],
  providers: [TableGameStore],
  templateUrl: './table-game-page.html',
  styleUrl: './table-game-page.scss',
})
export class TableGamePage {
  readonly store = inject(TableGameStore);
  readonly auth = inject(AuthService);
  readonly accountsEnabled = environment.accountsEnabled;
  readonly settingsSvc = inject(SettingsService);
  private readonly games = inject(GameService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);

  readonly slug = input.required<string>();
  readonly info = computed(() => this.games.bySlug(this.slug()));
  readonly notFound = signal(false);
  readonly rulesOpen = signal(false);
  readonly settingsOpen = signal(false);
  readonly leaveOpen = signal(false);
  readonly scoresOpen = signal(false);
  readonly humanId = HUMAN_ID;
  readonly difficulties: { value: Difficulty; label: string }[] = [
    { value: 'easy', label: 'Easy' },
    { value: 'normal', label: 'Normal' },
    { value: 'hard', label: 'Hard' },
    { value: 'expert', label: 'Expert' },
  ];

  readonly opponents = computed(() => this.store.view()?.players.filter((p) => p.id !== HUMAN_ID) ?? []);
  readonly me = computed(() => this.store.view()?.players.find((p) => p.id === HUMAN_ID) ?? null);
  readonly myTeam = computed(() => this.me()?.team ?? null);
  readonly positions = computed<Record<string, SeatPosition>>(() => {
    const opp = this.opponents();
    const layout = seatPositions(opp.length);
    return Object.fromEntries([[HUMAN_ID, 'bottom' as SeatPosition], ...opp.map((p, i) => [p.id, layout[i]])]);
  });
  /** Card passing (Hearts): arrow pointing at the receiver's seat. */
  readonly passTarget = computed(() => {
    const sel = this.store.selection();
    if (!sel?.targetId || !this.store.isMyTurn()) return null;
    const name = this.store.view()?.players.find((p) => p.id === sel.targetId)?.name ?? '';
    const rotate = PASS_ROTATION[this.positions()[sel.targetId] ?? 'top'];
    return { name, rotate, count: sel.count };
  });
  readonly trumpChip = computed(() => {
    const t = this.store.view()?.trump;
    if (!t) return null;
    return t.hidden ? 'Trump hidden' : t.suit ? `Trump ${SUIT_GLYPH[t.suit]}` : t.label;
  });
  readonly redTrump = computed(() => ['hearts', 'diamonds'].includes(this.store.view()?.trump?.suit ?? ''));
  readonly standings = computed(() => {
    const out = this.store.outcome();
    const v = this.store.view();
    if (!out || !v) return [];
    return [...out.players]
      .sort((a, b) => a.position - b.position || b.score - a.score)
      .map((p) => ({ ...p, name: v.players.find((s) => s.id === p.id)?.name ?? p.id, isYou: p.id === HUMAN_ID }));
  });
  /** Hand-summary lines split into "who" and "what", tinted by whether they were a gain or a loss. */
  readonly summaryLines = computed(() =>
    (this.store.view()?.handSummary?.lines ?? []).map((line) => {
      const i = line.indexOf(': ');
      const label = i > 0 && i < 40 ? line.slice(0, i) : '';
      const text = label ? line.slice(i + 2) : line;
      const bad = /(^|[\s(→])[−-]\d|\b(set|failed|missed|lost|loses)\b/i.test(text);
      const good = !bad && /(^|[\s(→])\+\d|\b(made|wins?|won)\b/i.test(text);
      const summaryRow = /^(match|totals?|score)\b/i.test(label || line);
      const tone = summaryRow ? 'note' : bad ? 'bad' : good ? 'good' : '';
      return { label, text, tone };
    }),
  );

  readonly resultCopy = computed(() => RESULT_COPY[this.store.myOutcome()?.result ?? 'safe']);

  constructor() {
    effect(() => {
      const slug = this.slug();
      const loader = GAME_DEFINITIONS[slug];
      if (!loader) {
        this.notFound.set(true);
        return;
      }
      void loader().then((def) => this.store.configure(def));
      const name = this.info()?.name ?? slug;
      this.seo.apply({
        title: `Play ${name} Online – Free vs AI | CardArena`,
        description: `Play ${name} free in your browser against smart AI opponents. No download, no sign-up required.`,
        path: `/games/${slug}`,
        image: `/og/${slug}.jpg`,
      });
    });
  }

  medal(position: number): string {
    return ({ 1: '🥇', 2: '🥈', 3: '🥉' } as Record<number, string>)[position] ?? `#${position}`;
  }

  confirmLeave(): void {
    this.store.abandon();
    this.store.stop();
    void this.router.navigate(['/games', this.slug()]);
  }

  restart(): void {
    this.settingsOpen.set(false);
    this.store.start();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (this.rulesOpen() || this.settingsOpen() || this.leaveOpen() || !this.store.isMyTurn()) return;
    const target = e.target as HTMLElement;
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName) && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const cards = (this.store.view()?.hand ?? []).filter((c) => this.store.playableIds().has(c.id));
    if (!cards.length || this.store.selection()) return;
    const idx = cards.findIndex((c) => c.id === this.store.selectedIds()[0]);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      this.store.selectedIds.set([(cards[(idx + step + cards.length) % cards.length] ?? cards[0]).id]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.store.playSelected();
    } else if (e.key.toLowerCase() === 'h') {
      this.store.hint();
    }
  }
}
