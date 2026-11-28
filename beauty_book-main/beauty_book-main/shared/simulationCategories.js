const definitions = [
  ['pedicure', /pedicur|toenail|ongles? (des? )?pieds?/, 'ongles des pieds', 'Photo rapprochée des pieds, tous les ongles visibles', 'Application de la pédicure', 'Change ONLY the visible toenail plates: transfer the reference polish color, nail art, finish, shape and length. Keep toes, feet, skin and fingernails unchanged.'],
  ['manucure', /ongle|manicur|manucur|nail/, 'ongles des mains', 'Photo rapprochée des mains, ongles nets et bien visibles', 'Application de la manucure', 'Change ONLY the visible fingernail plates: reproduce the reference polish color, nail art, patterns, decorations, gloss or chrome finish, shape and length on each visible nail. Preserve fingers, hands, skin, jewelry and toenails.'],
  ['perruque', /perruqu|wig|lace/, 'cheveux et implantation de la perruque', 'Visage et contour des cheveux bien visibles', 'Pose de la perruque', 'Replace ONLY the scalp hair with the reference wig, matching its color, texture, cut, volume and hairline. Preserve the face, forehead shape, eyebrows and facial hair.'],
  ['tresses', /tress|braid|locks|twist/, 'cheveux', 'Tête entière et racines visibles', 'Création des tresses', 'Change ONLY scalp hair to match the reference braid pattern, parting, texture, length and color. Preserve the face and all facial hair.'],
  ['extensions', /extension/, 'cheveux', 'Cheveux visibles sur toute leur longueur', 'Pose des extensions', 'Modify ONLY scalp hair to match reference hair extensions, their length, volume, texture and color. Preserve the face and facial hair.'],
  ['barbe', /barbe|beard|moustache|mustache/, 'barbe et moustache', 'Photo nette du bas du visage et de la barbe', 'Mise en forme de la barbe', 'Modify ONLY the beard and moustache to match reference shape, length, contour and color. Preserve scalp hair, lips, skin, nose and face shape.'],
  ['cils', /cils|sourcil|lash|brow/, 'cils et sourcils', 'Gros plan des yeux et sourcils, sans flou', 'Application du style du regard', 'Modify ONLY the eyelashes or eyebrows targeted by the reference style. Preserve the eyes, iris color, eyelids, skin, makeup and scalp hair.'],
  ['maquillage', /maquill|makeup|make up/, 'maquillage du visage', 'Visage net, de face et bien éclairé', 'Application du maquillage', 'Apply ONLY the reference makeup to the corresponding face areas. Preserve facial anatomy, skin tone outside makeup areas, hair, identity and eye color.'],
  ['tatouage', /tatou|tattoo/, 'zone du tatouage visible sur la photo', 'Photo rapprochée de la zone où appliquer le motif', 'Application du tatouage', 'Apply ONLY the reference tattoo motif to the matching visible body area. Preserve skin outside the motif, anatomy, existing unrelated tattoos and clothing.'],
  ['piercing', /piercing/, 'emplacement du piercing', 'Gros plan de la zone où placer le bijou', 'Pose du piercing', 'Add ONLY the reference piercing jewelry at the corresponding visible anatomical location. Preserve anatomy, skin, hair and existing unrelated jewelry.'],
  ['epilation', /epilation|waxing|hair removal/, 'pilosité de la zone montrée', 'Photo nette de la zone à épiler', 'Simulation de l’épilation', 'Remove ONLY unwanted body hair in the area clearly indicated by the reference. Preserve skin texture, anatomy, scalp hair and all unrelated regions.'],
  ['soin', /soin|facial|skin care/, 'apparence de la peau du visage', 'Photo nette du visage, sans filtre', 'Simulation du soin', 'Make ONLY a subtle cosmetic skin-finish adjustment matching the reference on the visible face. Preserve pores, natural texture, identity, features, hair, eyebrows and makeup. Do not remove medical lesions or imply medical treatment results.'],
  ['massage', /massage|spa|bien etre|wellness/, 'aucune transformation visuelle définie', 'Cette prestation ne définit pas de transformation visuelle à simuler', 'Prestation sans filtre visuel', null],
  ['coiffure', /coiffure|cheveux|hair|coupe|coloration/, 'cheveux', 'Visage et cheveux nets, tête entière visible', 'Changement de coiffure', 'Modify ONLY scalp hair to reproduce the reference hairstyle, cut, color, texture and volume. Preserve the face, eyebrows and facial hair.'],
];
export const normalizeSimulationText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-_]/g, ' ');

export function resolveSimulationCategory({ category, subcategory, serviceCategory } = {}) {
  // Explicit service tab first, then subtype (Ongles / Pédicure), then parent.
  for (const value of [serviceCategory, subcategory, category]) {
    const normalized = normalizeSimulationText(value);
    const match = definitions.find(([, pattern]) => pattern.test(normalized));
    if (match) {
      const [id, , target, photoHint, action, instruction] = match;
      return { id, target, photoHint, action, instruction, supported: Boolean(instruction) };
    }
  }
  return { id: 'unknown', target: 'zone à préciser', photoHint: 'Choisissez un style avec une catégorie précise', action: 'Application du style', instruction: null, supported: false };
}
