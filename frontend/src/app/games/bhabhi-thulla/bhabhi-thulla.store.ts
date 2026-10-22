import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../core/services/settings.service';
import { SoundService } from '../../core/services/sound.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { ToastService } from '../../core/services/toast.service';
import { Card, sortHand } from '../../shared/models/card.model';
import { BotProfile } from '../../shared/models/game.model';
import { FinishSessionResponse } from '../../shared/models/user.model';
import { Rng, seededRng } from '../core/deck';
import { botsFor, chooseCard } from './engine/bhabhi-thulla.bot';
import { BhabhiThullaEngine, PlayerView, SeatConfig, TrickPlay, TrickResult } from './engine/bhabhi-thulla.engine';
import { createRules } from './engine/bhabhi-thulla.rules';

export const HUMAN_ID = 'you';

export type Phase = 'setup' | 'loading' | 'playing' | 'finished';
export type TrickAnimation = 'idle' | 'collect' | 'discard';
export type PlayerOutcome = 'win' | 'safe' | 'loss' | 'draw';

export interface Banner {
  id: number;
  kind: 'thulla' | 'cleared' | 'escaped' | 'info';
  text: string;
}

export interface StandingRow {
  id: string;
  name: string;
  avatar: string;
  isYou: boolean;
  position: number | null;
  isBhabhi: boolean;
  score: number;
  pickups: number;
}

const SPEED = { slow: 1.5, normal: 1, fast: 0.5 } as const;
const LOADING_STEPS = ['Preparing table…', 'Shuffling cards…', 'Dealing cards…', 'Starting game…'];

/**
 * Drives one Bhabhi Thulla table: owns the engine, runs bots, paces animations
 * and turn timers, and records the result. Components only read signals.
 */
@Injectable()
export class BhabhiThullaStore implements OnDestroy {
  private readonly settingsSvc = inject(SettingsService);
  private readonly sound = inject(SoundService);
  private readonly auth = inject(AuthService);
  private readonly stats = inject(StatisticsService);
  private readonly toast = inject(ToastService);

  private engine: BhabhiThullaEngine | null = null;
  private bots = new Map<string, BotProfile>();
  private rng: Rng = Math.random;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private countdown: ReturnType<typeof setInterval> | null = null;
  private generation = 0;
  private startedAt = 0;
  private sessionId: string | null = null;
  private bannerSeq = 0;

  readonly phase = signal<Phase>('setup');
  readonly loadingStep = signal(LOADING_STEPS[0]);
  readonly view = signal<PlayerView | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly hintId = signal<string | null>(null);
  readonly autoPlay = signal(false);
  readonly timeLeft = signal(0);
  readonly banner = signal<Banner | null>(null);
  /** Cards shown in the middle of the table (current trick, or the one being resolved). */
  readonly tableCards = signal<TrickPlay[]>([]);
  readonly trickAnimation = signal<TrickAnimation>('idle');
  readonly collectTarget = signal<string | null>(null);
  readonly dealing = signal(false);
  readonly finishResult = signal<FinishSessionResponse | null>(null);
  readonly savingResult = signal(false);

  readonly settings = this.settingsSvc.settings;
  readonly hand = computed(() => sortHand(this.view()?.hand ?? []));
  readonly isMyTurn = computed(() => this.phase() === 'playing' && this.view()?.currentPlayerId === HUMAN_ID);
  readonly validIds = computed(() => {
    if (!this.isMyTurn() || !this.engine) return new Set<string>();
    this.view(); // re-evaluate whenever the view changes
    return new Set(this.engine.getValidMoves(HUMAN_ID).map((c) => c.id));
  });
  readonly currentPlayer = computed(() => {
    const v = this.view();
    return v?.players.find((p) => p.id === v.currentPlayerId) ?? null;
  });
  readonly opponents = computed(() => this.view()?.players.filter((p) => p.id !== HUMAN_ID) ?? []);
  readonly me = computed(() => this.view()?.players.find((p) => p.id === HUMAN_ID) ?? null);
  readonly turnSeconds = computed(() => (this.settings().turnTimer ? this.view()?.rules.turnSeconds ?? 0 : 0));

