import { Component, computed, input } from '@angular/core';

const GRADIENTS = [
  ['#6C5CE7', '#00D4FF'],
  ['#F59E0B', '#EF4444'],
  ['#22C55E', '#14B8A6'],
  ['#EC4899', '#8B5CF6'],
  ['#3B82F6', '#06B6D4'],
  ['#F97316', '#FACC15'],
];

@Component({
  selector: 'app-player-avatar',
  template: `
    <span class="avatar" [class]="'avatar ' + size()" [class.active]="active()" [style.background]="background()" role="img" [attr.aria-label]="name()">
      @if (isImage()) {
        <img [src]="avatar()" alt="" />
      } @else {
        <span class="glyph">{{ glyph() }}</span>
      }
      @if (status(); as s) {
        <span class="status" [class]="'status ' + s" aria-hidden="true"></span>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    .avatar {
      position: relative; display: grid; place-items: center; border-radius: 50%;
      color: #fff; font-family: var(--font-display); font-weight: 800;
      border: 2px solid rgba(255,255,255,.18); box-shadow: 0 6px 16px rgba(0,0,0,.35);
      transition: box-shadow var(--dur-med), transform var(--dur-med);
      img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    }
    .xs { width: 24px; height: 24px; font-size: 11px; border-width: 1px; }
    .sm { width: 34px; height: 34px; font-size: 14px; }
    .md { width: 52px; height: 52px; font-size: 22px; }
    .lg { width: 72px; height: 72px; font-size: 32px; }
    .xl { width: 112px; height: 112px; font-size: 52px; }
    .active { box-shadow: var(--shadow-glow-cyan); animation: pulse 1.4s ease-in-out infinite; }
    .status { position: absolute; right: 0; bottom: 0; width: 28%; height: 28%; border-radius: 50%; border: 2px solid var(--bg-primary); }
    .online { background: var(--color-success); }
    .offline { background: var(--color-danger); }
    .bot { background: var(--color-secondary); }
    @keyframes pulse { 50% { transform: scale(1.06); } }
  `,
})
export class PlayerAvatar {
  readonly name = input.required<string>();
  readonly avatar = input<string | null | undefined>(null);
  readonly size = input<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly active = input(false);
  readonly status = input<'online' | 'offline' | 'bot' | null>(null);

  readonly isImage = computed(() => /^(https?:|\/|data:)/.test(this.avatar() ?? ''));
  readonly glyph = computed(() => this.avatar() || this.name().slice(0, 1).toUpperCase());
  readonly background = computed(() => {
    const hash = [...this.name()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const [a, b] = GRADIENTS[hash % GRADIENTS.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
  });
}
