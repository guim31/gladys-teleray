import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS,
  STALE_MS,
  excessMargin,
  mean24h,
  merge,
  stationStatus,
  validity,
} from '../src/dose.js';

const T = Date.parse('2026-10-29T10:30:00Z');
const m = (minutes, raw, label = 'VA', background = 95) => ({
  t: T + minutes * 60_000,
  raw,
  background,
  label,
});

test('the validity codes of the ASNR map', () => {
  assert.equal(validity('VA'), STATUS.VALIDATED);
  assert.equal(validity('VM'), STATUS.VALIDATED);
  assert.equal(validity('NV'), STATUS.NOT_VALIDATED);
  assert.equal(validity('NVM'), STATUS.NOT_VALIDATED);
  assert.equal(validity('NVA'), STATUS.INVALIDATED);
});

test('a measurement older than 2 hours is not current', () => {
  const record = { measures: [m(0, 100)] };
  assert.equal(stationStatus(record, T + STALE_MS), STATUS.VALIDATED);
  assert.equal(stationStatus(record, T + STALE_MS + 1), STATUS.NO_RECENT);
  assert.equal(stationStatus({ measures: [] }, T), STATUS.NO_RECENT);
});

test('the 24 h average leaves out the invalidated values and the older ones', () => {
  const record = { measures: [m(-24 * 60, 1000), m(-20, 90), m(-10, 300, 'NVA'), m(0, 100, 'NV')] };
  assert.equal(mean24h(record), 95);
});

test('the margins above background, with hysteresis on the way down', () => {
  const at = (raw, previous, label) => excessMargin({ measures: [m(0, raw, label)] }, T, previous);
  assert.equal(at(114, 0), 0);
  assert.equal(at(115, 0), 20);
  assert.equal(at(135, 0), 40);
  assert.equal(at(400, 0), 200);
  assert.equal(at(126, 40), 40, 'above 40 - 10 keeps 40');
  assert.equal(at(124, 40), 20);
  assert.equal(at(106, 20), 20);
  assert.equal(at(104, 20), 0);
  assert.equal(at(400, 0, 'NVA'), null, 'an invalidated value tells nothing');
  assert.equal(excessMargin({ measures: [m(0, 400)] }, T + STALE_MS + 1, 0), null);
  assert.equal(excessMargin({ measures: [m(0, 400, 'VA', null)] }, T, 0), null);
});

test('merging keeps one measurement per time, sorted, over 24 hours', () => {
  const { measures, added } = merge([m(-25 * 60, 1), m(-10, 2)], [m(0, 3), m(-10, 4)]);
  assert.deepEqual(
    measures.map((x) => x.raw),
    [4, 3],
  );
  assert.equal(added, 1);
});
