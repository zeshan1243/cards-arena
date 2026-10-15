import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-bt-game-controls',
  template: `
    <div class="controls" role="toolbar" aria-label="Game controls">
      <button type="button" class="ctl" (click)="hint.emit()" [disabled]="!myTurn()" title="Hint">
        <span aria-hidden="true">💡</span><span class="lbl">Hint</span>
      </button>
      <button type="button" class="ctl" (click)="autoPlay.emit()" [class.on]="autoPlayOn()" [attr.aria-pressed]="autoPlayOn()" title="Auto play">
        <span aria-hidden="true">🤖</span><span class="lbl">Auto</span>
      </button>
      <button type="button" class="ctl" (click)="sound.emit()" [class.on]="soundOn()" [attr.aria-pressed]="soundOn()" title="Sound">
        <span aria-hidden="true">{{ soundOn() ? '🔊' : '🔇' }}</span><span class="lbl">Sound</span>
      </button>
      <button type="button" class="ctl" (click)="rules.emit()" title="Rules">
        <span aria-hidden="true">📖</span><span class="lbl">Rules</span>
      </button>
      <button type="button" class="ctl" (click)="settings.emit()" title="Settings">
        <span aria-hidden="true">⚙️</span><span class="lbl">Settings</span>
      </button>
      <button type="button" class="ctl leave" (click)="leave.emit()" title="Leave game">
        <span aria-hidden="true">🚪</span><span class="lbl">Leave</span>
      </button>
    </div>
  `,
  styles: `
    .controls { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
    .ctl {
      display: grid; justify-items: center; gap: 2px; min-width: 56px; min-height: 52px; padding: 6px 8px;
      border-radius: var(--radius-md); border: 1px solid var(--border-color); background: rgba(255,255,255,.04);
      color: var(--text-primary); cursor: pointer; font-size: 1.1rem; transition: background var(--dur-fast), border-color var(--dur-fast);
      &:hover:not(:disabled) { background: rgba(255,255,255,.1); }
      &:disabled { opacity: .4; cursor: not-allowed; }
      &.on { border-color: rgba(0,212,255,.6); background: rgba(0,212,255,.12); }
      &.leave:hover { border-color: rgba(239,68,68,.6); }
    }
    .lbl { font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-secondary); }
  `,
})
export class GameControls {
  readonly myTurn = input(false);
  readonly autoPlayOn = input(false);
  readonly soundOn = input(true);
  readonly hint = output<void>();
  readonly autoPlay = output<void>();
  readonly sound = output<void>();
  readonly rules = output<void>();
  readonly settings = output<void>();
  readonly leave = output<void>();
}
