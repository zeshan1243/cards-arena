import { Injectable } from '@angular/core';

/** Safe wrapper around localStorage (private mode / disabled storage won't crash the app). */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly prefix = 'cardarena.';

  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      /* storage unavailable */
    }
  }
}
