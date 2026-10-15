import { Component, computed, input } from '@angular/core';
import { PlayingCard } from '../../../shared/components/playing-card/playing-card';
import { TrickPlay } from '../table-game';
import { COLLECT_OFFSET, SeatPosition, TRICK_OFFSET } from './seat-layout';

@Component({
  selector: 'app-table-trick',
  imports: [PlayingCard],
  template: `
    <div class="trick" [class.collect]="animation() === 'collect'" aria-live="polite" [attr.aria-label]="label()">
      @if (!plays().length && hint()) { <p class="hint">{{ hint() }}</p> }
      @for (p of placed(); track p.play.card.id) {
        <div class="slot" [class.winner]="p.play.playerId === winnerId()"
             [style.--x]="p.x + '%'" [style.--y]="p.y + '%'" [style.--r]="p.r + 'deg'"
             [style.--fx]="p.fx + 'px'" [style.--fy]="p.fy + 'px'" [style.--cx]="collect().x + 'px'" [style.--cy]="collect().y + 'px'">
          <app-playing-card [card]="p.play.card" size="md" />
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .trick { position: relative; width: min(360px, 70vw); height: min(240px, 34vh); min-height: 170px; }
    .hint { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; text-align: center; color: rgba(255,255,255,.55); font-family: var(--font-display); font-weight: 600; padding: 0 12px; }
    .slot { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) translate(var(--x), var(--y)) rotate(var(--r));
      animation: enter var(--dur-slow) var(--ease-out) both; transition: transform 380ms var(--ease-out), opacity 380ms; }
    .slot.winner app-playing-card { filter: drop-shadow(0 0 12px rgba(0,212,255,.8)); }
    .collect .slot { transform: translate(-50%, -50%) translate(var(--cx), var(--cy)) scale(.5); opacity: 0; }
    @keyframes enter { from { opacity: 0; transform: translate(-50%, -50%) translate(var(--fx), var(--fy)) scale(.8); } }
  `,
})
export class TableTrick {
  readonly plays = input.required<TrickPlay[]>();
  readonly positions = input.required<Record<string, SeatPosition>>();
  readonly winnerId = input<string | null>(null);
  readonly animation = input<'idle' | 'collect'>('idle');
  readonly collectTo = input<string | null>(null);
  readonly hint = input('');

  readonly placed = computed(() =>
    this.plays().map((play) => {
      const pos = this.positions()[play.playerId] ?? 'bottom';
      const o = TRICK_OFFSET[pos];
      const f = COLLECT_OFFSET[pos];
      return { play, x: o.x, y: o.y, r: o.r, fx: f.x * 0.8, fy: f.y * 0.8 };
    }),
  );
  readonly collect = computed(() => {
    const id = this.collectTo();
    return id ? COLLECT_OFFSET[this.positions()[id] ?? 'bottom'] : { x: 0, y: 0 };
  });
  readonly label = computed(() =>
    this.plays().length ? `Cards on table: ${this.plays().map((p) => `${p.card.rank} of ${p.card.suit}`).join(', ')}` : 'Table is empty',
  );
}
