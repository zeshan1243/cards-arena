import { Component, computed, input } from '@angular/core';

/** Generated SVG artwork for a game tile: a fan of cards over an accent glow. */
@Component({
  selector: 'app-game-art',
  template: `
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" [attr.role]="label() ? 'img' : null"
         [attr.aria-label]="label() || null" [attr.aria-hidden]="label() ? null : 'true'">
      <defs>
        <radialGradient [attr.id]="gid() + '-bg'" cx="50%" cy="60%" r="75%">
          <stop offset="0%" [attr.stop-color]="accent()" stop-opacity=".75" />
          <stop offset="60%" [attr.stop-color]="accent()" stop-opacity=".18" />
          <stop offset="100%" stop-color="#0B1020" stop-opacity="1" />
        </radialGradient>
        <linearGradient [attr.id]="gid() + '-card'" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#e9e9f2" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" [attr.fill]="'url(#' + gid() + '-bg)'" />
      <g opacity=".12" fill="#fff" font-size="26" font-family="serif">
        @for (p of pattern; track $index) {
          <text [attr.x]="p.x" [attr.y]="p.y">{{ symbols()[$index % symbols().length] }}</text>
        }
      </g>
      <g transform="translate(160 196)">
        @for (s of symbols(); track $index) {
          <g [attr.transform]="'rotate(' + angle($index) + ') translate(-34 -150)'">
            <rect width="68" height="96" rx="8" [attr.fill]="'url(#' + gid() + '-card)'" stroke="rgba(0,0,0,.15)" />
            <text x="10" y="22" font-size="16" font-weight="800" font-family="Outfit, sans-serif" [attr.fill]="color(s)">{{ rankFor($index) }}</text>
            <text x="34" y="66" font-size="34" text-anchor="middle" [attr.fill]="color(s)">{{ s }}</text>
          </g>
        }
      </g>
    </svg>
  `,
  styles: `:host { display: block; } svg { display: block; width: 100%; height: 100%; }`,
})
export class GameArt {
  readonly art = input.required<string>();
  readonly accent = input('#6C5CE7');
  readonly label = input('');
  readonly slug = input('art');

  readonly symbols = computed(() => [...this.art()]);
  readonly gid = computed(() => `ga-${this.slug()}`);
  readonly pattern = Array.from({ length: 24 }, (_, i) => ({ x: (i % 8) * 44 + (Math.floor(i / 8) % 2) * 22, y: Math.floor(i / 8) * 64 + 30 }));

  angle(i: number): number {
    const n = this.symbols().length;
    return (i - (n - 1) / 2) * 16;
  }

  rankFor(i: number): string {
    return ['A', 'K', 'Q', 'J'][i % 4];
  }

  color(symbol: string): string {
    return symbol === '♥' || symbol === '♦' ? '#e11d48' : '#1b1f2e';
  }
}
