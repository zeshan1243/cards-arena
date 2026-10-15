import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/** Adsterra Smartlink: a plain URL, shown as a labelled "Sponsored" link. */
export const SMARTLINK_URL = 'https://araplhn.org/4/a9ef72d12c902b3b6eafb0ff07a1f0cb';

/**
 * Site-wide Adsterra units (social bar). Banners live in `AdBanner`.
 * No popunder: it opened a new tab on every card click during games.
 */
const GLOBAL_AD_SCRIPTS = ['https://bauval.org/14/1f99b6870942d7f3f777f4621994afa1'];

@Injectable({ providedIn: 'root' })
export class AdsService {
  private readonly document = inject(DOCUMENT);
  private loaded = false;
  /** True once an ad blocker is detected (ad script blocked, or bait element hidden). */
  readonly blocked = signal(false);

  /** Injects the global ad scripts once; safe to call repeatedly. */
  loadGlobalScripts(): void {
    if (this.loaded) return;
    this.loaded = true;
    for (const src of GLOBAL_AD_SCRIPTS) {
      const script = this.document.createElement('script');
      script.src = src;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.onerror = () => this.blocked.set(true);
      this.document.body.appendChild(script);
    }
    this.checkBait();
  }

  /** Cosmetic filters (uBlock, AdGuard, Brave) hide elements with ad-like class names. */
  private checkBait(): void {
    const bait = this.document.createElement('div');
    bait.className = 'adsbox ad-banner textads banner-ads pub_300x250';
    bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;';
    bait.innerHTML = '&nbsp;';
    this.document.body.appendChild(bait);
    setTimeout(() => {
      if (bait.offsetHeight === 0 || getComputedStyle(bait).display === 'none') this.blocked.set(true);
      bait.remove();
    }, 1500);
  }
}
