import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'error' | 'achievement';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(kind: ToastKind, title: string, message?: string, durationMs = 3800): void {
    const toast = { id: this.nextId++, kind, title, message };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  success(title: string, message?: string) { this.show('success', title, message); }
  error(title: string, message?: string) { this.show('error', title, message, 5000); }
  info(title: string, message?: string) { this.show('info', title, message); }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
