import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { databaseFixture, users } from './database-fixture.js';
import { adminEntity } from '../src/services/admin.js';

test('admin content persists form fields, rejects missing rows and audits mutations', async () => {
  const db = await databaseFixture();
  try {
    for (const file of ['20260810_add_immobilier_columns.sql', '202610070001_admin_content_fields.sql']) {
      const sql = await fs.readFile(new URL('../../../../supabase/migrations/' + file, import.meta.url), 'utf8');
      await db.pg.exec(sql);
      await db.pg.exec(sql); // migrations remain safe to reapply
    }
    const run = body => adminEntity(users.admin, body, 'content-test', db);
    const style = await run({ table: 'Style', operation: 'create', data: {
      title: 'Tresses', status: 'brouillon', author_avatar: 'https://example.com/image.jpg',
      type_cheveux: 'Crépus', type_peau: '', type_prestation: 'Coiffure',
      temps_moyen: '60 min', niveau_difficulte: 'Avancé', mots_cles: ['tresses'],
      produits_utilises: [{ id: 'product', name: 'Soin' }], outils_utilises: ['Peigne'], subcategory: 'tresses',
    } });
    assert.equal(style.type_cheveux, 'Crépus');
    assert.deepEqual(style.mots_cles, ['tresses']);
    const updated = await run({ table: 'Style', operation: 'update', id: style.id, data: { status: 'publie' } });
    assert.equal(updated.status, 'publie');
    const listing = await run({ table: 'ImmobilierListing', operation: 'create', data: {
      title: 'Salon', price: 100, price_per_m2: 10, price_fonds_commerce: 1000, tax_mode: 'TTC',
      salon_type: 'salon_de_beaute', rooms: 2, floor: 'RDC', location: 'Paris', area: '10',
      postal_code: '75001', equip: 'Fauteuil', extra: '', video_url: '', latitude: 48.86, longitude: 2.35,
    } });
    assert.equal(Number(listing.price_fonds_commerce), 1000);
    await assert.rejects(run({ table: 'ImmobilierListing', operation: 'update', id: users.other.id, data: { status: 'loue' } }), { code: 'RESOURCE_NOT_FOUND' });
    await assert.rejects(run({ table: 'Style', operation: 'update', id: style.id, data: { created_by_id: users.other.id } }), { code: 'FIELD_NOT_WRITABLE' });
    assert.equal((await db.query('SELECT count(*)::int AS n FROM bb_audit_log')).rows[0].n, 3);
  } finally { await db.close(); }
});
