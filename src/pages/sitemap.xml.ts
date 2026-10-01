import type { APIRoute } from 'astro';
import { routes, languages, pathFor, defaultLang, type RouteKey } from '../i18n';

/** Sitemap multilingue : chaque URL déclare ses alternatives hreflang. */
export const GET: APIRoute = ({ site }) => {
  const abs = (p: string) => new URL(p, site).href;
  const today = new Date().toISOString().slice(0, 10);
  const priority: Record<RouteKey, string> = { home: '1.0', legal: '0.2', privacy: '0.2' };

  const urls = (Object.keys(routes) as RouteKey[]).flatMap((key) =>
    languages.map((lang) => {
      const alternates = languages
        .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(pathFor(key, l))}"/>`)
        .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(pathFor(key, defaultLang))}"/>`)
        .join('\n');
      return `  <url>
    <loc>${abs(pathFor(key, lang))}</loc>
${alternates}
    <lastmod>${today}</lastmod>
    <priority>${priority[key]}</priority>
  </url>`;
    }),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
