import { site } from '../config/site';
import { areaServed } from '../data/zones';
import { reviews } from '../data/reviews';
import type { Dict } from '../i18n/fr';

/**
 * Données structurées Schema.org (JSON-LD).
 * - LocalBusiness : l'entreprise (fondée en 2014, Lyon, téléphone, email).
 * - TaxiService   : le service proposé, rattaché à l'entreprise.
 * - WebSite / WebPage : la page dans sa langue.
 * - FAQPage : questions fréquentes réellement affichées sur la page.
 * Aucune note agrégée n'est publiée tant qu'aucun avis réel n'est saisi.
 */
export function buildSchema(opts: { d: Dict; siteUrl: string; pageUrl: string; homeUrl: string; logoUrl: string; imageUrl: string }) {
  const { d, siteUrl, pageUrl, homeUrl, logoUrl, imageUrl } = opts;
  const businessId = `${siteUrl}#business`;

  const business: Record<string, unknown> = {
    '@type': 'LocalBusiness',
    '@id': businessId,
    name: site.name,
    description: d.meta.description,
    url: homeUrl,
    telephone: site.phone.e164,
    email: site.email,
    foundingDate: String(site.foundingYear),
    logo: logoUrl,
    image: imageUrl,
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.city,
      addressRegion: site.region,
      addressCountry: site.country,
    },
    areaServed: areaServed.map((name) => ({ '@type': 'City', name })),
    knowsLanguage: ['fr', 'en'],
  };
  if (site.googleBusinessUrl) business.sameAs = [site.googleBusinessUrl];

  // Note agrégée uniquement si de vrais avis sont présents.
  if (reviews.length > 0) {
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    business.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: avg.toFixed(1),
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const service = {
    '@type': 'TaxiService',
    '@id': `${siteUrl}#taxi-service`,
    name: d.meta.title,
    provider: { '@id': businessId },
    areaServed: areaServed.map((name) => ({ '@type': 'City', name })),
    serviceType: d.services.items.map((s) => s.title),
    availableChannel: {
      '@type': 'ServiceChannel',
      servicePhone: { '@type': 'ContactPoint', telephone: site.phone.e164, contactType: 'reservations' },
      serviceUrl: homeUrl,
    },
  };

  const faq = {
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    inLanguage: d.lang,
    mainEntity: d.faq.items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${siteUrl}#website`,
    url: siteUrl,
    name: site.name,
    inLanguage: ['fr', 'en'],
    publisher: { '@id': businessId },
  };

  const webpage = {
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: d.meta.title,
    description: d.meta.description,
    inLanguage: d.lang,
    isPartOf: { '@id': `${siteUrl}#website` },
    about: { '@id': businessId },
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [business, service, website, webpage, faq],
  };
}
