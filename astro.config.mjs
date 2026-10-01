// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

// SITE_URL : origine publique du site (ex. https://www.mon-domaine.fr ou https://user.github.io)
// BASE_PATH : sous-chemin éventuel (ex. /taxi-saint-irenee pour un dépôt GitHub Pages sans domaine)
// En CI, ces deux valeurs sont fournies automatiquement par actions/configure-pages.
const site = env.SITE_URL || process.env.SITE_URL || 'http://localhost:4321';
const base = env.BASE_PATH || process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base: base === '' ? '/' : base,
  trailingSlash: 'ignore',
  compressHTML: true,
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  devToolbar: { enabled: false },
});
