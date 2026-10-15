import { Component, computed, input } from '@angular/core';
import { PlayingCard } from '../../../../shared/components/playing-card/playing-card';
import { TrickPlay } from '../../engine/bhabhi-thulla.engine';
import { COLLECT_OFFSET, SeatPosition, TRICK_OFFSET } from '../../../core/ui/seat-layout';
import { TrickAnimation } from '../../bhabhi-thulla.store';

@Component({
  selector: 'app-bt-trick-area',
  imports: [PlayingCard],
  template: `
    <div class="trick" [class]="'trick ' + animation()" aria-live="polite" [attr.aria-label]="ariaLabel()">
      @if (plays().length === 0 && hint()) {
        <p class="hint">{{ hint() }}</p>
      }
      @for (p of placed(); track p.play.card.id) {
        <div class="slot" [style.--x]="p.x + '%'" [style.--y]="p.y + '%'" [style.--r]="p.r + 'deg'"
             [style.--fx]="p.fromX + 'px'" [style.--fy]="p.fromY + 'px'" [style.--cx]="collect().x + 'px'" [style.--cy]="collect().y + 'px'"
             [class.winner]="p.play.playerId === highestId()">
          <app-playing-card [card]="p.play.card" size="md" />
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .trick { position: relative; width: min(360px, 70vw); height: min(240px, 34vh); min-height: 170px; }
    .hint { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; text-align: center; color: rgba(255,255,255,.55); font-family: var(--font-display); font-weight: 600; font-size: .95rem; padding: 0 12px; }
    .slot {
      position: absolute; left: 50%; top: 50%;
      transform: translate(-50%, -50%) translate(var(--x), var(--y)) rotate(var(--r));
      animation: enter var(--dur-slow) var(--ease-out) both;
      transition: transform 420ms var(--ease-out), opacity 420ms;
    }
    .slot.winner app-playing-card { filter: drop-shadow(0 0 10px rgba(0,212,255,.7)); }
    @keyframes enter {
      from { opacity: 0; transform: translate(-50%, -50%) translate(var(--fx), var(--fy)) rotate(0) scale(.8); }
    }
    .collect .slot { transform: translate(-50%, -50%) translate(var(--cx), var(--cy)) scale(.5); opacity: 0; }
    .discard .slot { transform: translate(-50%, -50%) translate(0, -10px) scale(.6) rotate(25deg); opacity: 0; }
  `,
})
export class TrickArea {
  readonly plays = input.required<TrickPlay[]>();
  readonly positions = input.required<Record<string, SeatPosition>>();
  readonly animation = input<TrickAnimation>('idle');
  readonly collectTo = input<string | null>(null);
  readonly leadSuit = input<string | null>(null);
  readonly hint = input<string>('');

  readonly highestId = computed(() => {
    const lead = this.plays()[0]?.card.suit;
    const order = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let best: TrickPlay | null = null;
    for (const p of this.plays()) {
      if (p.card.suit !== lead) continue;
      if (!best || order.indexOf(p.card.rank) > order.indexOf(best.card.rank)) best = p;
    }
    return best?.playerId ?? null;
  });

  readonly placed = computed(() =>
    this.plays().map((play) => {
      const pos = this.positions()[play.playerId] ?? 'bottom';
      const o = TRICK_OFFSET[pos];
      const from = COLLECT_OFFSET[pos];
      return { play, x: o.x, y: o.y, r: o.r, fromX: from.x * 0.8, fromY: from.y * 0.8 };
    }),
  );

  readonly collect = computed(() => {
    const id = this.collectTo();
    return id ? COLLECT_OFFSET[this.positions()[id] ?? 'bottom'] : { x: 0, y: 0 };
  });

  readonly ariaLabel = computed(() =>
    this.plays().length ? `Cards on table: ${this.plays().map((p) => `${p.card.rank} of ${p.card.suit}`).join(', ')}` : 'Table is empty',
  );
}
