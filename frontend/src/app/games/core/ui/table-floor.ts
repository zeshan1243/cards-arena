import { Component, input } from '@angular/core';
import { PlayingCard } from '../../../shared/components/playing-card/playing-card';
import { FloorPile } from '../table-game';

/** Open "floor" of face-up cards and piles (fishing games such as Seep). */
@Component({
  selector: 'app-table-floor',
  imports: [PlayingCard],
  template: `
    <div class="floor" aria-label="Cards on the floor">
      @for (pile of piles(); track pile.id) {
        <div class="pile" [class.house]="pile.label">
          <div class="stack" [style.--n]="pile.cards.length">
            @for (c of pile.cards; track c.id; let i = $index) {
              <app-playing-card class="layer" [style.--i]="i" [card]="c" size="sm" />
            }
          </div>
          @if (pile.label) { <span class="label">{{ pile.label }}</span> }
        </div>
      } @empty {
        <p class="empty">The floor is empty</p>
      }
    </div>
  `,
  styles: `
    .floor { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; align-content: center; width: min(520px, 82vw); min-height: 150px; padding: 8px; }
    .pile { display: grid; justify-items: center; gap: 4px; animation: in var(--dur-slow) var(--ease-out); }
    .pile.house { padding: 6px; border-radius: 12px; background: rgba(245,158,11,.12); border: 1px dashed rgba(245,158,11,.6); }
    .stack { display: flex; }
    .layer { margin-left: -24px; } .layer:first-child { margin-left: 0; }
    .label { font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #fde68a; }
    .empty { color: rgba(255,255,255,.5); font-family: var(--font-display); margin: auto; }
    @keyframes in { from { opacity: 0; transform: scale(.8); } }
  `,
})
export class TableFloor {
  readonly piles = input.required<FloorPile[]>();
}
