import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, fromEvent, map } from 'rxjs';
import { AdsService } from './core/services/ads.service';
import { AdBanner } from './shared/components/ad-banner/ad-banner';
import { AdblockNotice } from './shared/components/adblock-notice/adblock-notice';
import { Footer } from './shared/components/footer/footer';
import { Navbar } from './shared/components/navbar/navbar';
import { ToastContainer } from './shared/components/toast/toast';

/** Live boolean for a CSS media query. */
function mediaQuery(query: string) {
  const mql = matchMedia(query);
  return toSignal(fromEvent<MediaQueryListEvent>(mql, 'change').pipe(map((e) => e.matches)), {
    initialValue: mql.matches,
  });
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, ToastContainer, AdBanner, AdblockNotice],
  host: { '[class.has-sticky-ad]': 'showStickyAd()' },
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    @if (!inGame()) {
      <app-navbar />
    }
    <main id="main" [class.game-main]="inGame()" [class.game-with-ads]="showGameAds()">
      @if (showGameAds()) {
        <aside class="ad-col left" aria-label="Advertisement"><span class="ad-label">Advertisement</span><app-ad-banner [size]="tall() ? '160x600' : '160x300'" /></aside>
      }
      <router-outlet />
      @if (showGameAds()) {
        <aside class="ad-col right" aria-label="Advertisement"><span class="ad-label">Advertisement</span><app-ad-banner size="160x300" /></aside>
      }
    </main>
    @if (showInlineAd()) {
      <aside class="ad-inline" aria-label="Advertisement"><app-ad-banner size="160x300" /></aside>
    }
    @if (!inGame()) {
      <app-footer />
    }
    @if (showRails()) {
      <aside class="ad-rail left" aria-label="Advertisement"><span class="ad-label">Advertisement</span><app-ad-banner size="160x600" /></aside>
      <aside class="ad-rail right" aria-label="Advertisement"><span class="ad-label">Advertisement</span><app-ad-banner size="160x300" /></aside>
    }
    @if (showStickyAd()) {
      <aside class="ad-sticky" aria-label="Advertisement">
        <app-ad-banner size="320x50" />
        <button type="button" class="ad-close" aria-label="Close advertisement" (click)="stickyClosed.set(true)">
          ×
        </button>
      </aside>
    }
    @if (!inGame()) {
      <app-adblock-notice />
    }
    <app-toast-container />
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; }
    /* Room for the sticky bar so it never covers the footer. */
    :host(.has-sticky-ad) { --sticky-ad-h: 62px; padding-bottom: var(--sticky-ad-h); }
    main { flex: 1; }
    .skip-link {
      position: absolute; left: 12px; top: -60px; z-index: 1000;
      padding: 10px 16px; border-radius: 10px; background: var(--color-primary); color: #fff;
      &:focus { top: 12px; }
    }
    /* Skyscrapers hug the 1200px container (24px gap), like a classic three-column page. */
    .ad-rail { position: fixed; top: 96px; z-index: 5; }
    .ad-rail.left { left: max(16px, calc(50% - 600px - 24px - 160px)); }
    .ad-rail.right { right: max(16px, calc(50% - 600px - 24px - 160px)); }
    /* Mid-size screens: one banner centred above the footer instead. */
    .ad-inline { display: flex; justify-content: center; padding: 24px 16px; }
    .ad-sticky {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
      display: flex; justify-content: center;
      padding: 6px 0 calc(6px + env(safe-area-inset-bottom));
      background: var(--bg-secondary); border-top: 1px solid var(--border-color);
    }
    .ad-close {
      position: absolute; top: -26px; right: 8px; width: 26px; height: 26px;
      border: 1px solid var(--border-color); border-bottom: 0; border-radius: var(--radius-sm) var(--radius-sm) 0 0;
      background: var(--bg-secondary); color: var(--text-secondary); font-size: 18px; line-height: 1; cursor: pointer;
      &:hover { color: var(--text-primary); }
    }
  `,
})
export class App {
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  /** Game screens are full-bleed: no site header/footer. */
  readonly inGame = computed(() => this.url().startsWith('/play/'));

  // Ads only mount where they fit, so hidden units never load.
  private readonly wide = mediaQuery('(min-width: 1600px)');
  private readonly phone = mediaQuery('(max-width: 767px)');
  private readonly gameRailsFit = mediaQuery('(min-width: 1280px)');
  readonly tall = mediaQuery('(min-height: 720px)');
  readonly showRails = computed(() => this.wide() && !this.inGame());
  readonly showGameAds = computed(() => this.gameRailsFit() && this.inGame());
  readonly showInlineAd = computed(() => !this.wide() && !this.phone() && !this.inGame());
  /** Dismissed for the rest of the visit; never over a game table (cards sit at the bottom). */
  readonly stickyClosed = signal(false);
  readonly showStickyAd = computed(() => !this.stickyClosed() && !this.inGame());

  constructor() {
    const ads = inject(AdsService);
    // Keep the social bar off a game someone deep-links into; once loaded it stays.
    effect(() => {
      if (!this.inGame()) ads.loadGlobalScripts();
    });
  }
}
