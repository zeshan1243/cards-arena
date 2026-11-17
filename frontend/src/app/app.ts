import { Component, afterNextRender, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AdsService } from './core/services/ads.service';
import { AdblockNotice } from './shared/components/adblock-notice/adblock-notice';
import { Footer } from './shared/components/footer/footer';
import { Navbar } from './shared/components/navbar/navbar';
import { ToastContainer } from './shared/components/toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, ToastContainer, AdblockNotice],
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
      <app-adblock-notice />
    }
    <app-toast-container />
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; }
    main { flex: 1; }
    main:not(.game-main) { min-height: 100dvh; }
    .skip-link {
      position: absolute; left: 12px; top: -60px; z-index: 1000;
      padding: 10px 16px; border-radius: 10px; background: var(--color-primary); color: #fff;
      &:focus { top: 12px; }
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

  constructor() {
    const ads = inject(AdsService);
    afterNextRender(() => {
      ads.detectAdBlock();
      ads.loadAdSense();
    });
  }
}
