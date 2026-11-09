import { Component, input, output } from '@angular/core';
import { PlayingCard } from '../../../shared/components/playing-card/playing-card';
import { Card } from '../../../shared/models/card.model';

@Component({
  selector: 'app-table-hand',
  imports: [PlayingCard],
  template: `
    <div class="hand" role="group" aria-label="Your hand" [class.dealing]="dealing()" [style.--n]="cards().length">
      @for (card of cards(); track card.id; let i = $index) {
        <app-playing-card class="slot" [class.fresh]="card.id === freshId()" [style.--i]="i" [card]="card" [interactive]="true" size="lg"
          [selected]="selectedIds().includes(card.id)"
          [playable]="myTurn() && playableIds().has(card.id)"
          [disabled]="myTurn() && !playableIds().has(card.id)"
          (cardClick)="cardClick.emit($event)" />
      } @empty {
        <p class="empty">No cards in hand</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .hand { --cw: clamp(64px, 16vw, 110px); display: flex; justify-content: safe center; align-items: flex-end; padding: 26px 8px 6px; min-height: 150px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
    .slot { flex: 0 0 auto; margin-left: clamp(calc(20px - var(--cw)), calc((100% - var(--n) * var(--cw)) / max(var(--n) - 1, 1)), -4px); transition: margin var(--dur-med) var(--ease-out); }
    .slot:first-child { margin-left: 0; }
    .dealing .slot { animation: deal 420ms var(--ease-out) both; animation-delay: calc(var(--i) * 35ms); }
    .empty { color: var(--text-secondary); margin: auto; }
    /* A card that just arrived (Donkey's draw) drops in from the deck and keeps a soft glow. */
    .fresh { animation: arrive 460ms var(--ease-out) both; filter: drop-shadow(0 0 10px rgba(250,204,21,.85)); }
    @keyframes arrive { from { opacity: 0; transform: translateY(-140px) scale(.7) rotate(-8deg); } }
    @keyframes deal { from { opacity: 0; transform: translateY(-160px) rotate(-10deg) scale(.7); } }
  `,
})
export class TableHand {
  readonly cards = input.required<Card[]>();
  readonly playableIds = input.required<Set<string>>();
  readonly selectedIds = input<string[]>([]);
  readonly myTurn = input(false);
  readonly dealing = input(false);
  /** Card that just arrived in the hand, highlighted. */
  readonly freshId = input<string | null>(null);
  readonly cardClick = output<Card>();
}
