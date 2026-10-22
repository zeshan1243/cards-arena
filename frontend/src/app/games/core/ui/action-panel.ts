import { Component, input, output } from '@angular/core';
import { CardSelection, GameAction, LegalAction } from '../table-game';

/** Non-card decisions (bids, trump, pass…) and alternative ways to play the selected card. */
@Component({
  selector: 'app-action-panel',
  template: `
    @if (actions().length || options().length > 1 || (selection() && !selection()!.targetId)) {
      <div class="panel-actions" role="group" aria-label="Choose an action">
        @if (selection(); as sel) {
          @if (!sel.targetId) {
          <span class="prompt">{{ sel.label }} ({{ sel.minCount === undefined ? selectedCount() + '/' + sel.count : selectedCount() + ' selected' }})</span>
          <button class="btn btn-primary btn-sm" type="button" [disabled]="selectedCount() < (sel.minCount ?? sel.count) || selectedCount() > sel.count" (click)="confirm.emit()">{{ sel.confirmLabel ?? 'Confirm' }}</button>
          }
        }
        @if (options().length > 1) {
          <span class="prompt">Play this card:</span>
          @for (o of options(); track o.label) {
            <button class="btn btn-cyan btn-sm" type="button" (click)="act.emit(o)">{{ o.label }}</button>
          }
        }
        @if (actions().length) {
          @if (prompt()) { <span class="prompt">{{ prompt() }}</span> }
          <div class="buttons" [class.many]="actions().length > 6">
            @for (a of actions(); track a.label) {
              <button type="button" class="btn btn-sm" [class.btn-primary]="a.type !== 'pass' || onlyPass()" [class.btn-ghost]="a.type === 'pass' && !onlyPass()" (click)="act.emit(a)">{{ a.label }}</button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    .panel-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; padding: 10px 12px; margin: 0 auto; width: min(760px, 100%);
      border-radius: var(--radius-md); background: rgba(108,92,231,.14); border: 1px solid rgba(108,92,231,.45); animation: pop var(--dur-med) var(--ease-out); }
    .prompt { font-family: var(--font-display); font-weight: 700; font-size: .85rem; }
    .buttons { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .buttons.many .btn { min-width: 44px; padding: 0 10px; }
    @keyframes pop { from { opacity: 0; transform: translateY(6px); } }
  `,
})
export class ActionPanel {
  readonly actions = input<LegalAction[]>([]);
  readonly options = input<LegalAction[]>([]);
  readonly selection = input<CardSelection | null>(null);
  readonly selectedCount = input(0);
  readonly prompt = input('');
  readonly act = output<GameAction>();

  /** Pass is the only move left (e.g. nothing in hand beats the table). */
  onlyPass(): boolean {
    return !this.selection() && this.actions().length === 1 && this.actions()[0].type === 'pass';
  }
  readonly confirm = output<void>();
}
