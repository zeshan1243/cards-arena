import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { CONTACT_EMAIL } from '../contact/contact';

/** Keep in step with what the site actually loads: Google Analytics, AdSense, Adsterra, Vercel, localStorage. */
@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink],
  template: `
    <section class="doc-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a routerLink="/">Home</a> / <span>Privacy policy</span></nav>
        <h1>Privacy policy</h1>
        <p class="lead">What information CardArena collects, how it is used, and the choices you have.</p>
      </div>
    </section>
    <article class="container doc">
      <p class="updated">Last updated: {{ updated }}</p>
      <p>
        This policy applies to CardArena at <a href="https://www.cardsarena.world">www.cardsarena.world</a> (“CardArena”, “we”, “us”).
        By using the site you agree to this policy. If you have any questions, email us at <a [href]="'mailto:' + email">{{ email }}</a>.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>No account needed.</strong> You can play every game without signing up. We do not ask for your name, email address or any other personal details to play.</li>
        <li><strong>Data stored on your device.</strong> Your settings (sound, game speed, difficulty), game preferences, Solitaire statistics and whether you have dismissed certain notices are saved in your browser’s local storage. This stays on your device; we do not receive it. You can clear it at any time in your browser settings.</li>
        <li><strong>Usage data.</strong> Like most websites, we collect anonymous information about how the site is used — pages visited, approximate location (country/city), device and browser type, and how long visits last — through Google Analytics.</li>
        <li><strong>Server logs.</strong> Our hosting provider, Vercel, automatically records technical information such as your IP address, browser and the pages requested, to deliver the site and keep it secure.</li>
        <li><strong>Messages you send us.</strong> If you email us, we receive your email address and whatever you write, and use it only to reply.</li>
      </ul>

      <h2>Cookies and similar technologies</h2>
      <p>
        Cookies are small files stored by your browser. CardArena itself does not need cookies to work, but the third-party
        services below set cookies or use similar technologies (such as local storage and device identifiers):
      </p>
      <ul>
        <li><strong>Google Analytics</strong> — to measure traffic and understand which games people play. Google’s use of this data is described in
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">How Google uses information from sites that use its services</a>.
          You can opt out with the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">Google Analytics opt-out browser add-on</a>.</li>
        <li><strong>Advertising</strong> — see the next section.</li>
      </ul>

      <h2>Advertising</h2>
      <p>CardArena is free because it shows ads. We work with these advertising partners:</p>
      <ul>
        <li>
          <strong>Google AdSense.</strong> Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites.
          Google’s use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the Internet.
          You may opt out of personalised advertising by visiting <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Ads Settings</a>.
          You can also opt out of some third-party vendors’ use of cookies for personalised advertising at
          <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener">www.aboutads.info</a> or, in Europe,
          <a href="https://www.youronlinechoices.eu/" target="_blank" rel="noopener">www.youronlinechoices.eu</a>.
        </li>
        <li>
          <strong>Adsterra.</strong> Banner ads and sponsored links may be provided by Adsterra, which may use cookies and similar technologies to show
          ads and measure their performance. See <a href="https://adsterra.com/privacy-policy/" target="_blank" rel="noopener">Adsterra’s privacy policy</a>.
        </li>
      </ul>
      <p>
        Where the law requires it (for example for visitors in the European Economic Area, the UK and Switzerland), you will be asked for consent
        before personalised ads are shown, and you can change your choice at any time. If you decline, you may still see non-personalised ads.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>to run the site and the games, and to remember your settings;</li>
        <li>to understand how the site is used and improve it;</li>
        <li>to show ads that keep CardArena free;</li>
        <li>to keep the site secure and prevent abuse;</li>
        <li>to answer your messages.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Block or delete cookies and local storage in your browser settings (the games will still work, but your settings will reset).</li>
        <li>Opt out of personalised ads using the links above.</li>
        <li>
          Depending on where you live (for example under the GDPR in Europe or the CCPA in California), you may have the right to access, correct or
          delete personal data about you, or to object to how it is used. Email <a [href]="'mailto:' + email">{{ email }}</a> and we will respond
          within the time the law requires.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        CardArena is a general-audience site and is not directed at children under 13. We do not knowingly collect personal information from children.
        If you believe a child has sent us personal information, please contact us and we will delete it.
      </p>

      <h2>Data retention and security</h2>
      <p>
        Analytics and advertising data are kept by those providers under their own retention policies. Emails are kept only as long as needed to
        deal with your message. We use HTTPS across the whole site to protect information in transit.
      </p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy from time to time. The date at the top shows when it last changed.</p>

      <h2>Contact</h2>
      <p>Questions about this policy? Email <a [href]="'mailto:' + email">{{ email }}</a> or use our <a routerLink="/contact">contact page</a>.</p>
    </article>
  `,
})
export class PrivacyPage {
  readonly email = CONTACT_EMAIL;
  readonly updated = 'October 28, 2026';

  constructor() {
    inject(SeoService).apply({
      title: 'Privacy Policy | CardArena',
      description: 'How CardArena handles your data: local game settings, Google Analytics, advertising cookies from Google AdSense and Adsterra, and your choices.',
      path: '/privacy',
    });
  }
}
