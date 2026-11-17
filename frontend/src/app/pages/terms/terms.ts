import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { CONTACT_EMAIL } from '../contact/contact';

@Component({
  selector: 'app-terms-page',
  imports: [RouterLink],
  template: `
    <section class="doc-hero">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a routerLink="/">Home</a> / <span>Terms of use</span></nav>
        <h1>Terms of use</h1>
        <p class="lead">The rules for using CardArena. Short version: play fair, have fun, and don’t misuse the site.</p>
      </div>
    </section>
    <article class="container doc">
      <p class="updated">Last updated: {{ updated }}</p>
      <p>
        These terms apply to CardArena at <a href="https://www.cardsarena.world">www.cardsarena.world</a> (“CardArena”, “we”, “us”).
        By using the site you agree to them. If you do not agree, please do not use the site.
      </p>

      <h2>Entertainment only</h2>
      <p>
        CardArena offers free card, dice and board games played against computer opponents. The games are for entertainment only.
        There is no real-money gambling, no betting, no prizes and nothing to buy. Scores and statistics have no cash value.
      </p>

      <h2>Using the site</h2>
      <ul>
        <li>You may use CardArena for personal, non-commercial play.</li>
        <li>Do not attempt to disrupt, overload, scrape at scale or gain unauthorised access to the site or its infrastructure.</li>
        <li>Do not use automated tools to generate fake traffic, or click or interact with ads other than as a genuine visitor.</li>
        <li>Do not copy, resell or republish the site’s code, artwork or written content without our permission.</li>
      </ul>

      <h2>Game rules and content</h2>
      <p>
        Many of the games on CardArena are traditional games with regional variations. Our rules pages describe the variations we implement;
        they may differ from the way you play at home. The rules guides and strategy tips are provided for general information.
      </p>

      <h2>Advertising</h2>
      <p>
        CardArena is free because it shows ads served by Google AdSense. Ads are provided by third parties and we are not responsible for the
        products or services they promote. See our <a routerLink="/privacy">privacy policy</a> for how advertising cookies are used.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work to keep CardArena running smoothly, but the site is provided “as is”, without warranties of any kind. Games may change,
        be added or be removed, and the site may occasionally be unavailable. Settings and statistics stored in your browser may be lost
        if you clear your browser data.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent the law allows, CardArena is not liable for any indirect or consequential loss arising from your use of the site.
      </p>

      <h2>Changes to these terms</h2>
      <p>We may update these terms from time to time. The date at the top shows when they last changed.</p>

      <h2>Contact</h2>
      <p>Questions about these terms? Email <a [href]="'mailto:' + email">{{ email }}</a> or use our <a routerLink="/contact">contact page</a>.</p>
    </article>
  `,
})
export class TermsPage {
  readonly email = CONTACT_EMAIL;
  readonly updated = 'November 17, 2026';

  constructor() {
    inject(SeoService).apply({
      title: 'Terms of Use | CardArena',
      description: 'The terms for using CardArena: free card games for entertainment only, with no real-money gambling.',
      path: '/terms',
    });
  }
}
