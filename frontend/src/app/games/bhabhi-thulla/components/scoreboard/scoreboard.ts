import { Component, input } from '@angular/core';
import { StandingRow } from '../../bhabhi-thulla.store';

@Component({
  selector: 'app-bt-scoreboard',
  template: `
    <ol class="board" aria-label="Standings">
      @for (row of rows(); track row.id) {
        <li [class.you]="row.isYou" [class.bhabhi]="row.isBhabhi">
          <span class="medal">{{ medal(row) }}</span>
          <span class="name">{{ row.isYou && row.name !== 'You' ? row.name + ' (you)' : row.name }}</span>
          @if (showScore()) { <span class="score">{{ row.score > 0 ? '+' : '' }}{{ row.score }}</span> }
        </li>
      }
    </ol>
  `,
  styles: `
    .board { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    li { display: flex; align-items: center; gap: 10px; padding: clamp(6px, 1.2vh, 10px) 12px; border-radius: 12px; background: rgba(255,255,255,.04); border: 1px solid var(--border-color); }
    li.you { border-color: rgba(0,212,255,.45); background: rgba(0,212,255,.08); }
    li.bhabhi { border-color: rgba(239,68,68,.5); background: rgba(239,68,68,.1); }
    .medal { width: 28px; text-align: center; font-size: 1.15rem; }
    .name { flex: 1; font-weight: 600; }
    .score { font-family: var(--font-display); font-weight: 800; font-variant-numeric: tabular-nums; }
  `,
})
export class Scoreboard {
  readonly rows = input.required<StandingRow[]>();
  readonly showScore = input(true);

  medal(row: StandingRow): string {
    if (row.isBhabhi) return '💀';
    return ({ 1: '🥇', 2: '🥈', 3: '🥉' } as Record<number, string>)[row.position ?? 0] ?? (row.position ? `#${row.position}` : '…');
  }
}
