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
    cpamConvention: '',       // Numéro de convention CPAM du taxi (facultatif, affiché s'il est renseigné)
  },
} as const;

/**
 * Points d'intérêt proposés en raccourci dans la réservation (coordonnées WGS84 : [longitude, latitude]).
 * kind "transport" : proposés pour tous les trajets.
 * kind "health"    : proposés en priorité pour les transports médicaux (CPAM).
 * address          : ajoutée à la demande pour faciliter la prise en charge.
 */
export const quickPlaces = [
  { id: 'lys', kind: 'transport', fr: 'Aéroport Lyon-Saint Exupéry', en: 'Lyon-Saint Exupéry Airport', address: '', lonlat: [5.079, 45.7215] },
  { id: 'partdieu', kind: 'transport', fr: 'Gare Lyon Part-Dieu', en: 'Lyon Part-Dieu Station', address: '', lonlat: [4.8593, 45.7606] },
  { id: 'perrache', kind: 'transport', fr: 'Gare Lyon Perrache', en: 'Lyon Perrache Station', address: '', lonlat: [4.8262, 45.7486] },
  { id: 'lystgv', kind: 'transport', fr: 'Gare Lyon-Saint Exupéry TGV', en: 'Lyon-Saint Exupéry TGV Station', address: '', lonlat: [5.0757, 45.7208] },
  { id: 'heh', kind: 'health', fr: 'Hôpital Édouard Herriot', en: 'Édouard Herriot Hospital', address: '5 place d’Arsonval, 69003 Lyon', lonlat: [4.87997, 45.7434] },
  { id: 'croixrousse', kind: 'health', fr: 'Hôpital de la Croix-Rousse', en: 'Croix-Rousse Hospital', address: '103 Grande Rue de la Croix-Rousse, 69004 Lyon', lonlat: [4.83269, 45.78181] },
  { id: 'lyonsud', kind: 'health', fr: 'Centre hospitalier Lyon Sud', en: 'Lyon Sud Hospital', address: '165 chemin du Grand Revoyet, 69310 Pierre-Bénite', lonlat: [4.80751, 45.70152] },
  { id: 'ghe', kind: 'health', fr: 'Groupement hospitalier Est', en: 'Groupement hospitalier Est', address: '59 boulevard Pinel, 69500 Bron', lonlat: [4.8972, 45.74789] },
  { id: 'berard', kind: 'health', fr: 'Centre Léon Bérard', en: 'Centre Léon Bérard', address: '28 rue Laennec, 69008 Lyon', lonlat: [4.87771, 45.741] },
  { id: 'stjoseph', kind: 'health', fr: 'Hôpital Saint Joseph Saint Luc', en: 'Saint Joseph Saint Luc Hospital', address: '20 quai Claude Bernard, 69007 Lyon', lonlat: [4.8355, 45.74979] },
] as const;

/** URL de l'API d'envoi (Worker Cloudflare). Vide = mode email de secours. */
export const bookingEndpoint: string = (import.meta.env.PUBLIC_BOOKING_ENDPOINT ?? '').trim();

export const yearsOfService = () => new Date().getFullYear() - site.foundingYear;
