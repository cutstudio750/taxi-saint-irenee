import type { APIRoute } from 'astro';
import { withBase } from '../i18n';

/**
 * Manifeste PWA volontairement minimal : installation sur l'écran d'accueil
 * pour les clients réguliers (réserver ou appeler en un geste).
 */
export const GET: APIRoute = () => {
  const manifest = {
    name: 'Taxi Saint Irénée',
    short_name: 'Saint Irénée',
    description: 'Taxi à Lyon depuis 2014 — réservation en ligne et appel direct.',
    lang: 'fr',
    dir: 'ltr',
    id: withBase('/'),
    start_url: withBase('/'),
    scope: withBase('/'),
    display: 'standalone',
    background_color: '#f5f4f0',
    theme_color: '#0c0c0d',
    icons: [
      { src: withBase('/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: withBase('/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: withBase('/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Réserver un trajet', short_name: 'Réserver', url: withBase('/#reservation') },
      { name: 'Book a ride', short_name: 'Book', url: withBase('/en/#booking') },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
