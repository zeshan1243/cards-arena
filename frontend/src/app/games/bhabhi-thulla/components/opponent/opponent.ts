import { Component, computed, input } from '@angular/core';
import { PlayerAvatar } from '../../../../shared/components/player-avatar/player-avatar';
import { PlayerView } from '../../engine/bhabhi-thulla.engine';
import { SeatPosition } from '../../../core/ui/seat-layout';

type SeatPlayer = PlayerView['players'][number];

@Component({
  selector: 'app-bt-opponent',
  imports: [PlayerAvatar],
  template: `
    <div class="seat" [class]="'seat ' + position()" [class.compact]="position().startsWith('top')" [class.active]="active()" [class.out]="player().finishPosition !== null" [class.bhabhi]="isBhabhi()">
      <div class="fan" aria-hidden="true">
        @for (i of fan(); track i) {
          <span class="mini-card" [style.--i]="i" [style.--n]="fan().length"></span>
        }
      </div>
      <app-player-avatar [name]="player().name" [avatar]="player().avatar" [active]="active()" size="md" status="bot" />
      <div class="info">
        <span class="name">{{ player().name }}</span>
        @if (isBhabhi()) {
          <span class="badge bhabhi-badge">Bhabhi</span>
        } @else if (player().finishPosition !== null) {
          <span class="badge safe">Safe #{{ player().finishPosition }}</span>
        } @else {
          <span class="count">{{ player().cardCount }} {{ player().cardCount === 1 ? 'card' : 'cards' }}</span>
        }
      </div>
      @if (active()) {
        <span class="thinking" aria-label="Thinking"><i></i><i></i><i></i></span>
      }
      <span class="sr-only">{{ player().name }}, {{ player().cardCount }} cards{{ active() ? ', playing now' : '' }}</span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .seat {
      position: relative; display: grid; justify-items: center; gap: 6px; padding: 10px 12px 8px;
      border-radius: var(--radius-md); background: rgba(11,16,32,.55); border: 1px solid var(--border-color);
      min-width: 92px; transition: box-shadow var(--dur-med), border-color var(--dur-med), opacity var(--dur-med);
      &.active { border-color: rgba(0,212,255,.6); box-shadow: var(--shadow-glow-cyan); }
      &.out { opacity: .65; }
      &.bhabhi { border-color: rgba(239,68,68,.7); box-shadow: 0 0 24px rgba(239,68,68,.4); }
    }
    .fan { position: relative; height: 30px; width: 70px; margin-bottom: -2px; }
    /* Top seats sit close to the trick area, so lay them out horizontally. */
    .seat.compact { grid-auto-flow: column; align-items: center; gap: 10px; padding: 6px 12px 6px 6px; .fan { display: none; } .info { justify-items: start; } }
    .mini-card {
      position: absolute; left: 50%; bottom: 0; width: 20px; height: 28px; border-radius: 3px;
      background: linear-gradient(145deg, #5b4bd6, #1b1468); border: 1.5px solid #fff;
      transform-origin: 50% 120%;
      transform: translateX(-50%) rotate(calc((var(--i) - (var(--n) - 1) / 2) * 9deg));
      transition: transform var(--dur-med) var(--ease-out);
    }
    .info { display: grid; justify-items: center; line-height: 1.2; }
    .name { font-family: var(--font-display); font-weight: 700; font-size: .9rem; }
    .count { font-size: .75rem; color: var(--text-secondary); }
    .badge { font-size: .68rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; margin-top: 2px; }
    .safe { background: rgba(34,197,94,.18); color: #86efac; }
    .bhabhi-badge { background: rgba(239,68,68,.2); color: #fca5a5; }
    .thinking { position: absolute; top: -10px; right: -6px; display: flex; gap: 3px; padding: 5px 7px; border-radius: 999px; background: var(--color-secondary); }
    .thinking i { width: 5px; height: 5px; border-radius: 50%; background: #04111a; animation: dot 1s infinite; }
    .thinking i:nth-child(2) { animation-delay: .15s; } .thinking i:nth-child(3) { animation-delay: .3s; }
    @keyframes dot { 50% { transform: translateY(-3px); opacity: .5; } }
    @media (max-width: 600px) {
      .seat { min-width: 76px; padding: 6px 8px; gap: 3px; }
      .fan { display: none; }
      .name { font-size: .78rem; }
    }
  `,
})
export class Opponent {
  readonly player = input.required<SeatPlayer>();
  readonly position = input.required<SeatPosition>();
  readonly active = input(false);
  readonly isBhabhi = input(false);
  readonly fan = computed(() => Array.from({ length: Math.min(this.player().cardCount, 7) }, (_, i) => i));
}
