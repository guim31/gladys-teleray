import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_AGENT,
  distanceKm,
  fetchMeasures,
  fetchStations,
  parseMeasure,
  parseStation,
} from '../src/api.js';
import { TOULOUSE, apiFixture, createNetwork } from './helpers/network.js';

test('a recorded station list: number, names, position, spectrometers', async () => {
  const network = createNetwork();
  const stations = await fetchStations({ fetch: network.fetch });
  assert.equal(stations.length, apiFixture('stations').features.length);
  const toulouse = stations.find((s) => s.id === 1411);
  assert.deepEqual(toulouse, {
    id: 1411,
    name: TOULOUSE,
    publicName: 'TOULOUSE',
    latitude: 43.598,
    longitude: 1.45,
    spectrometer: false,
  });
  assert.equal(stations.find((s) => s.id === 6001).spectrometer, true);
  // Recorded as { "0": lon, "1": lat } instead of an array.
  const bastia = stations.find((s) => s.id === 1347);
  assert.equal(bastia.latitude, 42.703091);
  assert.equal(bastia.longitude, 9.4472723);
  assert.equal(
    parseStation({ properties: { irsnId: 1, name: 'X' }, geometry: null }).latitude,
    null,
  );
  assert.equal(network.calls[0].headers['User-Agent'], USER_AGENT);
});

test('a recorded measurement', () => {
  const feature = apiFixture('measures-toulouse-24h').features[0];
  assert.deepEqual(parseMeasure(feature), {
    t: Date.parse('2026-10-29T10:30:46.000Z'),
    raw: 102,
    background: 94.7,
    label: 'VA',
  });
  assert.equal(parseMeasure({ time: 'x', properties: { doseRateRaw: 1 } }), null);
  assert.equal(parseMeasure({ time: feature.time, properties: {} }), null);
});

test('the measurements are asked by station name and date, and sorted', async () => {
  const network = createNetwork({
    measures: { [TOULOUSE]: apiFixture('measures-toulouse-24h').features },
  });
  const since = Date.parse('2026-10-29T10:00:00Z');
  const measures = await fetchMeasures(TOULOUSE, since, { fetch: network.fetch });
  assert.equal(measures.length, 4, '10:00:46, 10:10:46, 10:20:46, 10:30:46');
  assert.ok(measures.every((x, i) => i === 0 || x.t > measures[i - 1].t));
  assert.ok(measures.every((x) => x.t >= since));
  const query = new URL(network.calls[0].url).searchParams;
  assert.equal(query.get('properties.name'), TOULOUSE);
  assert.equal(query.get('$sort[time]'), '1');
});

test('errors: HTTP status, network, unexpected document', async () => {
  const failing = createNetwork({ stations: { status: 503 } });
  await assert.rejects(fetchStations({ fetch: failing.fetch }), /HTTP 503/);
  const offline = async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
  };
  await assert.rejects(fetchStations({ fetch: offline }), /unreachable \(ECONNREFUSED\)/);
  const odd = async () => new Response('{"data":[]}', { status: 200 });
  await assert.rejects(fetchStations({ fetch: odd }), /unexpected document/);
});

test('distances', () => {
  const paris = { latitude: 48.8566, longitude: 2.3522 };
  const toulouse = { latitude: 43.6045, longitude: 1.4442 };
  assert.ok(Math.abs(distanceKm(paris, toulouse) - 589) < 5);
});
