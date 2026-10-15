import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface SeoConfig {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'article' | 'game';
  structuredData?: object[];
  noindex?: boolean;
}

/** Dynamic title, description, canonical, Open Graph and JSON-LD (spec §94–95). */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  apply(cfg: SeoConfig): void {
    const url = `${environment.siteUrl}${cfg.path}`;
    this.title.setTitle(cfg.title);
    this.setName('description', cfg.description);
    this.setName('robots', cfg.noindex ? 'noindex, nofollow' : 'index, follow');
    this.setProperty('og:title', cfg.title);
    this.setProperty('og:description', cfg.description);
    this.setProperty('og:type', cfg.type === 'article' ? 'article' : 'website');
    this.setProperty('og:url', url);
    this.setProperty('og:site_name', environment.siteName);
    if (cfg.image) this.setProperty('og:image', cfg.image);
    this.setName('twitter:card', 'summary_large_image');
    this.setName('twitter:title', cfg.title);
    this.setName('twitter:description', cfg.description);
    this.setCanonical(url);
    this.setStructuredData(cfg.structuredData ?? []);
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  private setCanonical(url: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'canonical';
      this.doc.head.appendChild(link);
    }
    link.href = url;
  }

  private setStructuredData(items: object[]): void {
    this.doc.head.querySelectorAll('script[data-seo="page"]').forEach((el) => el.remove());
    for (const item of items) {
      const script = this.doc.createElement('script');
      script.type = 'application/ld+json';
      script.dataset['seo'] = 'page';
      script.textContent = JSON.stringify(item);
      this.doc.head.appendChild(script);
    }
  }
}
