/**
 * Informations de l'entreprise — source unique de vérité.
 * Modifier ici pour mettre à jour l'ensemble du site (FR et EN), le SEO et les données structurées.
 */
export const site = {
  name: 'Taxi Saint Irénée',
  foundingYear: 2014,
  city: 'Lyon',
  region: 'Auvergne-Rhône-Alpes',
  country: 'FR',

  phone: {
    display: '06 61 88 27 07',
    international: '+33 6 61 88 27 07',
    href: 'tel:+33661882707',
    e164: '+33661882707',
  },
  email: 'taxisaintirenee@gmail.com',

  /**
   * Lien "Laisser un avis" Google (fiche Google Business Profile).
   * Format habituel : https://g.page/r/XXXXXXXX/review
   * Laisser vide tant que la fiche n'existe pas : le bouton ouvre alors un email.
   */
  googleReviewUrl: '',

  /** Lien public vers la fiche Google (facultatif, utilisé dans les données structurées). */
  googleBusinessUrl: '',

  /**
   * Mentions légales — À COMPLÉTER avant la mise en ligne.
   * Les valeurs vides s'affichent comme "À compléter" sur la page Mentions légales.
   */
  legal: {
    companyName: '',          // Raison sociale exacte
    legalForm: '',            // ex. EI, EURL, SASU…
    address: '',              // Adresse du siège / domiciliation
    siret: '',                // Numéro SIRET
    vatNumber: '',            // TVA intracommunautaire (si applicable)
    publicationDirector: '',  // Nom du directeur de la publication
    taxiLicence: '',          // Numéro d'autorisation de stationnement (ADS) / carte professionnelle, si souhaité
    mediator: '',             // Médiateur de la consommation (nom + site)
  },
} as const;

/** Points d'intérêt proposés en raccourci dans la réservation (coordonnées WGS84 : [longitude, latitude]). */
export const quickPlaces = [
  { id: 'lys', fr: 'Aéroport Lyon-Saint Exupéry', en: 'Lyon-Saint Exupéry Airport', lonlat: [5.079, 45.7215] },
  { id: 'partdieu', fr: 'Gare Lyon Part-Dieu', en: 'Lyon Part-Dieu Station', lonlat: [4.8593, 45.7606] },
  { id: 'perrache', fr: 'Gare Lyon Perrache', en: 'Lyon Perrache Station', lonlat: [4.8262, 45.7486] },
  { id: 'lystgv', fr: 'Gare Lyon-Saint Exupéry TGV', en: 'Lyon-Saint Exupéry TGV Station', lonlat: [5.0757, 45.7208] },
] as const;

/** URL de l'API d'envoi (Worker Cloudflare). Vide = mode email de secours. */
export const bookingEndpoint: string = (import.meta.env.PUBLIC_BOOKING_ENDPOINT ?? '').trim();

export const yearsOfService = () => new Date().getFullYear() - site.foundingYear;
