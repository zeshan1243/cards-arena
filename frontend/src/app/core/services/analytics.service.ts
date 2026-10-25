import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environments/environment';

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: Gtag;
  }
}

/** Google Analytics 4. Sends a page_view per route change, since the SPA never reloads. */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  init(): void {
    const id = environment.gaMeasurementId;
    if (!id || !isPlatformBrowser(this.platformId)) return;

    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    this.document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    // gtag.js only reads the `arguments` object, not a plain array.
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    // Page views are sent manually below, after each page has set its title.
    window.gtag('config', id, { send_page_view: false });

    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      window.gtag('event', 'page_view', {
        page_location: this.document.location.href,
        page_title: this.document.title,
      });
    });
  }
}
