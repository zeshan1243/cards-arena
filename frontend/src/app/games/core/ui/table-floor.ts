import { Component, input } from '@angular/core';
import { PlayingCard } from '../../../shared/components/playing-card/playing-card';
import { FloorPile } from '../table-game';
import { COLLECT_OFFSET, SeatPosition } from './seat-layout';

/** Open "floor" of face-up cards and piles (fishing games such as Seep). */
@Component({
  selector: 'app-table-floor',
  imports: [PlayingCard],
  template: `
    <div class="floor" aria-label="Cards on the floor">
      @for (pile of piles(); track pile.id) {
        <div class="pile" [class.house]="pile.label && !pile.from" [class.played]="pile.from" [class.fly]="pile.from"
             [style.--fx]="flyFrom(pile).x + 'px'" [style.--fy]="flyFrom(pile).y + 'px'">
          <div class="stack" [style.--n]="pile.cards.length">
            @for (c of pile.cards; track c.id; let i = $index) {
              <app-playing-card class="layer" [style.--i]="i" [card]="c" size="sm" />
            }
          </div>
          @if (pile.label) { <span class="label">{{ pile.label }}</span> }
        </div>
      } @empty {
        <p class="empty">{{ emptyText() }}</p>
      }
    </div>
  `,
  styles: `
    .floor { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; align-content: center; width: min(520px, 82vw); min-height: 150px; padding: 8px; }
    .pile { display: grid; justify-items: center; gap: 4px; animation: in var(--dur-slow) var(--ease-out); }
    .pile.house { padding: 6px; border-radius: 12px; background: rgba(245,158,11,.12); border: 1px dashed rgba(245,158,11,.6); }
    .stack { display: flex; }
    .layer { margin-left: -24px; } .layer:first-child { margin-left: 0; }
    .pile.played { padding: 6px 10px; border-radius: 12px; background: rgba(0,0,0,.18); }
    .pile.fly { animation: fly 420ms var(--ease-out) both; }
    .pile.fly .layer:not(:first-child) { animation: fan 420ms var(--ease-out) both; animation-delay: calc(var(--i) * 45ms); }
    .label { font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #fde68a; }
    .empty { color: rgba(255,255,255,.5); font-family: var(--font-display); margin: auto; }
    @keyframes in { from { opacity: 0; transform: scale(.8); } }
    @keyframes fly { from { opacity: 0; transform: translate(var(--fx), var(--fy)) scale(.6) rotate(-6deg); } }
    @keyframes fan { from { margin-left: -56px; } }
  `,
})
export class TableFloor {
  readonly piles = input.required<FloorPile[]>();
  readonly emptyText = input('The floor is empty');
  /** Seat positions, so piles with `from` fly in from the right seat. */
  readonly positions = input<Record<string, SeatPosition>>({});

  flyFrom(pile: FloorPile): { x: number; y: number } {
    if (!pile.from) return { x: 0, y: 0 };
    const o = COLLECT_OFFSET[this.positions()[pile.from] ?? 'bottom'];
    return { x: o.x * 0.8, y: o.y * 0.8 };
  }
}
