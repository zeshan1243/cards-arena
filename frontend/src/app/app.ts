import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, fromEvent, map } from 'rxjs';
import { AdsService } from './core/services/ads.service';
import { AdBanner } from './shared/components/ad-banner/ad-banner';
import { Footer } from './shared/components/footer/footer';
import { Navbar } from './shared/components/navbar/navbar';
import { ToastContainer } from './shared/components/toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, ToastContainer, AdBanner],
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    @if (!inGame()) {
      <app-navbar />
    }
    <main id="main" [class.game-main]="inGame()">
      <router-outlet />
    </main>
    @if (!inGame()) {
      <app-footer />
    }
    @if (showRails()) {
      <aside class="ad-rail left" aria-label="Advertisement"><app-ad-banner size="160x600" /></aside>
      <aside class="ad-rail right" aria-label="Advertisement"><app-ad-banner size="160x300" /></aside>
    }
    <app-toast-container />
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; }
    main { flex: 1; }
    .skip-link {
      position: absolute; left: 12px; top: -60px; z-index: 1000;
      padding: 10px 16px; border-radius: 10px; background: var(--color-primary); color: #fff;
      &:focus { top: 12px; }
    }
    /* Skyscrapers sit in the gutters beside the 1200px container. */
    .ad-rail { position: fixed; top: 96px; z-index: 5; }
    .ad-rail.left { left: 16px; }
    .ad-rail.right { right: 16px; }
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

  // Only mount rails when the gutters fit them, so hidden ads never load.
  private static readonly RAIL_QUERY = '(min-width: 1600px)';
  private readonly wide = toSignal(
    fromEvent<MediaQueryListEvent>(matchMedia(App.RAIL_QUERY), 'change').pipe(map((e) => e.matches)),
    { initialValue: matchMedia(App.RAIL_QUERY).matches },
  );
  readonly showRails = computed(() => this.wide() && !this.inGame());

  constructor() {
    const ads = inject(AdsService);
    // Keep the popunder/social bar off a game someone deep-links into; once loaded they stay.
    effect(() => {
      if (!this.inGame()) ads.loadGlobalScripts();
    });
  }
}
