import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

/** Adsterra Smartlink: a plain URL, shown as a labelled "Sponsored" link. */
export const SMARTLINK_URL = 'https://araplhn.org/4/a9ef72d12c902b3b6eafb0ff07a1f0cb';

/** Google AdSense publisher id; verification also uses the meta tag in index.html and public/ads.txt. */
export const ADSENSE_CLIENT = 'ca-pub-3366385543056829';

/** Posted by public/ads/*.html when its Adsterra script fails to load. */
const BLOCKED_MESSAGE = 'cardarena:ad-blocked';

/**
 * Ad blocker detection. Ads themselves are iframe banners (`AdBanner`) and the Smartlink;
 * no popunder (it opened a tab on every card click) and no social bar.
 */
@Injectable({ providedIn: 'root' })
export class AdsService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private started = false;
  /** True once an ad blocker is detected (banner script blocked, or bait element hidden). */
  readonly blocked = signal(false);

  /** Starts detection once; safe to call repeatedly. */
  detectAdBlock(): void {
    if (this.started || !isPlatformBrowser(this.platformId)) return;
    this.started = true;
    window.addEventListener('message', (e) => {
      if (e.origin === location.origin && e.data === BLOCKED_MESSAGE) this.blocked.set(true);
    });
    this.checkBait();
  }

  /**
   * AdSense (Auto ads). Loaded after hydration rather than from index.html: Auto ads insert
   * elements into the page, which must not happen before Angular hydrates the prerendered HTML.
   */
  loadAdSense(): void {
    if (!isPlatformBrowser(this.platformId) || this.document.querySelector('script[src*="adsbygoogle.js"]')) return;
    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.crossOrigin = 'anonymous';
    script.onerror = () => this.blocked.set(true);
    this.document.head.appendChild(script);
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