  readonly standings = computed<StandingRow[]>(() => {
    const v = this.view();
    if (!v || !this.engine) return [];
    const scores = this.engine.calculateScore();
    const rows = v.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isYou: p.id === HUMAN_ID,
      position: p.finishPosition,
      isBhabhi: v.bhabhiId === p.id,
      score: scores[p.id] ?? 0,
      pickups: p.pickups,
    }));
    return rows.sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  });

  readonly outcome = computed<PlayerOutcome | null>(() => {
    const v = this.view();
    if (!v || v.status !== 'finished') return null;
    if (v.bhabhiId === HUMAN_ID) return 'loss';
    const pos = v.players.find((p) => p.id === HUMAN_ID)?.finishPosition ?? null;
    if (pos === 1) return 'win';
    if (!v.bhabhiId && pos === v.finishOrder.length) return 'draw';
    return 'safe';
  });

  // ---------------------------------------------------------------- control

  start(): void {
    this.abandon();
    this.stop();
    const gen = ++this.generation;
    const s = this.settings();
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.rng = seededRng(seed ^ 0x5bd1e995);

    const botProfiles = botsFor(s.playerCount - 1, s.difficulty);
    this.bots = new Map(botProfiles.map((b) => [b.id, b]));
    const user = this.auth.user();
    const seats: SeatConfig[] = [
      { id: HUMAN_ID, name: user?.username ?? 'You', avatar: '', isBot: false },
      ...botProfiles.map((b) => ({ id: b.id, name: b.name, avatar: b.avatar, isBot: true, bot: b })),
    ];

    this.engine = new BhabhiThullaEngine(seats, { seed, rules: createRules(s.bhabhiVariant, s.playerCount) });
    this.engine.initializeGame();

    this.finishResult.set(null);
    this.selectedId.set(null);
    this.hintId.set(null);
    this.banner.set(null);
    this.tableCards.set([]);
    this.trickAnimation.set('idle');
    this.sessionId = null;
    this.phase.set('loading');

    LOADING_STEPS.forEach((step, i) => this.later(gen, i * 380, () => this.loadingStep.set(step)));
    this.later(gen, LOADING_STEPS.length * 380, () => {
      this.refresh();
      this.phase.set('playing');
      this.dealing.set(true);
      this.sound.play('card-deal');
      this.startedAt = Date.now();
      this.openSession();
      this.later(gen, 900, () => {
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

  /** Click or tap: play the card straight away. */
  select(card: Card): void {
    if (!this.isMyTurn() || !this.validIds().has(card.id)) return;
    this.playHuman(card.id);
  }

  /** Keyboard arrows: move the highlight without playing (Enter plays). */
  focusCard(card: Card): void {
    if (!this.isMyTurn() || !this.validIds().has(card.id)) return;
    this.sound.play('card-select');
    this.selectedId.set(card.id);
  }

  playSelected(): void {
    const id = this.selectedId();
    if (id) this.playHuman(id);
  }

  showHint(): void {
    if (!this.isMyTurn()) return;
    const card = this.suggest('hard');
    this.hintId.set(card.id);
    this.selectedId.set(card.id);
  }

  toggleAutoPlay(): void {
    this.autoPlay.update((v) => !v);
    if (this.autoPlay() && this.isMyTurn()) this.later(this.generation, 400, () => this.autoMove());
  }

  // --------------------------------------------------------------- game loop

  private advance(gen: number): void {
    if (gen !== this.generation || !this.engine) return;
    const s = this.engine.getState();

    if (s.status === 'finished') return this.finish(gen);
    if (s.awaitingResolution) return this.scheduleResolve(gen);

    if (s.currentPlayerId === HUMAN_ID) {
      this.sound.play('turn');
      if (this.autoPlay()) {
        this.later(gen, this.delay(500), () => this.autoMove());
      } else {
        this.startCountdown(gen);
      }
      return;
    }

    const botId = s.currentPlayerId!;
    const think = this.delay(650 + this.rng() * 450);
    this.later(gen, think, () => {
      const view = this.engine!.getPlayerView(botId);
      const card = chooseCard(view, this.bots.get(botId)!, this.rng, this.engine!.getValidMoves(botId));
      this.applyPlay(botId, card.id);
      this.advance(gen);
    });
  }

  private playHuman(cardId: string): void {
    if (!this.isMyTurn()) return;
    this.stopCountdown();
    this.applyPlay(HUMAN_ID, cardId);
    this.advance(this.generation);
  }

  private autoMove(): void {
    if (!this.isMyTurn()) return;
    this.playHuman(this.suggest('normal').id);
  }

  private applyPlay(playerId: string, cardId: string): void {
    this.engine!.playCard(playerId, cardId);
    this.sound.play('card-play');
    this.selectedId.set(null);
    this.hintId.set(null);
    this.refresh();
    this.tableCards.set(this.engine!.getState().trick);
  }

  private scheduleResolve(gen: number): void {
    const s = this.engine!.getState();
    const last = s.trick[s.trick.length - 1];
    const isThulla = s.trick.length > 0 && last.card.suit !== s.leadSuit && (s.trickNumber > 1 || s.rules.firstTrickThulla);
    this.tableCards.set(s.trick);
    if (isThulla) {
      this.sound.play('thulla');
      this.showBanner('thulla', `${this.nameOf(last.playerId)} plays a THULLA!`);
    }

    this.later(gen, this.delay(isThulla ? 1300 : 900), () => {
      const result = this.engine!.resolveTrick();
      this.trickAnimation.set(result.outcome === 'thulla' ? 'collect' : 'discard');
      this.collectTarget.set(result.pickedUpById);
      this.announce(result);
      this.later(gen, this.delay(450), () => {
        this.tableCards.set([]);
        this.trickAnimation.set('idle');
        this.collectTarget.set(null);
        this.refresh();
        this.advance(gen);
      });
    });
  }

  private announce(r: TrickResult): void {
    if (r.outcome === 'thulla' && r.pickedUpById) {
      const who = r.pickedUpById === HUMAN_ID ? 'You pick' : `${this.nameOf(r.pickedUpById)} picks`;
      this.showBanner('thulla', `${who} up ${r.plays.length} cards`);
    }
    for (const id of r.escapedIds) {
      const pos = this.engine!.getState().players.find((p) => p.id === id)?.finishPosition;
      const text = id === HUMAN_ID ? `You escaped! #${pos}` : `${this.nameOf(id)} escaped #${pos}`;
      this.showBanner('escaped', text);
      if (id === HUMAN_ID) this.sound.play('win');
    }
  }

  private finish(gen: number): void {
    if (gen !== this.generation) return;
    this.stopCountdown();
    this.refresh();
    const outcome = this.outcome();
    this.sound.play(outcome === 'loss' ? 'lose' : 'win');
    this.later(gen, 700, () => this.phase.set('finished'));
    this.recordResult();
  }

  // ------------------------------------------------------------ persistence

  private openSession(): void {
    if (!this.auth.isLoggedIn()) return;
    const s = this.settings();
    const gen = this.generation;
    this.stats
      .startSession('bhabhi-thulla', 'ai', { variant: s.bhabhiVariant, difficulty: s.difficulty, players: s.playerCount })
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (gen === this.generation) this.sessionId = res?.id ?? null;
      });
  }

  private recordResult(): void {
    if (!this.auth.isLoggedIn() || !this.sessionId || !this.engine) return;
    const state = this.engine.getState();
    const sessionId = this.sessionId;
    this.sessionId = null;
    this.savingResult.set(true);
    this.stats
      .finishSession(sessionId, {
        seed: state.seed,
        variant: state.rules.variant,
        seats: state.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot })),
        selfSeatId: HUMAN_ID,
        moves: state.events.flatMap((e) => (e.type === 'play' ? [{ playerId: e.playerId, cardId: e.card.id }] : [])),
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

  /** Mark an unfinished recorded game as abandoned. */
  abandon(): void {
    if (this.sessionId) {
      this.stats.leaveSession(this.sessionId).pipe(catchError(() => of(null))).subscribe();
    }
    this.sessionId = null;
  }

  // ---------------------------------------------------------------- helpers

  private suggest(difficulty: 'normal' | 'hard'): Card {
    const view = this.engine!.getPlayerView(HUMAN_ID);
    return chooseCard(view, { difficulty, personality: 'strategic' }, this.rng, this.engine!.getValidMoves(HUMAN_ID));
  }

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
        this.toast.info('Time’s up', 'A card was played for you.');
        this.autoMove();
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdown) clearInterval(this.countdown);
    this.countdown = null;
  }

  private showBanner(kind: Banner['kind'], text: string): void {
    const banner = { id: ++this.bannerSeq, kind, text };
    this.banner.set(banner);
    this.later(this.generation, 1800, () => {
      if (this.banner()?.id === banner.id) this.banner.set(null);
    });
  }

  private refresh(): void {
    if (this.engine) this.view.set(this.engine.getPlayerView(HUMAN_ID));
  }

  private nameOf(id: string): string {
    return id === HUMAN_ID ? 'You' : (this.engine?.getState().players.find((p) => p.id === id)?.name ?? id);
  }

  private delay(ms: number): number {
    return Math.round(ms * SPEED[this.settings().gameSpeed]);
  }

  private later(gen: number, ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== t);
      if (gen === this.generation) fn();
    }, ms);
    this.timers.push(t);
  }
}
