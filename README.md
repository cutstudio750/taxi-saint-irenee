# Taxi Saint Irénée — site officiel

Site bilingue (français / anglais) de **Taxi Saint Irénée**, entreprise de taxi à Lyon depuis 2014.
Site statique ultra-léger, réservation en ligne en 5 étapes, envoi des demandes par email via une fonction serverless sécurisée.

- Téléphone : 06 61 88 27 07 (`tel:+33661882707`)
- Réservations : taxisaintirenee@gmail.com

---

## Sommaire

1. [Stack et choix techniques](#1-stack-et-choix-techniques)
2. [Fonctionnalités](#2-fonctionnalités)
3. [Structure du projet](#3-structure-du-projet)
4. [Installation, développement, build](#4-installation-développement-build)
5. [Variables d'environnement](#5-variables-denvironnement)
6. [Configuration email](#6-configuration-email-cloudflare-worker--resend)
7. [Mise en ligne sur GitHub](#7-mise-en-ligne-sur-github)
8. [Déploiement GitHub Pages](#8-déploiement-github-pages)
9. [Domaine personnalisé](#9-domaine-personnalisé)
10. [Ajouter les photos du véhicule](#10-ajouter-les-photos-du-véhicule)
11. [Ajouter des avis clients](#11-ajouter-des-avis-clients)
12. [Personnaliser le contenu](#12-personnaliser-le-contenu)
13. [Identité visuelle](#13-identité-visuelle)
14. [Checklist avant mise en ligne](#14-checklist-avant-mise-en-ligne)
15. [Contrôle qualité réalisé](#15-contrôle-qualité-réalisé)

---

## 1. Stack et choix techniques

| Besoin | Choix | Pourquoi |
| --- | --- | --- |
| Générateur de site | **Astro 5** (sortie 100 % statique) | HTML pré-rendu = SEO et vitesse maximum, zéro framework JavaScript envoyé au navigateur, composants maintenables. |
| Interactions | **TypeScript natif**, sans bibliothèque | Toute l'interactivité (réservation, menu, animations) tient en ~10 Ko gzip. |
| Styles | **CSS natif** (variables, `backdrop-filter`, `color-mix`) | Aucune dépendance, design system centralisé dans `src/styles/global.css`. |
| Polices | **Geist** + **Instrument Serif**, auto-hébergées (`@fontsource`) | Pas d'appel à Google Fonts (RGPD), `font-display: swap`, préchargement de la police principale. |
| Images | `astro:assets` + **sharp** | Conversion automatique AVIF / WebP, tailles adaptées, lazy loading. |
| Hébergement | **GitHub Pages** via GitHub Actions | Gratuit, HTTPS, déploiement automatique à chaque push. |
| Envoi des emails | **Cloudflare Worker + Resend** | La clé API reste côté serveur (secret Cloudflare), jamais dans le site ni dans GitHub. Gratuit à ce volume. |
| Adresses et estimation | **Géoplateforme IGN** (service public, sans clé) | Autocomplétion des adresses françaises et calcul d'itinéraire, gratuits, sans compte ni clé à protéger. |

**Pourquoi pas EmailJS ou Formspree ?** EmailJS impose une clé publique côté navigateur et limite la mise en forme ; Formspree ne permet pas de produire exactement le format d'email demandé ni de générer un numéro de réservation côté serveur. Le Worker offre un contrôle total, une validation serveur et reste gratuit.

**Dépendances**

| Paquet | Rôle | Type |
| --- | --- | --- |
| `astro` | Générateur de site | production |
| `@fontsource-variable/geist` | Police principale (variable) | production |
| `@fontsource/instrument-serif` | Police d'accent éditorial (italique) | production |
| `sharp` | Optimisation des images | production |
| `@fontsource/geist`, `opentype.js` | Génération des logos vectorisés (`npm run brand`) | développement |
| `wrangler` (dans `worker/`) | Déploiement du Worker Cloudflare | développement |

---

## 2. Fonctionnalités

Chaque fonctionnalité a été retenue parce qu'elle répond à au moins une de ces questions : *aide-t-elle à réserver ? augmente-t-elle la confiance ? facilite-t-elle le trajet ?*

### Analyse préalable (tendances 2026)

Les meilleures expériences de réservation de transport partagent quelques constantes : réservation en moins d'une minute sur mobile, saisie d'adresse assistée, étapes courtes avec progression visible, validation en ligne claire, aucun compte obligatoire, appel en un geste, et une transparence totale sur ce qui est confirmé ou non. Les sites de taxi locaux sont majoritairement consultés sur mobile : barres d'action collantes, cibles tactiles larges et liens `tel:` fonctionnels sont décisifs.
Sources consultées : [Ralabs — Booking UX best practices](https://ralabs.org/blog/booking-ux-best-practices/), [DMNews — taxi website guide 2026](https://dmnews.co.uk/how-to-build-a-taxi-website-that-gets-bookings/), [Peak Digital — taxi website design 2026](https://peakdigital.online/web-design/taxi-website-design/), documentation [Géoplateforme — géocodage](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/autocompletion/) et [calcul d'itinéraire](https://geoservices.ign.fr/documentation/services/services-geoplateforme/itineraire).

### Fonctionnalités principales

| Fonctionnalité | Objectif |
| --- | --- |
| Panneau de réservation dès la première vue | Le visiteur peut commencer sa demande sans chercher. |
| Bouton d'appel partout (hero, menu, contact, barre mobile) | Réserver par téléphone en un geste, notamment pour un départ imminent. |
| Section « Trois étapes, aucune surprise » | Expliquer d'emblée que le chauffeur confirme chaque demande. |
| Section « Depuis 2014 » | Faire de l'expérience de l'entreprise le premier élément de confiance. |
| FAQ | Lever les doutes fréquents (confirmation, capacité, aéroport) sans contact. |
| Page hors ligne (PWA légère) | Le numéro reste affiché même sans réseau. |

### Réservation

| Fonctionnalité | Objectif |
| --- | --- |
| Parcours en 5 étapes (Trajet, Date et heure, Passagers, Coordonnées, Récapitulatif) avec barre de progression et « Étape 2 sur 5 » | Le client sait toujours où il en est ; chaque écran reste court. |
| Autocomplétion des adresses (IGN), priorité aux résultats du Rhône | Moins de saisie, adresses exactes. Saisie libre toujours possible si le service ne répond pas. |
| Lieux fréquents (aéroport, Part-Dieu, Perrache, Saint-Exupéry TGV) | Les trajets les plus courants en un clic. |
| « Ma position actuelle » (sur demande uniquement) | Remplir le départ sans taper, sur mobile. |
| Inversion départ / destination | Préparer un trajet retour en un geste. |
| Estimation de distance et de durée | Information utile, clairement indicative. **Aucun prix n'est affiché.** |
| Raccourcis « Aujourd'hui / Demain » | Les dates les plus fréquentes sans ouvrir le calendrier. |
| Alerte « départ dans moins de deux heures » | Orienter vers l'appel, plus sûr pour une course imminente. |
| Validation en temps réel, messages précis, focus sur le premier champ en erreur | Corriger sans frustration. |
| Mise en forme automatique du téléphone (06 12 34 56 78) | Données propres pour le chauffeur. |
| « Mémoriser mes coordonnées » (opt-in, stockage local uniquement) | Fidélisation : un client régulier ne retape pas ses informations. |
| Récapitulatif avec « Modifier » par section | Vérifier avant d'envoyer, sans repartir de zéro. |
| Numéro de réservation (TSI-AAMMJJ-XXXX) | Référence commune client / chauffeur. |
| Confirmation élégante, statut « En attente de confirmation » | Ne jamais présenter une demande comme une réservation confirmée. |
| Ajout au calendrier (.ics avec rappel 1 h avant) | Rappel avant le trajet, sans serveur ni notification intrusive. |
| Partage des détails (partage natif ou copie) | Transmettre l'horaire à un proche ou un collègue. |
| Accusé de réception par email (facultatif) | Le client garde une trace écrite de sa demande. |
| Repli en cas d'échec : appel ou email pré-rempli | Aucune demande perdue, même en cas de panne réseau. |
| Anti-spam invisible (champ piège, délai minimal, liste d'origines, limitation de débit) | Protéger la boîte de réception sans CAPTCHA. |

### Multilingue

| Fonctionnalité | Objectif |
| --- | --- |
| Deux versions complètes : `/` (français) et `/en/` (anglais) | Traduction intégrale : interface, formulaire, erreurs, confirmation, avis, mentions, SEO, textes d'accessibilité. |
| Sélecteur FR / EN (navbar, menu mobile, pied de page) | Choix manuel toujours disponible, retour au français toujours possible. |
| Mémorisation du choix | La langue choisie est conservée pendant la navigation et les visites suivantes. |
| Suggestion de langue (pas de redirection forcée) | Détection du navigateur sans gêner l'indexation ni imposer une langue. |
| `lang`, `hreflang`, `x-default`, sitemap multilingue | Référencement correct des deux versions. |

### Mobile

| Fonctionnalité | Objectif |
| --- | --- |
| Conception mobile d'abord, aucun défilement horizontal (375 px à 3840 px) | Une expérience impeccable sur téléphone. |
| Barre flottante « Appeler / Réserver » en verre | Actions essentielles au pouce ; masquée quand le formulaire ou le contact est visible pour ne rien recouvrir. |
| Claviers adaptés (`tel`, `email`), `autocomplete`, `enterkeyhint` | Saisie rapide, remplissage automatique du navigateur. |
| Champs de 16 px minimum, cibles tactiles de 44 px | Pas de zoom intempestif sur iOS, boutons faciles à toucher. |
| Manifeste PWA et icônes | Installation sur l'écran d'accueil pour les clients réguliers. |

### Confiance

| Fonctionnalité | Objectif |
| --- | --- |
| « Depuis 2014 » visible dès le hero et dans une section dédiée | L'ancienneté comme preuve de sérieux. |
| Section « Pourquoi Taxi Saint Irénée ? » | Uniquement des éléments vérifiables. |
| Avis : structure complète, **aucun faux avis** | État d'attente élégant tant qu'aucun avis réel n'est saisi. |
| Véhicule présenté sans modèle inventé ni photo d'emprunt | Emplacements photo clairement identifiés. |
| Mentions légales et politique de confidentialité (FR / EN) | Transparence et conformité RGPD. |

### SEO

| Fonctionnalité | Objectif |
| --- | --- |
| HTML pré-rendu, titres et descriptions par page et par langue | Indexation complète. |
| `canonical`, `hreflang`, Open Graph (image dédiée FR et EN), Twitter Card | Partages et versions linguistiques propres. |
| Données structurées : `LocalBusiness` (fondée en 2014), `TaxiService`, `WebSite`, `WebPage`, `FAQPage` | Compréhension de l'entreprise par les moteurs. La note agrégée n'est publiée qu'avec de vrais avis. |
| `robots.txt`, `sitemap.xml` multilingue | Exploration efficace. |
| Expressions ciblées intégrées naturellement (taxi Lyon, taxi aéroport Lyon, taxi 7 places Lyon, Lyon airport taxi…) | Pas de bourrage de mots-clés. |

### Accessibilité

| Fonctionnalité | Objectif |
| --- | --- |
| HTML sémantique, un seul `h1` par page, lien d'évitement | Navigation au lecteur d'écran. |
| Formulaire : libellés visibles, `aria-invalid`, `aria-describedby`, annonces des étapes (`aria-live`) | Formulaire utilisable sans la vue. |
| Autocomplétion conforme au motif ARIA « combobox » (flèches, Entrée, Échap) | Utilisable entièrement au clavier. |
| Focus visible partout, focus déplacé au changement d'étape | Navigation clavier claire. |
| Contrastes conformes WCAG AA, thème sombre automatique | Lisibilité de jour comme de nuit. |
| `prefers-reduced-motion` respecté | Toutes les animations désactivées sur demande du système. |

### Fonctionnalités volontairement écartées

Compte client, paiement en ligne, prix estimé, suivi du véhicule en temps réel, chat, notifications push, bandeau cookies : sans infrastructure ni tarification fiable, elles compliqueraient l'interface sans aider à réserver. Elles pourront être ajoutées plus tard si un besoin réel apparaît.

---

## 3. Structure du projet

```
taxi-saint-irenee/
├── .github/workflows/deploy.yml   Déploiement automatique GitHub Pages
├── public/                        Fichiers servis tels quels
│   ├── brand/                     Logos SVG (desktop, mobile, clair, monogramme)
│   ├── favicon.svg, favicon-32.png, apple-touch-icon.png, icon-*.png
│   ├── og-fr.png, og-en.png       Images de partage (1200 × 630)
│   └── sw.js                      Service worker (page hors ligne)
├── scripts/generate-brand.mjs     Génère logos, icônes et images Open Graph
├── src/
│   ├── assets/vehicle/            Photos du véhicule (à ajouter)
│   ├── components/                Sections du site (Hero, Booking, About, Services…)
│   ├── config/site.ts             Coordonnées, mentions légales, lieux fréquents
│   ├── data/reviews.ts            Avis clients (vide par défaut)
│   ├── data/zones.ts              Communes desservies (liste indicative)
│   ├── i18n/fr.ts, en.ts          Tous les textes, en français et en anglais
│   ├── layouts/Base.astro         Gabarit commun : SEO, en-tête, pied de page
│   ├── lib/booking-email.ts       Format de l'email + validation (partagé avec le Worker)
│   ├── lib/schema.ts              Données structurées Schema.org
│   ├── pages/                     Pages FR, pages EN, robots, sitemap, manifeste
│   ├── scripts/booking.ts         Logique de réservation
│   ├── scripts/ui.ts              Navbar, menu, animations, langue, PWA
│   └── styles/                    Design system (global.css) et réservation (booking.css)
├── worker/                        Fonction d'envoi des emails (Cloudflare Worker)
│   ├── src/index.ts
│   ├── wrangler.toml
│   └── .dev.vars.example
├── .env.example
├── astro.config.mjs
└── package.json
```

---

## 4. Installation, développement, build

Prérequis : **Node.js 20.3 ou plus récent** (22 recommandé).

```bash
npm install
```

```bash
npm run dev
```

Le site est disponible sur http://localhost:4321 (version anglaise : http://localhost:4321/en/).

```bash
npm run build
```

Le site statique est généré dans `dist/`.

```bash
npm run preview
```

Sert le contenu de `dist/` localement, pour vérifier le résultat final.

> Sans `PUBLIC_BOOKING_ENDPOINT`, le formulaire fonctionne en **mode email de secours** : à l'envoi, la messagerie du client s'ouvre avec la demande pré-remplie à destination de taxisaintirenee@gmail.com. Le site est donc utilisable immédiatement, avant même la configuration du Worker.

---

## 5. Variables d'environnement

### Site (`.env`, copie de `.env.example`) — aucune valeur secrète

| Variable | Exemple | Rôle |
| --- | --- | --- |
| `SITE_URL` | `https://www.taxi-saint-irenee.fr` | URL publique (canonical, sitemap, Open Graph). Automatique en CI. |
| `BASE_PATH` | `/` ou `/taxi-saint-irenee` | Sous-chemin GitHub Pages. Automatique en CI. |
| `PUBLIC_BOOKING_ENDPOINT` | `https://taxi-saint-irenee-booking.compte.workers.dev` | URL du Worker d'envoi. Vide = mode email de secours. |

### Worker (`worker/wrangler.toml` et secrets Cloudflare)

| Variable | Type | Rôle |
| --- | --- | --- |
| `RESEND_API_KEY` | **secret** | Clé API Resend. Définie avec `npx wrangler secret put RESEND_API_KEY`. Jamais dans Git. |
| `ALLOWED_ORIGINS` | variable | Origines autorisées, séparées par des virgules (ex. `https://www.taxi-saint-irenee.fr,https://compte.github.io`). |
| `BOOKING_TO_EMAIL` | variable | Destinataire des demandes (`taxisaintirenee@gmail.com`). |
| `BOOKING_FROM_EMAIL` | variable | Expéditeur (`Taxi Saint Irénée <reservations@votre-domaine.fr>`). |
| `SEND_ACKNOWLEDGEMENT` | variable | `true` pour envoyer un accusé de réception au client (domaine vérifié requis). |

---

## 6. Configuration email (Cloudflare Worker + Resend)

### Format de l'email reçu

- **Objet** : `[NOUVELLE RÉSERVATION] Taxi Saint Irénée — 02/10/2026` (date du trajet)
- **Contenu** : numéro de réservation ; CLIENT (nom, prénom, téléphone, email, langue) ; TRAJET (départ, destination, estimation indicative) ; VOYAGE (date, heure, passagers, bagages) ; MESSAGE (informations complémentaires) ; date et heure de la demande.
- **Répondre à** : l'adresse du client. Il suffit de cliquer sur « Répondre » dans Gmail pour lui écrire.
- Versions texte et HTML sobres.

### Étape 1 — Resend

1. Créer un compte sur [resend.com](https://resend.com). Astuce : en créant le compte **avec taxisaintirenee@gmail.com**, l'expéditeur de test `onboarding@resend.dev` peut envoyer vers cette adresse sans domaine vérifié.
2. *API Keys* > *Create API Key* (permission « Sending access »). Copier la clé `re_…`.
3. En production (recommandé) : *Domains* > *Add Domain*, ajouter les enregistrements DNS indiqués (SPF, DKIM) chez le registrar, puis utiliser une adresse de ce domaine dans `BOOKING_FROM_EMAIL`. Indispensable pour l'accusé de réception client.

### Étape 2 — Cloudflare Worker

1. Créer un compte gratuit sur [cloudflare.com](https://dash.cloudflare.com) (offre gratuite : 100 000 requêtes par jour).
2. Dans le dossier `worker/` :

```bash
cd worker
```

```bash
npm install
```

```bash
npx wrangler login
```

3. Ouvrir `worker/wrangler.toml` et renseigner `ALLOWED_ORIGINS` (URL exacte du site, sans slash final) et `BOOKING_FROM_EMAIL`.
4. Enregistrer la clé Resend comme **secret** (elle est demandée de façon interactive, elle n'est jamais écrite dans un fichier) :

```bash
npx wrangler secret put RESEND_API_KEY
```

5. Déployer :

```bash
npx wrangler deploy
```

Wrangler affiche l'URL du Worker, par exemple `https://taxi-saint-irenee-booking.votre-compte.workers.dev`.

6. Facultatif mais recommandé : décommenter le bloc `[[ratelimits]]` de `wrangler.toml` (5 demandes par minute et par IP), puis redéployer.

### Étape 3 — Relier le site au Worker

Sur GitHub : *Settings* > *Secrets and variables* > *Actions* > onglet **Variables** > *New repository variable* :

- Nom : `PUBLIC_BOOKING_ENDPOINT`
- Valeur : l'URL du Worker

Relancer le déploiement (*Actions* > *Déploiement GitHub Pages* > *Run workflow*). Ce n'est pas un secret : l'URL du Worker est publique par nature, la protection se fait côté Worker (origines autorisées, validation, anti-spam).

### Tester en local

```bash
cp worker/.dev.vars.example worker/.dev.vars
```

Renseigner la clé dans `worker/.dev.vars`, puis lancer le Worker (port 8787) :

```bash
npm --prefix worker run dev
```

Dans `.env` à la racine : `PUBLIC_BOOKING_ENDPOINT=http://localhost:8787`, puis `npm run dev`.

### Suivi

```bash
npm --prefix worker run logs
```

Affiche en direct les journaux du Worker (erreurs Resend éventuelles).

---

## 7. Mise en ligne sur GitHub

1. Créer un dépôt sur GitHub (privé ou public), par exemple `taxi-saint-irenee`.
2. Dans le dossier du projet :

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Site Taxi Saint Irénée"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/VOTRE-COMPTE/taxi-saint-irenee.git
```

```bash
git push -u origin main
```

Le `.gitignore` exclut `node_modules`, `dist`, `.env` et `worker/.dev.vars` : aucun secret ne peut être poussé par erreur.

---

## 8. Déploiement GitHub Pages

1. Sur GitHub : *Settings* > *Pages* > *Build and deployment* > *Source* : **GitHub Actions**.
2. Chaque `push` sur `main` lance `.github/workflows/deploy.yml` : installation, build, publication.
3. L'URL et le sous-chemin sont détectés automatiquement (`actions/configure-pages`) : le site fonctionne aussi bien sur `https://compte.github.io/taxi-saint-irenee/` que sur un domaine personnalisé, sans modification.
4. Ajouter l'URL GitHub Pages à `ALLOWED_ORIGINS` du Worker (ex. `https://compte.github.io`), puis `npx wrangler deploy`.

> Remarque : `robots.txt` n'est lu par les moteurs qu'à la racine d'un domaine. Il devient donc pleinement effectif avec un domaine personnalisé.

---

## 9. Domaine personnalisé

1. Sur GitHub : *Settings* > *Pages* > *Custom domain* : saisir `www.votre-domaine.fr`, enregistrer.
2. Chez le registrar (OVH, Gandi, etc.) :
   - `www` : enregistrement **CNAME** vers `VOTRE-COMPTE.github.io`
   - domaine nu (`votre-domaine.fr`) : enregistrements **A** vers `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (et **AAAA** `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`)
3. Une fois le DNS propagé, cocher **Enforce HTTPS**.
4. Relancer le workflow : canonical, sitemap et Open Graph utilisent automatiquement le nouveau domaine.
5. Mettre à jour `ALLOWED_ORIGINS` du Worker avec `https://www.votre-domaine.fr` (et le domaine nu si utilisé), puis `npx wrangler deploy`.
6. Vérifier le domaine chez Resend pour envoyer depuis `reservations@votre-domaine.fr`.
7. Recommandé : déclarer le site dans [Google Search Console](https://search.google.com/search-console) et soumettre `https://www.votre-domaine.fr/sitemap.xml`.

Avec un déploiement par GitHub Actions, aucun fichier `CNAME` n'est nécessaire dans le dépôt.

---

## 10. Ajouter les photos du véhicule

Déposer les **vraies** photos dans `src/assets/vehicle/`, avec ces noms exacts :

| Fichier | Emplacement | Conseil |
| --- | --- | --- |
| `exterieur.jpg` | Grande photo principale | Paysage, 2400 px de large minimum |
| `interieur.jpg` | Photo secondaire | 1200 px minimum |
| `coffre.jpg` | Photo secondaire (espace bagages) | 1200 px minimum |

Formats acceptés : jpg, jpeg, png, webp. Au build, les photos sont converties en AVIF et WebP, redimensionnées et chargées en différé. Les textes alternatifs (FR / EN) sont déjà rédigés dans `src/i18n/fr.ts` et `en.ts` (`vehicle.photos.alt`). Tant qu'une photo manque, un emplacement « Photo à venir » s'affiche.

Le modèle exact du véhicule n'est volontairement pas cité : le préciser dans `vehicle.title` des deux fichiers de langue si souhaité.

---

## 11. Ajouter des avis clients

Dans `src/data/reviews.ts`, ajouter uniquement des avis **réels** :

```ts
export const reviews: Review[] = [
  {
    author: 'Prénom N.',
    rating: 5,
    date: '2026-09-14',
    text: 'Texte exact de l’avis.',
    lang: 'fr',
    source: 'Google',
  },
];
```

La note moyenne, le nombre d'avis, les étoiles et la note agrégée Schema.org sont calculés automatiquement. Tant que la liste est vide, le message « Les avis de nos clients seront bientôt disponibles. » est affiché.

**Bouton « Laisser un avis »** : renseigner `googleReviewUrl` dans `src/config/site.ts` avec le lien d'avis de la fiche Google Business Profile (format `https://g.page/r/XXXX/review`, disponible dans la fiche Google, bouton « Demander des avis »). Sans lien, le bouton ouvre un email.

---

## 12. Personnaliser le contenu

| Élément | Fichier |
| --- | --- |
| Téléphone, email, lien d'avis Google | `src/config/site.ts` |
| **Mentions légales** (raison sociale, SIRET, adresse, directeur de publication, médiateur) | `src/config/site.ts` > `legal` — les champs vides s'affichent « À compléter » |
| Lieux fréquents de la réservation | `src/config/site.ts` > `quickPlaces` |
| Tous les textes du site (FR) | `src/i18n/fr.ts` |
| Tous les textes du site (EN) | `src/i18n/en.ts` |
| Communes desservies | `src/data/zones.ts` |
| Avis | `src/data/reviews.ts` |
| Politique de confidentialité (durées de conservation, etc.) | `src/components/PrivacyPolicy.astro` |
| Couleurs, espacements, typographie | `src/styles/global.css` (variables en tête de fichier) |

Les deux fichiers de langue ont exactement la même structure : TypeScript signale toute clé manquante dans la version anglaise.

---

## 13. Identité visuelle

- **Monogramme** : deux trajectoires qui se rejoignent et repartent ensemble, évocation de la confluence du Rhône et de la Saône, et d'un trajet qui arrive à destination. Pas d'icône de taxi cliché.
- **Mot-symbole** : TAXI SAINT IRÉNÉE en capitales espacées (Geist). Version mobile sur deux lignes.
- **Palette** : blanc cassé `#F5F4F0`, noir profond `#0C0C0D`, graphite `#39393C`, gris `#646468`, accent bronze `#8A6F4D` réservé aux détails non textuels.
- **Typographie** : Geist (interface et titres), Instrument Serif italique (mots d'accent, millésime 2014).
- **Liquid Glass** : navbar, panneau de réservation, badges, barre mobile, menu, quelques étiquettes. Jamais sur les blocs de texte.
- **Animations** : apparition progressive au scroll, dessin des lignes du hero, transitions d'étapes, validation animée, reflet du panneau qui suit discrètement le pointeur. Toutes désactivées avec `prefers-reduced-motion`.

Fichiers prêts à l'emploi dans `public/brand/` : `logo.svg`, `logo-light.svg` (fond sombre), `logo-mobile.svg`, `logo-mobile-light.svg`, `mark.svg`, `mark-light.svg`. Pour régénérer logos, icônes et images Open Graph :

```bash
npm run brand
```

---

## 14. Checklist avant mise en ligne

- [ ] Compléter `legal` dans `src/config/site.ts` (raison sociale, forme, adresse, SIRET, directeur de publication, médiateur)
- [ ] Relire et valider la politique de confidentialité (durées de conservation)
- [ ] Ajouter les photos réelles du véhicule
- [ ] Créer le compte Resend et la clé API ; vérifier le domaine d'envoi
- [ ] Déployer le Worker, définir le secret `RESEND_API_KEY`, renseigner `ALLOWED_ORIGINS`
- [ ] Ajouter la variable GitHub `PUBLIC_BOOKING_ENDPOINT`
- [ ] Envoyer une demande test et vérifier sa réception dans taxisaintirenee@gmail.com (et les indésirables)
- [ ] Configurer le domaine personnalisé et forcer HTTPS
- [ ] Renseigner `googleReviewUrl` dès que la fiche Google existe
- [ ] Déclarer le site dans Google Search Console et soumettre le sitemap
- [ ] Tester sur un iPhone et un Android réels (appel, réservation, ajout au calendrier)

---

## 15. Contrôle qualité réalisé

| Domaine | Vérification | Résultat |
| --- | --- | --- |
| Build | `npm run build` (racine et sous-chemin GitHub Pages `/taxi-saint-irenee/`) | OK, 8 pages, aucune erreur |
| Console | Navigation complète, parcours de réservation | Aucune erreur |
| Responsive | 375, 390, 414, 768, 1024, 1440, 1920, 2560, 3840 px | Aucun défilement horizontal ; mise à l'échelle 4K |
| Navigation | Menu desktop, menu mobile (Échap, retour du focus), ancres, lien actif | OK |
| Formulaire | 5 étapes, clavier seul, validation en temps réel, champs obligatoires, consentement | OK |
| Autocomplétion | Adresses, lieux fréquents, sélection clavier, saisie libre | OK |
| Estimation | Part-Dieu → Bellecour (≈ 2,8 km), Perrache → aéroport (≈ 37 km) | OK, présentée comme indicative |
| Email | Code réel du Worker exécuté localement, appel Resend intercepté | Format conforme, accusé client, Reply-To client |
| Sécurité Worker | Pré-vol CORS, origine refusée (403), type invalide (415), données invalides (422), champ piège, envoi trop rapide | OK |
| Échec réseau | Worker arrêté pendant l'envoi | Message clair, appel et email pré-rempli proposés |
| Calendrier | Fichier .ics | Heure de Paris convertie correctement, rappel 1 h avant |
| SEO | Titres, descriptions, canonical, hreflang, JSON-LD, robots, sitemap | OK, JSON-LD valide |
| Accessibilité | `h1` unique, IDs uniques, libellés, ancres, `lang`, contrastes, focus | OK |
| Performance | Poids de la page d'accueil | ≈ 100 Ko compressés au total (HTML, CSS, JS, police) |
| Contenu | Aucun emoji, aucun faux avis, aucun prix, aucun modèle de véhicule inventé | OK |

Licences des polices : Geist et Instrument Serif sont distribuées sous SIL Open Font License 1.1.
