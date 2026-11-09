import { Component, input, output } from '@angular/core';
import { PlayerAvatar } from '../../../shared/components/player-avatar/player-avatar';
import { GameAction, SeatView } from '../table-game';
import { SeatPile } from './seat-pile';
import { SeatPosition } from './seat-layout';

@Component({
  selector: 'app-table-seat',
  imports: [PlayerAvatar, SeatPile],
  template: `
    <div class="seat" [class.with-pile]="!!seat().pile" [class.active]="active()" [class.compact]="position().startsWith('top')" [class.team-0]="seat().team === 0" [class.team-1]="seat().team === 1">
      <app-player-avatar [name]="seat().name" [avatar]="seat().avatar" [active]="active()" size="md" status="bot" />
      <div class="info">
        <span class="name">{{ seat().name }}@if (partner()) { <small> · partner</small> }</span>
        <span class="stat">{{ seat().cardCount }} cards · {{ seat().stat }}</span>
        @if (seat().badges.length) {
          <span class="badges">@for (b of seat().badges; track b) { <i>{{ b }}</i> }</span>
        }
      </div>
      @if (seat().pile; as p) { <app-seat-pile [pile]="p" [seatId]="seat().id" [label]="seat().name + '’s pile'" (pick)="pick.emit($event)" /> }
      @if (active()) { <span class="thinking" aria-label="Thinking"><b></b><b></b><b></b></span> }
    </div>
  `,
  styles: `
    :host { display: block; }
    .seat {
      position: relative; display: grid; justify-items: center; gap: 4px; padding: 8px 12px; min-width: 96px;
      border-radius: var(--radius-md); background: rgba(11,16,32,.6); border: 1px solid var(--border-color);
      transition: box-shadow var(--dur-med), border-color var(--dur-med);
      &.active { border-color: rgba(0,212,255,.6); box-shadow: var(--shadow-glow-cyan); }
      &.team-0 { border-top: 3px solid var(--color-secondary); }
      &.team-1 { border-top: 3px solid #f472b6; }
      &.with-pile { grid-auto-flow: column; align-items: center; gap: 10px; }
      &.compact { grid-auto-flow: column; align-items: center; gap: 10px; padding: 6px 12px 6px 6px; .info { justify-items: start; } }
    }
    .info { display: grid; justify-items: center; line-height: 1.25; }
    .name { font-family: var(--font-display); font-weight: 700; font-size: .9rem; small { font-weight: 500; color: var(--color-secondary); } }
    .stat { font-size: .72rem; color: var(--text-secondary); white-space: nowrap; }
    .badges { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; i { font-style: normal; font-size: .62rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; padding: 1px 6px; border-radius: 999px; background: rgba(245,158,11,.18); color: #fde68a; } }
    .thinking { position: absolute; top: -9px; right: -6px; display: flex; gap: 3px; padding: 5px 7px; border-radius: 999px; background: var(--color-secondary); }
    .thinking b { width: 5px; height: 5px; border-radius: 50%; background: #04111a; animation: dot 1s infinite; }
    .thinking b:nth-child(2) { animation-delay: .15s; } .thinking b:nth-child(3) { animation-delay: .3s; }
    @keyframes dot { 50% { transform: translateY(-3px); opacity: .5; } }
    /* Floor games put opponents two to a row on phones: a slim seat filling its cell. */
    @media (max-width: 600px) {
      :host-context(.has-floor) .seat { min-width: 0; width: 100%; padding: 4px 8px 4px 4px; gap: 6px; grid-auto-flow: column; align-items: center; justify-content: start; grid-template-columns: auto 1fr auto;
        .info { justify-items: start; min-width: 0; } .stat { overflow: hidden; text-overflow: ellipsis; } }
    }
    @media (max-width: 600px) { .seat { min-width: 76px; padding: 5px 7px; } .name { font-size: .78rem; } .stat { font-size: .66rem; } app-player-avatar { transform: scale(.8); margin: -4px; } }
  `,
})
export class TableSeat {
  readonly seat = input.required<SeatView>();
  readonly position = input.required<SeatPosition>();
  readonly active = input(false);
  readonly partner = input(false);
  /** The seat's pile was clicked (e.g. to take its top card). */
  readonly pick = output<GameAction>();
}
