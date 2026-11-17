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

/**
 * EEA, UK and Switzerland: Google requires consent before ad and analytics storage there.
 * Consent Mode defaults to "denied" in these regions; the Google-certified consent message
 * (AdSense → Privacy & messaging) updates it when the visitor makes a choice.
 */
const CONSENT_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
];

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
    // Must run before 'config' so no data is stored before the visitor chooses.
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      region: CONSENT_REGIONS,
      wait_for_update: 500,
    });
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
