/**
 * ZONE DESSERVIE
 * Liste INDICATIVE de communes affichées dans la section "Zone".
 * Elle n'est pas présentée comme exhaustive sur le site.
 * Ajouter / retirer librement des communes.
 */
export const communes: string[] = [
  'Lyon',
  'Sainte-Foy-lès-Lyon',
  'Tassin-la-Demi-Lune',
  'Francheville',
  'Oullins-Pierre-Bénite',
  'Écully',
];

/** Communes mentionnées dans les données structurées (areaServed). */
export const areaServed: string[] = [...communes, 'Métropole de Lyon'];
