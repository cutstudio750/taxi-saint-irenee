import { fr, type Dict } from './fr';
import { en } from './en';

export type Lang = 'fr' | 'en';
export const languages: Lang[] = ['fr', 'en'];
export const defaultLang: Lang = 'fr';

const dicts: Record<Lang, Dict> = { fr, en };
export const t = (lang: Lang): Dict => dicts[lang];

/** Routes traduites : une même page, une URL par langue. */
export const routes = {
  home: { fr: '/', en: '/en/' },
  legal: { fr: '/mentions-legales/', en: '/en/legal-notice/' },
  privacy: { fr: '/confidentialite/', en: '/en/privacy/' },
} as const;
export type RouteKey = keyof typeof routes;

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/** Préfixe un chemin interne avec le sous-chemin de déploiement (GitHub Pages). */
export const withBase = (path: string) => base + path.replace(/^\//, '');

export const pathFor = (key: RouteKey, lang: Lang) => withBase(routes[key][lang]);

/** Lien vers une section de l'accueil dans la langue donnée. */
export const sectionHref = (lang: Lang, id: string, onHome: boolean) =>
  onHome ? `#${id}` : `${pathFor('home', lang)}#${id}`;

/** Remplace les {jetons} d'une chaîne. */
export const fmt = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
