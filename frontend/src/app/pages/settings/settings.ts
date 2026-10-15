import { Component, inject } from '@angular/core';
import { SeoService } from '../../core/services/seo.service';
import { SettingsService } from '../../core/services/settings.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-settings',
  template: `
    <section class="section container">
      <span class="eyebrow">Preferences</span>
      <h1>Settings</h1>
      <div class="grid">
        <div class="panel block">
          <h2>Sound</h2>
          <label class="toggle"><input type="checkbox" [checked]="s().sound" (change)="svc.update({ sound: $any($event.target).checked })" /> All sound</label>
          <label class="toggle"><input type="checkbox" [checked]="s().effects" (change)="svc.update({ effects: $any($event.target).checked })" /> Sound effects</label>
          <label class="toggle"><input type="checkbox" [checked]="s().music" (change)="svc.update({ music: $any($event.target).checked })" /> Music <small>(coming soon)</small></label>
        </div>
        <div class="panel block">
          <h2>Gameplay</h2>
          <div class="field">
            <label for="speed">Game speed</label>
            <select id="speed" class="input" [value]="s().gameSpeed" (change)="svc.update({ gameSpeed: $any($event.target).value })">
              <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option>
            </select>
          </div>
          <div class="field">
            <label for="difficulty">Default bot difficulty</label>
            <select id="difficulty" class="input" [value]="s().difficulty" (change)="svc.update({ difficulty: $any($event.target).value })">
              <option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option><option value="expert">Expert</option>
            </select>
          </div>
          <label class="toggle"><input type="checkbox" [checked]="s().turnTimer" (change)="svc.update({ turnTimer: $any($event.target).checked })" /> Turn timer</label>
        </div>
        <div class="panel block">
          <h2>Accessibility</h2>
          <label class="toggle"><input type="checkbox" [checked]="s().reducedMotion" (change)="svc.update({ reducedMotion: $any($event.target).checked })" /> Reduce motion</label>
          <p class="text-secondary small">Your system “reduce motion” preference is always respected.</p>
          <div class="field"><label>Theme</label><select class="input" disabled><option>Dark gaming</option></select></div>
          <div class="field"><label>Language</label><select class="input" disabled><option>English</option></select></div>
        </div>
      </div>
      <button class="btn btn-ghost" type="button" (click)="reset()">Reset to defaults</button>
    </section>
  `,
  styles: `
    .grid { display: grid; gap: 16px; margin: 20px 0; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); }
    .block { padding: 22px; display: grid; gap: 14px; align-content: start; h2 { font-size: 1.2rem; margin: 0; } }
    .toggle { display: flex; align-items: center; gap: 10px; font-weight: 600; cursor: pointer; min-height: 32px; input { width: 20px; height: 20px; accent-color: var(--color-primary); } small { color: var(--text-muted); font-weight: 400; } }
    .field { margin: 0; }
    .small { font-size: .85rem; margin: 0; }
  `,
})
export class SettingsPage {
  readonly svc = inject(SettingsService);
  private readonly toast = inject(ToastService);
  readonly s = this.svc.settings;

  constructor() {
    inject(SeoService).apply({ title: 'Settings | CardArena', description: 'CardArena settings.', path: '/settings', noindex: true });
  }

  reset(): void {
    this.svc.reset();
    this.toast.success('Settings reset');
  }
}
