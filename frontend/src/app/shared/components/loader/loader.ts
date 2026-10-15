import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loader',
  template: `
    <div class="loader" role="status" aria-live="polite">
      <div class="cards" aria-hidden="true"><span></span><span></span><span></span></div>
      @if (message()) { <p>{{ message() }}</p> }
    </div>
  `,
  styles: `
    .loader { display: grid; justify-items: center; gap: 18px; padding: 32px; }
    .cards { position: relative; width: 70px; height: 70px; }
    .cards span {
      position: absolute; left: 20px; top: 6px; width: 32px; height: 46px; border-radius: 6px;
      background: linear-gradient(145deg, #6c5ce7, #2d1f8f); border: 2px solid #fff;
      animation: fan 1.2s var(--ease-out) infinite;
      &:nth-child(2) { animation-delay: .12s; } &:nth-child(3) { animation-delay: .24s; }
    }
    p { margin: 0; font-family: var(--font-display); font-weight: 600; letter-spacing: .04em; color: var(--text-secondary); }
    @keyframes fan { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(var(--r, 24deg)) translateX(6px); } }
    .cards span:nth-child(1) { --r: -24deg; } .cards span:nth-child(2) { --r: 0deg; }
  `,
})
export class Loader {
  readonly message = input<string>('');
}
