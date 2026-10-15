import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-game-timer',
  template: `
    <div class="timer" [class.low]="low()" role="timer" [attr.aria-label]="seconds() + ' seconds left'">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" class="track" />
        <circle cx="20" cy="20" r="17" class="bar" [style.stroke-dashoffset]="offset()" />
      </svg>
      <span>{{ display() }}</span>
    </div>
  `,
  styles: `
    .timer { position: relative; width: 56px; height: 56px; display: grid; place-items: center; }
    svg { position: absolute; inset: 0; transform: rotate(-90deg); }
    circle { fill: none; stroke-width: 3.5; }
    .track { stroke: rgba(255,255,255,.1); }
    .bar { stroke: var(--color-secondary); stroke-linecap: round; stroke-dasharray: 106.8; transition: stroke-dashoffset 1s linear, stroke .3s; }
    span { font-family: var(--font-display); font-weight: 800; font-size: .82rem; font-variant-numeric: tabular-nums; }
    .low .bar { stroke: var(--color-danger); }
    .low span { color: #fca5a5; animation: blink .5s steps(2) infinite; }
    @keyframes blink { 50% { opacity: .5; } }
  `,
})
export class GameTimer {
  readonly seconds = input.required<number>();
  readonly total = input(20);
  readonly low = computed(() => this.seconds() <= 5);
  readonly offset = computed(() => 106.8 * (1 - Math.max(0, this.seconds()) / this.total()));
  readonly display = computed(() => `00:${String(Math.max(0, this.seconds())).padStart(2, '0')}`);
}
