/**
 * AVIS CLIENTS
 * ------------------------------------------------------------------
 * N'ajouter ici QUE des avis réels, avec l'accord de leur auteur
 * ou recopiés fidèlement depuis une source publique (ex. Google).
 *
 * Tant que la liste est vide, le site affiche un état d'attente élégant :
 * "Les avis de nos clients seront bientôt disponibles."
 *
 * La note moyenne et le nombre d'avis sont calculés automatiquement.
 *
 * Exemple de structure (à NE PAS publier tel quel — ce n'est pas un vrai avis) :
 *
 *   {
 *     author: 'Prénom N.',
 *     rating: 5,
 *     date: '2026-09-14',          // AAAA-MM-JJ, facultatif
 *     text: 'Texte exact de l’avis.',
 *     lang: 'fr',                  // langue d'origine de l'avis
 *     source: 'Google',            // 'Google' | 'Direct'
 *   },
 */
export interface Review {
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  date?: string;
  text: string;
  lang?: 'fr' | 'en';
  source?: 'Google' | 'Direct';
}

export const reviews: Review[] = [];
