import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Site-wide Adsterra units (popunder + social bar). Banners live in `AdBanner`. */
const GLOBAL_AD_SCRIPTS = [
  'https://abscloud.org/1/7e73ec51cfda35740991c219641c9725',
  'https://bauval.org/14/1f99b6870942d7f3f777f4621994afa1',
];

@Injectable({ providedIn: 'root' })
export class AdsService {
  private readonly document = inject(DOCUMENT);
  private loaded = false;

  /** Injects the global ad scripts once; safe to call repeatedly. */
  loadGlobalScripts(): void {
    if (this.loaded) return;
    this.loaded = true;
    for (const src of GLOBAL_AD_SCRIPTS) {
      const script = this.document.createElement('script');
      script.src = src;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      this.document.body.appendChild(script);
    }
  }
}
