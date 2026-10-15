import { Component, input } from '@angular/core';
import { ScoreTable } from '../table-game';

@Component({
  selector: 'app-table-scores',
  template: `
    <table class="scores" [class.lg]="size() === 'lg'" [attr.aria-label]="table().title">
      <thead><tr><th>{{ table().title }}</th>@for (c of table().columns; track c) { <th class="num">{{ c }}</th> }</tr></thead>
      <tbody>
        @for (r of table().rows; track r.label) {
          <tr [class.me]="r.highlight"><td>{{ r.label }}</td>@for (v of r.values; track $index) { <td class="num">{{ v }}</td> }</tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host { display: block; max-width: 100%; overflow-x: auto; border-radius: 12px; }
    .scores { border-collapse: collapse; font-size: .8rem; background: rgba(11,16,32,.75); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; backdrop-filter: blur(6px); }
    th, td { padding: 5px 10px; text-align: left; white-space: nowrap; }
    th { color: var(--text-secondary); font-size: .66rem; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid var(--border-color); }
    td { max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
    .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
    tr.me td { color: var(--color-secondary); }
    .scores.lg { width: 100%; font-size: 1rem; background: rgba(255,255,255,.03);
      th { font-size: .72rem; padding: 10px 14px; } td { padding: 12px 14px; max-width: none; } .num { font-family: var(--font-display); font-size: 1.15rem; }
      td:first-child { font-weight: 700; white-space: normal; }
      @media (max-width: 600px) { th { padding: 8px 6px; font-size: .62rem; } td { padding: 10px 6px; } .num { font-size: 1rem; } } tr.me td { background: rgba(0,212,255,.1); color: #fff; } tr.me .num { color: var(--color-secondary); } }
  `,
})
export class TableScores {
  readonly table = input.required<ScoreTable>();
  readonly size = input<'sm' | 'lg'>('sm');
}
