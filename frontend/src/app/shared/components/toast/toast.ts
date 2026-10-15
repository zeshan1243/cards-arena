import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="stack" aria-live="polite" aria-atomic="false">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class]="'toast ' + t.kind" role="status">
          <span class="icon" aria-hidden="true">{{ icon(t.kind) }}</span>
          <div>
            <strong>{{ t.title }}</strong>
            @if (t.message) { <p>{{ t.message }}</p> }
          </div>
          <button type="button" aria-label="Dismiss" (click)="toasts.dismiss(t.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack { position: fixed; z-index: 200; right: 16px; bottom: calc(16px + var(--sticky-ad-h, 0px)); left: 16px; display: grid; gap: 10px; justify-items: end; pointer-events: none; }
    .toast {
      pointer-events: auto; display: flex; gap: 12px; align-items: flex-start; width: min(380px, 100%);
      padding: 14px 14px 14px 16px; border-radius: var(--radius-md); background: var(--bg-elevated);
      border: 1px solid var(--border-strong); box-shadow: var(--shadow-card); animation: in var(--dur-med) var(--ease-out);
      &.success { border-color: rgba(34,197,94,.5); } &.error { border-color: rgba(239,68,68,.5); }
      &.achievement { border-color: rgba(245,158,11,.6); box-shadow: 0 0 30px rgba(245,158,11,.25); }
      p { margin: 2px 0 0; font-size: .85rem; color: var(--text-secondary); }
      strong { font-family: var(--font-display); }
      div { flex: 1; }
      button { background: none; border: 0; color: var(--text-secondary); font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; }
    }
    .icon { font-size: 20px; }
    @keyframes in { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
  `,
})
export class ToastContainer {
  readonly toasts = inject(ToastService);
  icon(kind: string): string {
    return ({ success: '✅', error: '⚠️', info: 'ℹ️', achievement: '🏆' } as Record<string, string>)[kind] ?? '';
  }
}
