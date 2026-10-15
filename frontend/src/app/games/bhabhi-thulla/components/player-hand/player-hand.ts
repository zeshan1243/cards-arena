import { Component, input, output } from '@angular/core';
import { PlayingCard } from '../../../../shared/components/playing-card/playing-card';
import { Card } from '../../../../shared/models/card.model';

@Component({
  selector: 'app-bt-player-hand',
  imports: [PlayingCard],
  template: `
    <div class="hand" role="group" aria-label="Your hand" [class.my-turn]="myTurn()" [class.dealing]="dealing()" [style.--n]="cards().length">
      @for (card of cards(); track card.id; let i = $index) {
        <app-playing-card
          class="slot"
          [style.--i]="i"
          [card]="card"
          [interactive]="true"
          size="lg"
          [selected]="card.id === selectedId()"
          [hint]="card.id === hintId()"
          [playable]="myTurn() && validIds().has(card.id)"
          [disabled]="myTurn() && !validIds().has(card.id)"
          (cardClick)="cardClick.emit($event)" />
      } @empty {
        <p class="empty">No cards left — you’re safe!</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .hand {
      /* Must match the lg playing-card width. */
      --cw: clamp(64px, 16vw, 110px);
      display: flex; justify-content: safe center; align-items: flex-end; padding: 26px 8px 6px; min-height: 150px;
      overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
    }
    /* Overlap just enough to fit the row, but always leave ~20px of each card visible. */
    .slot {
      flex: 0 0 auto;
      margin-left: clamp(calc(20px - var(--cw)), calc((100% - var(--n) * var(--cw)) / max(var(--n) - 1, 1)), -4px);
      transition: margin var(--dur-med) var(--ease-out);
    }
    .slot:first-child { margin-left: 0; }
    .dealing .slot { animation: deal 420ms var(--ease-out) both; animation-delay: calc(var(--i) * 35ms); }
    .empty { color: #86efac; font-family: var(--font-display); font-weight: 700; margin: auto; }
    @keyframes deal { from { opacity: 0; transform: translateY(-160px) rotate(-10deg) scale(.7); } }
  `,
})
export class PlayerHand {
  readonly cards = input.required<Card[]>();
  readonly validIds = input.required<Set<string>>();
  readonly selectedId = input<string | null>(null);
  readonly hintId = input<string | null>(null);
  readonly myTurn = input(false);
  readonly dealing = input(false);
  readonly cardClick = output<Card>();
}
