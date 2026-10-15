import { Component, inject, output } from '@angular/core';
import { SettingsService } from '../../../../core/services/settings.service';
import { Difficulty } from '../../../../shared/models/game.model';
import { BhabhiVariant, VARIANT_DESCRIPTIONS } from '../../engine/bhabhi-thulla.rules';

@Component({
  selector: 'app-bt-game-setup',
  template: `
    <div class="setup">
      <span class="eyebrow">Play vs AI</span>
      <h1>Bhabhi Thulla</h1>
      <p class="text-secondary">Shed your cards, dodge the Thulla and don’t be the last one holding cards.</p>

      <fieldset>
        <legend>Players</legend>
        <div class="segmented">
          @for (n of [3, 4, 5, 6]; track n) {
            <button type="button" [attr.aria-pressed]="s().playerCount === n" (click)="settings.update({ playerCount: n })">{{ n }}</button>
          }
        </div>
      </fieldset>

      <fieldset>
        <legend>Bot difficulty</legend>
        <div class="segmented">
          @for (d of difficulties; track d.value) {
            <button type="button" [attr.aria-pressed]="s().difficulty === d.value" (click)="settings.update({ difficulty: d.value })">{{ d.label }}</button>
          }
        </div>
        <p class="help">{{ difficultyHelp[s().difficulty] }}</p>
      </fieldset>

      <fieldset>
        <legend>Rules</legend>
        <div class="segmented">
          @for (v of variants; track v) {
            <button type="button" [attr.aria-pressed]="s().bhabhiVariant === v" (click)="settings.update({ bhabhiVariant: v })">{{ variantNames[v] }}</button>
          }
        </div>
        <ul class="help">
          @for (r of variantInfo[s().bhabhiVariant].rules; track r) { <li>{{ r }}</li> }
        </ul>
      </fieldset>

      <button class="btn btn-primary btn-lg btn-block" type="button" (click)="start.emit()" autofocus>Deal cards</button>
    </div>
  `,
  styles: `
    .setup { width: min(520px, 100%); margin: 0 auto; padding: 28px 22px; text-align: center; }
    h1 { font-size: clamp(2rem, 6vw, 3rem); margin-bottom: 6px; }
    fieldset { border: 0; padding: 0; margin: 22px 0 0; display: grid; justify-items: center; gap: 10px; }
    legend { font-family: var(--font-display); font-weight: 700; font-size: .78rem; letter-spacing: .12em; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 10px; }
    .segmented { justify-content: center; }
    .help { margin: 0; font-size: .85rem; color: var(--text-secondary); text-align: left; padding-left: 18px; }
    p.help { text-align: center; padding: 0; }
    .btn { margin-top: 28px; }
  `,
})
export class GameSetup {
  readonly settings = inject(SettingsService);
  readonly s = this.settings.settings;
  readonly start = output<void>();

  readonly difficulties: { value: Difficulty; label: string }[] = [
    { value: 'easy', label: 'Easy' },
    { value: 'normal', label: 'Normal' },
    { value: 'hard', label: 'Hard' },
    { value: 'expert', label: 'Expert' },
  ];
  readonly difficultyHelp: Record<Difficulty, string> = {
    easy: 'Relaxed bots that often play loosely.',
    normal: 'Sensible bots that duck and shed high cards.',
    hard: 'Bots remember who is void in each suit.',
    expert: 'Bots count cards and estimate Thulla risk.',
  };
  readonly variants: BhabhiVariant[] = ['pakistan', 'india', 'custom'];
  readonly variantNames: Record<BhabhiVariant, string> = { pakistan: 'Pakistan', india: 'India', custom: 'Open start' };
  readonly variantInfo = VARIANT_DESCRIPTIONS;
}
