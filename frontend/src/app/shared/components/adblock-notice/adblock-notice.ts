import { Component, computed, inject, signal } from '@angular/core';
import { AdsService } from '../../../core/services/ads.service';
import { StorageService } from '../../../core/services/storage.service';
import { Modal } from '../modal/modal';

const DISMISSED_KEY = 'adblockNoticeDismissedAt';
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;

/** Polite, dismissible request to allow ads. Shown at most once a day. */
@Component({
  selector: 'app-adblock-notice',
  imports: [Modal],
  template: `
    <app-modal [open]="open()" (closed)="dismiss()" label="Ad blocker detected">
      <div class="notice">
        <div class="emoji" aria-hidden="true">🃏</div>
        <h2>Ad blocker detected</h2>
        <p class="text-secondary">
          CardArena is free, and ads are how we keep it that way. Please allow ads on
          <b>cardsarena.world</b> — we keep them away from your cards.
        </p>
        <ol class="steps text-secondary">
          <li>Click your ad blocker's icon in the browser toolbar.</li>
          <li>Choose <b>Pause</b> or <b>Don't run on this site</b>.</li>
          <li>Reload the page.</li>
        </ol>
        <button class="btn btn-primary btn-block" type="button" (click)="reload()">I've allowed ads — reload</button>
        <button class="btn btn-ghost btn-block" type="button" (click)="dismiss()">Continue anyway</button>
      </div>
    </app-modal>
  `,
  styles: `
    .notice { display: grid; gap: 12px; text-align: center; }
    .emoji { font-size: 40px; }
    h2 { margin: 0; }
    p { margin: 0; }
    .steps { text-align: left; margin: 0; padding-left: 20px; display: grid; gap: 4px; font-size: .92rem; }
  `,
})
export class AdblockNotice {
  private readonly ads = inject(AdsService);
  private readonly storage = inject(StorageService);
  private readonly dismissedAt = signal(this.storage.get<number>(DISMISSED_KEY, 0));

  readonly open = computed(() => this.ads.blocked() && Date.now() - this.dismissedAt() > REMIND_AFTER_MS);

  dismiss(): void {
    const now = Date.now();
    this.storage.set(DISMISSED_KEY, now);
    this.dismissedAt.set(now);
  }

  reload(): void {
    location.reload();
  }
}
