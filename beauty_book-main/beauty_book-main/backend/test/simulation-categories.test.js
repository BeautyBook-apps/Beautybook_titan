import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSimulationCategory } from '../../shared/simulationCategories.js';
import { imageInput } from '../src/services/image-jobs.js';
import { museImagePrompt } from '../src/services/muse.js';

test('normalizes service categories to a localized edit target', () => {
  const cases = [
    [{ category: 'Ongles' }, 'manucure', 'ongles des mains'],
    [{ category: 'Ongles', subcategory: 'Pédicure' }, 'pedicure', 'ongles des pieds'],
    [{ category: 'Perruque' }, 'perruque', 'cheveux et implantation de la perruque'],
    [{ category: 'Coiffure', subcategory: 'Tresses' }, 'tresses', 'cheveux'],
    [{ category: 'Barbe' }, 'barbe', 'barbe et moustache'],
    [{ category: 'Cils & Sourcils' }, 'cils', 'cils et sourcils'],
  ];
  for (const [input, id, target] of cases) {
    const result = resolveSimulationCategory(input);
    assert.equal(result.id, id);
    assert.equal(result.target, target);
    assert.equal(result.supported, true);
  }
  assert.equal(resolveSimulationCategory({ category: 'Massage' }).supported, false);
});

test('hair changer preserves only the service target in its request and prompt', () => {
  const input = imageInput({
    mode: 'hair', category: 'Ongles', subcategory: 'Manucure', garment_name: 'Cherry Noir',
    user_photo: 'data:image/png;base64,aW1hZ2U=', garment_photo: 'data:image/png;base64,cmVmZXJlbmNl',
  });
  assert.equal(input.category, 'manucure');
  assert.equal(input.target_area, 'ongles des mains');
  const prompt = museImagePrompt(input);
  assert.match(prompt, /fingernail plates/i);
  assert.match(prompt, /Preserve fingers, hands, skin/i);
  assert.doesNotMatch(prompt, /hairstyle and hair area/i);
});
