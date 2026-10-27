import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsService } from '../../../core/services/settings.service';
import { SoundService } from '../../../core/services/sound.service';
import { StatisticsService } from '../../../core/services/statistics.service';
import { StorageService } from '../../../core/services/storage.service';
import { ToastService } from '../../../core/services/toast.service';
import { Card } from '../../../shared/models/card.model';
import { BotProfile } from '../../../shared/models/game.model';
import { FinishSessionResponse } from '../../../shared/models/user.model';
import { botsFor } from '../bots';
import { Rng, seededRng } from '../deck';
import {
  Banner,
  CardSelection,
  GameAction,
  GameDefinition,
  GameOutcome,
  GameSettings,
  IllegalActionError,
  LegalAction,
  SeatConfig,
  TableGameEngine,
  TableView,
  TrickPlay,
} from '../table-game';

export const HUMAN_ID = 'you';
export type TablePhase = 'setup' | 'loading' | 'playing' | 'finished';

const SPEED = { slow: 1.5, normal: 1, fast: 0.5 } as const;
const TURN_SECONDS = 30;
const LOADING_STEPS = ['Preparing table…', 'Shuffling cards…', 'Dealing cards…'];

/**
 * Drives any `TableGameEngine`: bots, pacing, turn timer, hand summaries
 * and result recording. Game screens only read signals and call actions.
 */
@Injectable()
export class TableGameStore implements OnDestroy {
  private readonly settingsSvc = inject(SettingsService);
  private readonly storage = inject(StorageService);
  private readonly sound = inject(SoundService);
  private readonly auth = inject(AuthService);
  private readonly stats = inject(StatisticsService);
  private readonly toast = inject(ToastService);

  private engine: TableGameEngine | null = null;
  private bots = new Map<string, BotProfile>();
  private rng: Rng = Math.random;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private countdown: ReturnType<typeof setInterval> | null = null;
  private generation = 0;
  private startedAt = 0;
  private sessionId: string | null = null;
  private lastBannerId = 0;

  readonly def = signal<GameDefinition | null>(null);
  readonly phase = signal<TablePhase>('setup');
  readonly loadingStep = signal(LOADING_STEPS[0]);
  readonly view = signal<TableView | null>(null);
  readonly legal = signal<LegalAction[]>([]);
  readonly selection = signal<CardSelection | null>(null);
  readonly selectedIds = signal<string[]>([]);
  readonly tableCards = signal<TrickPlay[]>([]);
  readonly trickAnimation = signal<'idle' | 'collect'>('idle');
  readonly collectTo = signal<string | null>(null);
  readonly banner = signal<Banner | null>(null);
  readonly summaryOpen = signal(false);
  readonly autoPlay = signal(false);
  readonly timeLeft = signal(0);
  readonly dealing = signal(false);
  readonly outcome = signal<GameOutcome | null>(null);
  readonly finishResult = signal<FinishSessionResponse | null>(null);
  readonly savingResult = signal(false);

  /** Per-game settings chosen on the setup screen (persisted per slug). */
  readonly gameSettings = signal<GameSettings>({});
  readonly playerCount = signal(4);

  readonly isMyTurn = computed(() => this.phase() === 'playing' && this.view()?.currentPlayerId === HUMAN_ID && !this.summaryOpen());
  readonly turnSeconds = computed(() => (this.settingsSvc.settings().turnTimer ? TURN_SECONDS : 0));

  /** Card ids that have at least one legal action right now. */
  readonly playableIds = computed(() => {
    if (!this.isMyTurn()) return new Set<string>();
    if (this.selection()) return new Set(this.view()?.hand.map((c) => c.id) ?? []);
    return new Set(this.legal().filter((a) => a.cardId).map((a) => a.cardId!));
  });

  /** Buttons that don't involve a card: bids, pass, trump choice, reveal… */
  readonly buttonActions = computed(() => (this.isMyTurn() ? this.legal().filter((a) => !a.cardId) : []));

