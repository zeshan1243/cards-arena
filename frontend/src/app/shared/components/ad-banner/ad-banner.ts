import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

export type AdBannerSize = '160x300' | '160x600';

/**
 * Adsterra iframe banner. Each unit runs in its own iframe (public/ads/*.html) because
 * Adsterra reads a global `atOptions`, which would clash with several banners on one page.
 */
@Component({
  selector: 'app-ad-banner',
  template: `
    <iframe
      [src]="src()"
      [width]="width()"
      [height]="height()"
      title="Advertisement"
      loading="lazy"
      scrolling="no"
    ></iframe>
  `,
  styles: `
    :host { display: block; line-height: 0; }
    iframe { border: 0; display: block; }
  `,
})
export class AdBanner {
  private readonly sanitizer = inject(DomSanitizer);
  readonly size = input.required<AdBannerSize>();
  // Same-origin static file from public/ads, so trusting it is safe.
  readonly src = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(`/ads/banner-${this.size()}.html`),
  );
  readonly width = computed(() => Number(this.size().split('x')[0]));
  readonly height = computed(() => Number(this.size().split('x')[1]));
}
