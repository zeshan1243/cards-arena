import { Component, input, output } from '@angular/core';
import { PlayingCard } from '../../../shared/components/playing-card/playing-card';
import { GameAction, SeatView } from '../table-game';

/** A player's captured pile: its top card and size, clickable when it can be taken from. */
@Component({
  selector: 'app-seat-pile',
  imports: [PlayingCard],
  template: `
    <button type="button" class="pile" [class.can-take]="!!pile().action" [disabled]="!pile().action" [attr.data-seat-pile]="seatId()"
            [attr.aria-label]="label() + ', ' + pile().count + ' cards' + (pile().action ? ' — take the top card' : '')" (click)="take()">
      @if (pile().count > 1) { <span class="under" aria-hidden="true"></span> }
      @for (c of top(); track c.id) {
        <app-playing-card class="top" [card]="c" size="fluid" />
      } @empty { <span class="slot" aria-hidden="true"></span> }
      <span class="count">{{ pile().count }}</span>
    </button>
  `,
  styles: `
    :host { display: block; --card-w: 34px; }
    .pile { position: relative; display: block; width: var(--card-w); aspect-ratio: 5 / 7; padding: 0; border: 0; background: none; color: inherit; font: inherit; border-radius: 5px; line-height: 0; }
    .pile:disabled { cursor: default; }
    .under { position: absolute; inset: 0; transform: translate(3px, -3px) rotate(4deg); border-radius: 5px; background: #e9e9f2; box-shadow: 0 1px 3px rgba(0,0,0,.4); }
    .top { position: relative; display: block; animation: land 360ms var(--ease-out); }
    .slot { display: block; width: 100%; height: 100%; border-radius: 5px; border: 2px dashed rgba(255,255,255,.22); }
    .count { position: absolute; right: -8px; bottom: -6px; min-width: 18px; padding: 1px 5px; border-radius: 999px; background: var(--bg-elevated); border: 1px solid var(--border-color); font-size: .62rem; font-weight: 800; line-height: 1.4; text-align: center; }
    .can-take { cursor: pointer; box-shadow: 0 0 0 3px rgba(0,212,255,.8), 0 0 18px rgba(0,212,255,.5); animation: glow 1.4s ease-in-out infinite; }
    .can-take:hover { transform: translateY(-2px); }
    .can-take:focus-visible { outline: 3px solid var(--color-secondary); outline-offset: 3px; }
    @keyframes land { from { transform: scale(1.35) rotate(-8deg); opacity: .3; } }
    @keyframes glow { 50% { box-shadow: 0 0 0 3px rgba(0,212,255,.35), 0 0 8px rgba(0,212,255,.2); } }
    @media (max-width: 600px) { :host { --card-w: 28px; } }
  `,
})
export class SeatPile {
  readonly pile = input.required<NonNullable<SeatView['pile']>>();
  readonly seatId = input.required<string>();
  /** e.g. "Bilal’s pile". */
  readonly label = input('Pile');
  readonly pick = output<GameAction>();

  top() {
    const t = this.pile().top;
    return t ? [t] : [];
  }

  take(): void {
    const a = this.pile().action;
    if (a) this.pick.emit(a);
  }
}