  /** When the selected card can be played in several ways (e.g. Seep captures vs. builds). */
  readonly cardOptions = computed(() => {
    const id = this.selectedIds()[0];
    if (!this.isMyTurn() || this.selection() || !id) return [];
    return this.legal().filter((a) => a.cardId === id);
  });

  readonly myOutcome = computed(() => this.outcome()?.players.find((p) => p.id === HUMAN_ID) ?? null);

  // ----------------------------------------------------------------- setup

  configure(def: GameDefinition): void {
    this.stop();
    this.def.set(def);
    this.phase.set('setup');
    const defaults = Object.fromEntries(def.setupOptions.map((o) => [o.key, o.default]));
    const saved = this.storage.get<{ settings?: GameSettings; players?: number }>(`table.${def.slug}`, {});
    this.gameSettings.set({ ...defaults, ...(saved.settings ?? {}) });
    this.playerCount.set(def.playerCounts.includes(saved.players ?? -1) ? saved.players! : def.playerCounts[0]);
  }

  setOption(key: string, value: number | string): void {
    this.gameSettings.update((s) => ({ ...s, [key]: value }));
    this.persist();
  }

  setPlayers(n: number): void {
    this.playerCount.set(n);
    this.persist();
  }

  private persist(): void {
    const def = this.def();
    if (def) this.storage.set(`table.${def.slug}`, { settings: this.gameSettings(), players: this.playerCount() });
  }

  // --------------------------------------------------------------- control

