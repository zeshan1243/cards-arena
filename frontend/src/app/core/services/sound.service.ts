import { Injectable, inject } from '@angular/core';
import { SettingsService } from './settings.service';

export type SoundName = 'card-deal' | 'card-play' | 'card-select' | 'turn' | 'win' | 'lose' | 'button' | 'thulla';

/**
 * Lightweight synthesized sound effects (spec §40) using the Web Audio API,
 * so the MVP needs no audio assets. Can be swapped for mp3 files later.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly settings = inject(SettingsService);
  private ctx: AudioContext | null = null;

  play(name: SoundName): void {
    const s = this.settings.settings();
    if (!s.sound || !s.effects) return;
    const ctx = this.context();
    if (!ctx) return;
    const now = ctx.currentTime;
    switch (name) {
      case 'card-play': return this.noiseBurst(ctx, now, 0.07, 2400);
      case 'card-deal': return this.noiseBurst(ctx, now, 0.04, 3200);
      case 'card-select': return this.tone(ctx, now, 880, 0.05, 'triangle', 0.05);
      case 'button': return this.tone(ctx, now, 600, 0.05, 'sine', 0.05);
      case 'turn': return this.chord(ctx, now, [660, 990], 0.18, 0.06);
      case 'thulla':
        this.tone(ctx, now, 220, 0.25, 'sawtooth', 0.06);
        return this.tone(ctx, now + 0.08, 160, 0.3, 'sawtooth', 0.05);
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(ctx, now + i * 0.11, f, 0.28, 'triangle', 0.08));
        return;
      case 'lose':
        [392, 330, 262].forEach((f, i) => this.tone(ctx, now + i * 0.16, f, 0.32, 'sine', 0.08));
        return;
    }
  }

  private context(): AudioContext | null {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(ctx: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, vol: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private chord(ctx: AudioContext, at: number, freqs: number[], dur: number, vol: number): void {
    freqs.forEach((f) => this.tone(ctx, at, f, dur, 'sine', vol));
  }

  private noiseBurst(ctx: AudioContext, at: number, dur: number, cutoff: number): void {
    const length = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(at);
  }
}
