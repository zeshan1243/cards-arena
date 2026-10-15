import { Component, ElementRef, HostListener, effect, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    @if (open()) {
      <div class="backdrop" (click)="dismissible() && closed.emit()"></div>
      <div class="modal panel" role="dialog" aria-modal="true" [attr.aria-label]="label()" tabindex="-1" #dialog [class.wide]="wide()">
        @if (dismissible()) {
          <button class="close" type="button" aria-label="Close" (click)="closed.emit()">×</button>
        }
        <ng-content />
      </div>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(5, 8, 18, .72); backdrop-filter: blur(6px); animation: fade var(--dur-med); }
    .modal {
      position: fixed; z-index: 101; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; padding: 28px;
      animation: pop var(--dur-slow) var(--ease-out); outline: none;
      &.wide { width: min(640px, calc(100vw - 32px)); }
    }
    .close { position: absolute; right: 12px; top: 10px; width: 40px; height: 40px; border: 0; background: none; color: var(--text-secondary); font-size: 26px; cursor: pointer; border-radius: 50%; &:hover { background: rgba(255,255,255,.06); } }
    @keyframes fade { from { opacity: 0; } }
    @keyframes pop { from { opacity: 0; transform: translate(-50%, -46%) scale(.94); } }
  `,
})
export class Modal {
  readonly open = input(false);
  readonly label = input('Dialog');
  readonly dismissible = input(true);
  readonly wide = input(false);
  readonly closed = output<void>();
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog()?.nativeElement;
      if (this.open() && el) queueMicrotask(() => (el.querySelector<HTMLElement>('[autofocus], .btn') ?? el).focus());
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open() && this.dismissible()) this.closed.emit();
  }
}
