import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseStations } from '../src/config.js';

test('defaults', () => {
  assert.deepEqual(normalizeConfig(), { stations: [], language: DEFAULT_CONFIG.language });
  assert.equal(normalizeConfig({ language: 'it' }).language, 'fr');
});

test('the typed stations: commas or semicolons, spaces kept inside a name, duplicates dropped', () => {
  assert.deepEqual(parseStations(' 1411 , Paris Bercy;1411; toulouse ,TOULOUSE,, '), [
    '1411',
    'Paris Bercy',
    'toulouse',
  ]);
});
