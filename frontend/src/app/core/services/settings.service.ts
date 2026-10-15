import { Injectable, effect, inject, signal } from '@angular/core';
import { Difficulty } from '../../shared/models/game.model';
import { BhabhiVariant } from '../../games/bhabhi-thulla/engine/bhabhi-thulla.rules';
import { StorageService } from './storage.service';

export interface Settings {
  sound: boolean;
  effects: boolean;
  music: boolean;
  difficulty: Difficulty;
  playerCount: number;
  bhabhiVariant: BhabhiVariant;
  gameSpeed: 'slow' | 'normal' | 'fast';
  turnTimer: boolean;
  reducedMotion: boolean;
}

const DEFAULTS: Settings = {
  sound: true,
  effects: true,
  music: false,
  difficulty: 'normal',
  playerCount: 4,
  bhabhiVariant: 'pakistan',
  gameSpeed: 'normal',
  turnTimer: true,
  reducedMotion: false,
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(StorageService);
  readonly settings = signal<Settings>({ ...DEFAULTS, ...this.storage.get<Partial<Settings>>('settings', {}) });

  constructor() {
    effect(() => {
      const s = this.settings();
      this.storage.set('settings', s);
      document.documentElement.classList.toggle('reduce-motion', s.reducedMotion);
    });
  }

  update(patch: Partial<Settings>): void {
    this.settings.update((s) => ({ ...s, ...patch }));
  }

  reset(): void {
    this.settings.set({ ...DEFAULTS });
  }
}
