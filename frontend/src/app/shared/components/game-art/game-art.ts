import { Component, computed, input } from '@angular/core';

const DICE_PIPS: Record<number, number[][]> = {
  1: [[0, 0]],
  3: [[-1, -1], [0, 0], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

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
      @if (slug() === 'checkers') {
        <!-- A corner of a checkers board in perspective, with a few pieces and a king. -->
        <g transform="translate(160 112) scale(1 .55) rotate(45)">
          @for (sq of boardSquares; track $index) {
            <rect [attr.x]="sq.x" [attr.y]="sq.y" width="34" height="34" [attr.fill]="sq.dark ? '#b07a4f' : '#f1dfb8'" />
          }
          @for (pc of checkerPieces; track $index) {
            <circle [attr.cx]="pc.x" [attr.cy]="pc.y" r="13" [attr.fill]="pc.red ? '#e11d48' : '#1e293b'" stroke="rgba(255,255,255,.45)" stroke-width="2" />
          }
        </g>
      } @else if (slug() === 'yacht-dice' || slug() === 'farkle') {
        <!-- Three tumbling dice. -->
        @for (d of slug() === 'farkle' ? farkleDice : dice; track $index) {
          <g [attr.transform]="'translate(' + d.x + ' ' + d.y + ') rotate(' + d.r + ')'">
            <rect x="-30" y="-30" width="60" height="60" rx="12" [attr.fill]="'url(#' + gid() + '-card)'" stroke="rgba(0,0,0,.18)" />
            @for (p of d.pips; track $index) {
              <circle [attr.cx]="p[0] * 17" [attr.cy]="p[1] * 17" r="6" fill="#1b1f2e" />
            }
          </g>
        }
      } @else {
      <g transform="translate(160 196)">
        @for (s of symbols(); track $index) {
          <g [attr.transform]="'rotate(' + angle($index) + ') translate(-34 -150)'">
            <rect width="68" height="96" rx="8" [attr.fill]="'url(#' + gid() + '-card)'" stroke="rgba(0,0,0,.15)" />
            <text x="10" y="22" font-size="16" font-weight="800" font-family="Outfit, sans-serif" [attr.fill]="color(s)">{{ rankFor($index) }}</text>
            <text x="34" y="66" font-size="34" text-anchor="middle" [attr.fill]="color(s)">{{ s }}</text>
          </g>
        }
      </g>
      }
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

  readonly boardSquares = Array.from({ length: 36 }, (_, i) => ({ x: (i % 6) * 34 - 102, y: Math.floor(i / 6) * 34 - 102, dark: ((i % 6) + Math.floor(i / 6)) % 2 === 1 }));
  readonly checkerPieces = [
    [1, 0, false], [3, 0, false], [0, 1, false], [2, 1, false], [3, 2, true], [1, 4, true], [2, 5, true], [4, 5, true], [5, 4, false],
  ].map(([c, r, red]) => ({ x: (c as number) * 34 - 85, y: (r as number) * 34 - 85, red: red as boolean }));

  readonly dice = [
    { x: 100, y: 108, r: -14, face: 5 },
    { x: 165, y: 82, r: 9, face: 6 },
    { x: 225, y: 116, r: -6, face: 3 },
  ].map((d) => ({ ...d, pips: DICE_PIPS[d.face] }));

  readonly farkleDice = [
    { x: 92, y: 112, r: 12, face: 1 },
    { x: 160, y: 84, r: -8, face: 5 },
    { x: 228, y: 114, r: 16, face: 1 },
  ].map((d) => ({ ...d, pips: DICE_PIPS[d.face] }));

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