  start(): void {
    const def = this.def();
    if (!def) return;
    this.abandon();
    this.stop();
    const gen = ++this.generation;
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.rng = seededRng(seed ^ 0x5bd1e995);

    const profiles = botsFor(this.playerCount() - 1, this.settingsSvc.settings().difficulty);
    this.bots = new Map(profiles.map((b) => [b.id, b]));
    const user = this.auth.user();
    const seats: SeatConfig[] = [
      { id: HUMAN_ID, name: user?.username ?? 'You', avatar: user?.avatarUrl ?? '', isBot: false },
      ...profiles.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, isBot: true })),
    ];
    this.engine = def.create(seats, seed, this.gameSettings());
    this.engine.initializeGame();

    this.outcome.set(null);
    this.finishResult.set(null);
    this.selectedIds.set([]);
    this.summaryOpen.set(false);
    this.banner.set(null);
    this.tableCards.set([]);
    this.phase.set('loading');

    LOADING_STEPS.forEach((step, i) => this.later(gen, i * 350, () => this.loadingStep.set(step)));
    this.later(gen, LOADING_STEPS.length * 350, () => {
      this.refresh();
      this.phase.set('playing');
      this.dealing.set(true);
      this.sound.play('card-deal');
      this.startedAt = Date.now();
      this.openSession(def.slug);
      this.later(gen, 800, () => {
        this.dealing.set(false);
        this.advance(gen);
      });
    });
  }

  stop(): void {
    this.generation++;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.stopCountdown();
  }

  ngOnDestroy(): void {
    this.abandon();
    this.stop();
  }

  // ----------------------------------------------------------- human input

  clickCard(card: Card): void {
    if (!this.isMyTurn()) return;
    const sel = this.selection();
    if (sel) {
      this.selectedIds.update((ids) =>
        ids.includes(card.id) ? ids.filter((x) => x !== card.id) : ids.length < sel.count ? [...ids, card.id] : ids,
      );
      this.sound.play('card-select');
      return;
    }
    const actions = this.legal().filter((a) => a.cardId === card.id);
    if (!actions.length) return;
    // One click plays; only cards with several possible plays (e.g. Seep capture vs. build) stop to ask.
    if (actions.length === 1) {
      this.act(actions[0]);
      return;
    }
    this.sound.play('card-select');
    this.selectedIds.set([card.id]);
  }

  /** Play the selected card when it has exactly one action. */
  playSelected(): void {
    const opts = this.cardOptions();
    if (opts.length === 1) this.act(opts[0]);
  }

  confirmSelection(actionType?: GameAction['type']): void {
    const sel = this.selection();
    const ids = this.selectedIds();
    if (!sel) return;
    const choice = actionType ? sel.actions?.find((a) => a.actionType === actionType) : undefined;
    if (choice) {
      if (ids.length < choice.minCount || ids.length > choice.maxCount) return;
      // Single-card actions (e.g. Rummy discard) carry `cardId`; the rest carry `cardIds`.
      this.act(choice.maxCount === 1 ? { type: choice.actionType, cardId: ids[0] } : { type: choice.actionType, cardIds: ids });
      return;
    }
    if (ids.length >= (sel.minCount ?? sel.count) && ids.length <= sel.count) this.act({ type: sel.actionType, cardIds: ids });
  }

  act(action: GameAction): void {
    if (!this.isMyTurn() || !this.engine) return;
    try {
      this.apply(HUMAN_ID, action);
    } catch (e) {
      // Free-form selections (e.g. Thirteen combinations) can be illegal; explain and let them retry.
      if (!(e instanceof IllegalActionError)) throw e;
      this.toast.error('Can’t play that', e.message);
      return;
    }
    this.stopCountdown();
    this.advance(this.generation);
  }

  hint(): void {
    if (!this.isMyTurn()) return;
    const a = this.suggest();
    if (a.cardId) this.selectedIds.set([a.cardId]);
    else if (a.cardIds) this.selectedIds.set(a.cardIds);
    else this.toast.info('Hint', this.legal().find((l) => l.type === a.type && l.value === a.value && l.suit === a.suit)?.label ?? a.type);
  }

  toggleAutoPlay(): void {
    this.autoPlay.update((v) => !v);
    if (this.autoPlay() && this.isMyTurn()) this.later(this.generation, 300, () => this.autoMove());
    if (this.autoPlay() && this.summaryOpen()) this.continueAfterHand();
  }

  continueAfterHand(): void {
    if (!this.summaryOpen() || !this.engine) return;
    this.summaryOpen.set(false);
    this.engine.resolve();
    this.refresh();
    this.advance(this.generation);
  }

  // ------------------------------------------------------------- game loop

  private advance(gen: number): void {
    const engine = this.engine;
    if (gen !== this.generation || !engine) return;
    this.refresh();

    if (engine.isGameOver()) return this.finish(gen);

    const pending = engine.pending();
    if (pending === 'trick') {
      const v = this.view()!;
      this.tableCards.set(v.trick);
      this.later(gen, this.delay(950), () => {
        this.collectTo.set(v.trickWinnerId);
        this.trickAnimation.set('collect');
        this.later(gen, this.delay(380), () => {
          engine.resolve();
          this.tableCards.set([]);
          this.trickAnimation.set('idle');
          this.collectTo.set(null);
          this.advance(gen);
        });
      });
      return;
    }
    if (pending === 'hand') {
      this.summaryOpen.set(true);
      if (this.autoPlay()) this.later(gen, 2500, () => this.continueAfterHand());
      return;
    }

    const id = engine.currentPlayerId();
    if (!id) return;
    if (id === HUMAN_ID) {
      this.sound.play('turn');
      if (this.autoPlay()) this.later(gen, this.delay(450), () => this.autoMove());
      else this.startCountdown(gen);
      return;
    }

    this.later(gen, this.delay(600 + this.rng() * 400), () => {
      const view = engine.getView(id);
      const action = this.def()!.bot(view, engine.legalActions(id), engine.cardSelection(id), this.bots.get(id)!, this.rng);
      this.apply(id, action);
      this.advance(gen);
    });
  }

  private apply(playerId: string, action: GameAction): void {
    this.engine!.apply(playerId, action);
    if (action.type === 'play') this.sound.play('card-play');
    this.selectedIds.set([]);
    this.refresh();
    this.tableCards.set(this.view()?.trick ?? []);
  }

  private autoMove(): void {
    if (this.isMyTurn()) this.act(this.suggest());
  }

  private suggest(): GameAction {
    const engine = this.engine!;
    return this.def()!.bot(
      engine.getView(HUMAN_ID),
      engine.legalActions(HUMAN_ID),
      engine.cardSelection(HUMAN_ID),
      { difficulty: 'hard', personality: 'strategic' },
      this.rng,
    );
  }

  private finish(gen: number): void {
    this.stopCountdown();
    const outcome = this.engine!.outcome();
    this.outcome.set(outcome);
    const mine = outcome.players.find((p) => p.id === HUMAN_ID);
    this.sound.play(mine?.result === 'loss' ? 'lose' : 'win');
    this.later(gen, 600, () => this.phase.set('finished'));
    this.recordResult();
  }

  private refresh(): void {
    const engine = this.engine;
    if (!engine) return;
    const v = engine.getView(HUMAN_ID);
    this.view.set(v);
    this.legal.set(engine.legalActions(HUMAN_ID));
    const sel = engine.cardSelection(HUMAN_ID);
    this.selection.set(sel);
    if (v.banner && v.banner.id !== this.lastBannerId) {
      this.lastBannerId = v.banner.id;
      const b = v.banner;
      this.banner.set(b);
      this.later(this.generation, 1900, () => {
        if (this.banner()?.id === b.id) this.banner.set(null);
      });
    }
  }

  // ----------------------------------------------------------- persistence

  private openSession(slug: string): void {
    if (!this.auth.isLoggedIn()) return;
    const gen = this.generation;
    this.stats
      .startSession(slug, 'ai', { ...this.gameSettings(), players: this.playerCount(), difficulty: this.settingsSvc.settings().difficulty })
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (gen === this.generation) this.sessionId = res?.id ?? null;
      });
  }

  private recordResult(): void {
    const engine = this.engine;
    if (!this.auth.isLoggedIn() || !this.sessionId || !engine) return;
    const sessionId = this.sessionId;
    this.sessionId = null;
    this.savingResult.set(true);
    const v = engine.getView(HUMAN_ID);
    this.stats
      .finishSession(sessionId, {
        seed: engine.seed,
        seats: v.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot })),
        selfSeatId: HUMAN_ID,
        settings: this.gameSettings(),
        actions: engine.actionLog().map((l) => ({ playerId: l.playerId, action: l.action })),
      })
      .subscribe({
        next: (res) => {
          this.finishResult.set(res);
          this.savingResult.set(false);
          this.auth.reloadUser().subscribe();
          if (res.leveledUp) this.toast.show('achievement', `Level up! You reached level ${res.level}`);
          res.achievementsUnlocked.forEach((a) => this.toast.show('achievement', `Achievement unlocked: ${a.name}`, a.description, 5000));
        },
        error: () => {
          this.savingResult.set(false);
          this.toast.error('Could not save your result', 'Your game finished, but statistics were not updated.');
        },
      });
  }

  abandon(): void {
    if (this.sessionId) this.stats.leaveSession(this.sessionId).pipe(catchError(() => of(null))).subscribe();
    this.sessionId = null;
  }

  // ---------------------------------------------------------------- timing

  private startCountdown(gen: number): void {
    this.stopCountdown();
    const total = this.turnSeconds();
    if (!total) return;
    this.timeLeft.set(total);
    this.countdown = setInterval(() => {
      if (gen !== this.generation) return this.stopCountdown();
      this.timeLeft.update((t) => t - 1);
      if (this.timeLeft() <= 0) {
        this.stopCountdown();
        this.toast.info('Time’s up', 'A move was made for you.');
        this.autoMove();
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdown) clearInterval(this.countdown);
    this.countdown = null;
  }

  private delay(ms: number): number {
    return Math.round(ms * SPEED[this.settingsSvc.settings().gameSpeed]);
  }

  private later(gen: number, ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== t);
      if (gen === this.generation) fn();
    }, ms);
    this.timers.push(t);
  }
}
