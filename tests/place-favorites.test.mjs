import test from 'node:test';
import assert from 'node:assert/strict';

test('favorites use the resolved identity and match direct aliases without marking descendants', async () => {
  const helpers = await import('../src/place-favorites.js').catch(error => {
    if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
    throw error;
  });
  assert.equal(typeof helpers.favoritePlaceId, 'function');
  const { favoritePlaceId, isFavoritePlace, normalizeFavoritePlaceIds } = helpers;
  const canonical = { id: 'place:one', legacyPlaceId: 'legacy:one', sourceIds: ['source:one'] };
  const data = { canonicalPlaceContexts: { aliases: { 'source:one': 'place:one' }, rows: { 'place:one': canonical } } };
  assert.equal(favoritePlaceId({ id: 'source:one' }, data), 'place:one');
  assert.equal(favoritePlaceId(canonical), 'place:one');
  assert.equal(favoritePlaceId({ id: 'admin:ward', type: '行政区' }), 'admin:ward');
  assert.equal(favoritePlaceId('place:one'), 'place:one');
  assert.deepEqual(normalizeFavoritePlaceIds(['place:one', 'place:one', '', null, 7, 'admin:ward']), ['place:one', 'admin:ward']);
  assert.deepEqual(normalizeFavoritePlaceIds({ 'place:one': true }), []);
  assert.equal(isFavoritePlace({ id: 'source:one' }, ['place:one'], data), true);
  assert.equal(isFavoritePlace(canonical, ['legacy:one'], data), true);
  assert.equal(isFavoritePlace({ id: 'child', parents: [{ id: 'place:one' }] }, ['place:one'], data), false);
  assert.equal(isFavoritePlace({ id: 'place:one' }, [], data), false);
});
