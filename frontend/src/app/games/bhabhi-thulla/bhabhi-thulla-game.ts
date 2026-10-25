import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdBanner } from '../../shared/components/ad-banner/ad-banner';
import { AuthService } from '../../core/services/auth.service';
import { SeoService } from '../../core/services/seo.service';
import { SettingsService } from '../../core/services/settings.service';
import { Loader } from '../../shared/components/loader/loader';
import { Modal } from '../../shared/components/modal/modal';
import { GameTimer } from '../../shared/components/game-timer/game-timer';
import { PlayerAvatar } from '../../shared/components/player-avatar/player-avatar';
import { SUIT_SYMBOL, Suit } from '../../shared/models/card.model';
import { BhabhiThullaStore, HUMAN_ID } from './bhabhi-thulla.store';
import { GameControls } from './components/game-controls/game-controls';
import { GameResult } from './components/game-result/game-result';
import { GameSetup } from './components/game-setup/game-setup';
import { Opponent } from './components/opponent/opponent';
import { PlayerHand } from './components/player-hand/player-hand';
import { Scoreboard } from './components/scoreboard/scoreboard';
import { SeatPosition, seatPositions } from '../core/ui/seat-layout';
import { TrickArea } from './components/trick-area/trick-area';
import { CORE_RULES, VARIANT_DESCRIPTIONS } from './engine/bhabhi-thulla.rules';

@Component({
  selector: 'app-bhabhi-thulla-game',
  imports: [AdBanner, RouterLink, Loader, Modal, GameTimer, PlayerAvatar, GameControls, GameResult, GameSetup, Opponent, PlayerHand, Scoreboard, TrickArea],
  providers: [BhabhiThullaStore],
  templateUrl: './bhabhi-thulla-game.html',
  styleUrl: './bhabhi-thulla-game.scss',
})
export class BhabhiThullaGame {
  readonly store = inject(BhabhiThullaStore);
  readonly auth = inject(AuthService);
  readonly settingsSvc = inject(SettingsService);
  private readonly router = inject(Router);

  readonly rulesOpen = signal(false);
  readonly settingsOpen = signal(false);
  readonly leaveOpen = signal(false);

  readonly coreRules = CORE_RULES;
  readonly variantInfo = VARIANT_DESCRIPTIONS;
  readonly humanId = HUMAN_ID;

  readonly positions = computed<Record<string, SeatPosition>>(() => {
    const opp = this.store.opponents();
    const layout = seatPositions(opp.length);
    return Object.fromEntries([[HUMAN_ID, 'bottom' as SeatPosition], ...opp.map((p, i) => [p.id, layout[i]])]);
  });

  readonly leadSymbol = computed(() => {
    const s = this.store.view()?.leadSuit as Suit | null;
    return s ? SUIT_SYMBOL[s] : null;
  });

  readonly status = computed(() => {
    const v = this.store.view();
    if (!v) return '';
    if (this.store.isMyTurn()) {
      if (v.trick.length === 0) return v.trickNumber === 1 && v.rules.openWithAceOfSpades ? 'Lead the Ace of Spades' : 'Your lead — play any card';
      return this.store.validIds().size && [...this.store.validIds()].every((id) => id.startsWith(v.leadSuit!))
        ? `Follow ${v.leadSuit}`
        : v.trickNumber === 1 && !v.rules.firstTrickThulla
          ? 'No ' + v.leadSuit + ' — discard any card'
          : 'No ' + v.leadSuit + ' — play a Thulla!';
    }
    if (v.status === 'finished') return 'Game over';
    const cur = this.store.currentPlayer();
    return cur ? `Waiting for ${cur.name}…` : 'Resolving trick…';
  });

  readonly tableHint = computed(() => {
    const v = this.store.view();
    if (!v || v.status !== 'playing') return '';
    return this.store.isMyTurn() ? 'Your lead' : '';
  });

  constructor() {
    inject(SeoService).apply({
      title: 'Play Bhabhi Thulla Online – Free vs AI | CardArena',
      description: 'Play Bhabhi Thulla free in your browser against smart AI opponents. No download, no sign-up required.',
      path: '/games/bhabhi-thulla',
      image: '/og/bhabhi-thulla.jpg',
    });
  }

  confirmLeave(): void {
    this.store.stop();
    void this.router.navigate(['/games', 'bhabhi-thulla']);
  }

  toggleSound(): void {
    this.settingsSvc.update({ sound: !this.settingsSvc.settings().sound });
  }

  restartFromSettings(): void {
    this.settingsOpen.set(false);
    this.store.start();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (this.rulesOpen() || this.settingsOpen() || this.leaveOpen() || !this.store.isMyTurn()) return;
    const target = e.target as HTMLElement;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    const valid = this.store.hand().filter((c) => this.store.validIds().has(c.id));
    if (!valid.length) return;
    const idx = valid.findIndex((c) => c.id === this.store.selectedId());
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const next = valid[(idx + step + valid.length) % valid.length] ?? valid[0];
      this.store.focusCard(next);
    } else if ((e.key === 'Enter' || e.key === ' ') && this.store.selectedId() && target.tagName !== 'BUTTON') {
      e.preventDefault();
      this.store.playSelected();
    } else if (e.key.toLowerCase() === 'h') {
      this.store.showHint();
    }
  }
}
