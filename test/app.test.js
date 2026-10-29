// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and the recorded
// answers of the Téléray map (29/10/2026).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { HOUSE, START, createAll, createWorld, deviceId, featureId } from './helpers/world.js';
import { TOULOUSE, apiFixture, measure, shifted } from './helpers/network.js';
import { MemoryStore } from '../src/store.js';
import { PERIOD_MS } from '../src/poller.js';
import { REVALIDATE_MS } from '../src/hub.js';

const TLSE = 1411;
const MIN = 60_000;

/** The Toulouse answers, plus extra measurements after the recorded ones. */
function toulouseWith(extra) {
  return (now) => {
    const base = shifted('measures-toulouse-24h', START);
    const template = base[base.length - 1];
    return [
      ...base,
      ...extra.filter((e) => e.t <= now).map((e) => measure(template, e.t, e.raw, e.label)),
    ];
  };
}

test('without configuration, the station closest to the house is followed', async () => {
  const w = await createWorld();
  const devices = w.gladys.fake.discoveredDevices;
  assert.equal(devices.length, 1);
  assert.equal(devices[0].name, 'TOULOUSE (Téléray)');
  assert.equal(devices[0].external_id, deviceId(w.gladys, TLSE));
  assert.equal(devices[0].should_poll, false);
  assert.deepEqual(devices[0].params, [
    { name: 'station_number', value: '1411' },
    { name: 'station_name', value: TOULOUSE },
  ]);
  assert.equal(devices[0].features[0].name, 'Débit de dose (nSv/h)');
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
  // Not added to Gladys yet: nothing read but the station list.
  assert.equal(w.network.measureCalls(TOULOUSE).length, 0);
});

test('a station added to Gladys gets its states at once', async () => {
  const w = await createWorld();
  await createAll(w);
  const state = (key) => w.gladys.fake.lastState(featureId(w.gladys, TLSE, key));
  // Newest recorded measurement: 102 nSv/h, background 94.688393, validated.
  assert.equal(state('dose_rate'), 102);
  assert.equal(state('background'), 94.7);
  assert.ok(state('mean_24h') > 90 && state('mean_24h') < 105, String(state('mean_24h')));
  assert.equal(state('status'), 'Mesure validée');
  assert.match(String(state('measured_at')), /^\d\d\/\d\d \d\d:\d\d$/);
  assert.ok(w.gladys.fake.widgetRefreshes.includes('station_dose'));
});

test('the container reads by itself every 10 minutes, asking only for what is new', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const w = await createWorld({ timers: true });
  await createAll(w);
  const first = w.network.measureCalls(TOULOUSE);
  assert.equal(first.length, 1);
  const since = (call) => Date.parse(new URL(call.url).searchParams.get('time[$gte]'));
  assert.equal(since(first[0]), START - 24 * 60 * MIN);

  // The fixtures follow the clock: the newest one moves by 10 minutes too.
  const newest = w.hub.records.get(TLSE).measures.at(-1).t + PERIOD_MS;
  w.advance(PERIOD_MS);
  t.mock.timers.tick(PERIOD_MS);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  const calls = w.network.measureCalls(TOULOUSE);
  assert.equal(calls.length, 2, 'read by the timer, no onPoll');
  // The last 3 hours are asked again: the ASNR validates afterwards.
  assert.equal(since(calls[1]), newest - PERIOD_MS - REVALIDATE_MS);
  w.app.stop();
});

test('a restart asks only for the measurements after the saved ones', async () => {
  const store = new MemoryStore();
  const w = await createWorld({ store });
  await createAll(w);
  const saved = store.data.records[0].measures;
  assert.equal(saved.length, apiFixture('measures-toulouse-24h').features.length);

  const again = await createWorld({ store, devices: w.gladys.devices });
  const call = again.network.measureCalls(TOULOUSE)[0];
  assert.equal(
    Date.parse(new URL(call.url).searchParams.get('time[$gte]')),
    saved.at(-1).t - REVALIDATE_MS,
  );
  assert.equal(again.network.stationCalls(), 0, 'the station list is a day old at most');
});

test('stations typed by number and name; unknown ones are said in the status', async () => {
  const w = await createWorld({ config: { stations: 'toulouse; 6001, Nulle-Part' } });
  assert.deepEqual(
    w.gladys.fake.discoveredDevices.map((d) => d.name),
    ['TOULOUSE (Téléray)', 'TRICASTIN γ (Téléray)'],
  );
  assert.equal(w.gladys.fake.discoveredDevices[1].model, 'Téléray γ spectrometer');
  const status = w.gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.match(status.message.fr, /Balises inconnues : Nulle-Part/);
});

test('no station typed and no located house: the status says how to fix it', async () => {
  const w = await createWorld({ houses: [{ ...HOUSE, latitude: null, longitude: null }] });
  assert.equal(w.gladys.fake.discoveredDevices.length, 0);
  assert.equal(w.gladys.fake.connectionStatus.connected, false);
  assert.match(w.gladys.fake.connectionStatus.message.en, /set the location of a house/);
});

test('the map down at the first start: the status says it, and the next cycle recovers', async () => {
  const w = await createWorld({ network: { stations: { status: 502 } } });
  assert.equal(w.gladys.fake.connectionStatus.connected, false);
  assert.match(w.gladys.fake.connectionStatus.message.fr, /La carte Téléray ne répond pas/);
  w.network.stations = apiFixture('stations');
  w.advance(PERIOD_MS);
  await w.app.poller.cycle();
  assert.equal(w.gladys.fake.discoveredDevices.length, 1);
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
});

test('a silent station: the dose rate is not republished, the state says it', async () => {
  const w = await createWorld();
  await createAll(w);
  const doseId = featureId(w.gladys, TLSE, 'dose_rate');
  w.network.measures[TOULOUSE] = () => shifted('measures-toulouse-24h', START);
  const published = () =>
    w.gladys.fake.states.filter((s) => s.device_feature_external_id === doseId).length;
  const before = published();
  w.advance(3 * 60 * MIN);
  await w.app.poller.cycle();
  assert.equal(published(), before);
  assert.equal(
    w.gladys.fake.lastState(featureId(w.gladys, TLSE, 'status')),
    'Pas de mesure récente',
  );
});

test('above background: once per margin crossed, then back to normal', async () => {
  const t0 = START + 10 * MIN;
  const extra = [
    { t: t0, raw: 140 }, // background 94.7 + 45.3: margins 20 and 40
    { t: t0 + 10 * MIN, raw: 138 }, // still above 40: nothing new
    { t: t0 + 20 * MIN, raw: 300, label: 'NVA' }, // invalidated: ignored
    { t: t0 + 30 * MIN, raw: 126 }, // +31.3: above 40 - 10 (hysteresis), above 20
    { t: t0 + 40 * MIN, raw: 100 }, // back to normal
  ];
  const w = await createWorld({ network: { measures: { [TOULOUSE]: toulouseWith(extra) } } });
  await createAll(w);
  assert.deepEqual(w.gladys.fake.sceneEvents, [], 'no event on the first look');

  const events = () => w.gladys.fake.sceneEvents.map((e) => `${e.key}:${e.data.margin ?? ''}`);
  w.advance(10 * MIN); // now t0: sees it
  await w.app.poller.cycle();
  assert.deepEqual(events(), ['dose_above_background:20', 'dose_above_background:40']);
  const event = w.gladys.fake.sceneEvents[1].data;
  assert.equal(event.device, deviceId(w.gladys, TLSE));
  assert.equal(event.station_name, 'TOULOUSE (Téléray)');
  assert.equal(event.dose_rate, 140);
  assert.equal(event.background, 94.7);
  assert.equal(event.excess, 45.3);
  assert.equal(event.measured_at, new Date(t0).toISOString());

  for (let i = 0; i < 3; i += 1) {
    w.advance(10 * MIN);
    await w.app.poller.cycle();
  }
  assert.equal(events().length, 2, 'no event while it stays above, or on an invalidated value');
  w.advance(10 * MIN);
  await w.app.poller.cycle();
  assert.deepEqual(events().slice(2), ['dose_back_to_normal:']);
});

test('the state of a station: not validated, invalidated', async () => {
  const w = await createWorld({ config: { stations: '1437, 1004' } });
  await createAll(w);
  assert.equal(w.gladys.fake.lastState(featureId(w.gladys, 1437, 'status')), 'Pas encore validée');
  assert.equal(w.gladys.fake.lastState(featureId(w.gladys, 1004, 'status')), 'Mesure invalidée');
  // Every Cayenne measurement of the recording is invalidated: no average.
  assert.equal(w.gladys.fake.lastState(featureId(w.gladys, 1004, 'mean_24h')), undefined);
  assert.equal(w.gladys.fake.lastState(featureId(w.gladys, 1004, 'dose_rate')), 69);
});

test('the widget: tiles, 24 h curve, time and state; each optional block can be hidden', async () => {
  const w = await createWorld();
  const empty = await w.gladys.fake.widgetGet('station_dose', { language: 'en' });
  assert.match(empty.data.content.components[0].text, /Add a Téléray station/);
  await createAll(w);
  const ack = await w.gladys.fake.widgetGet('station_dose', { language: 'fr', settings: {} });
  const { content } = ack.data;
  assert.doesNotThrow(() => validateWidgetContent(content));
  const types = content.components.map((c) => c.type);
  assert.deepEqual(types, ['text', 'value', 'value', 'value', 'chart', 'status']);
  assert.equal(content.components[1].value, 102);
  assert.equal(content.components[1].unit, 'nSv/h');
  const chart = content.components[4];
  assert.equal(chart.series.length, 2);
  assert.equal(chart.series[0].points.length, apiFixture('measures-toulouse-24h').features.length);
  assert.ok(chart.series[0].points.length <= 300);
  assert.equal(content.components[5].items[1].value, 'Mesure validée');

  const bare = await w.gladys.fake.widgetGet('station_dose', {
    language: 'de',
    settings: { station: deviceId(w.gladys, TLSE), show_chart: false, show_status: false },
  });
  assert.deepEqual(
    bare.data.content.components.map((c) => c.type),
    ['text', 'value', 'value', 'value'],
  );
  assert.equal(bare.data.content.components[1].label, 'Dosisleistung');
});

test('the scene action gives the last measurement and a sentence', async () => {
  const w = await createWorld();
  await createAll(w);
  const ack = await w.gladys.fake.sceneAction('get_dose_rate', {
    station: deviceId(w.gladys, TLSE),
  });
  assert.equal(ack.success, true, ack.error);
  const out = ack.data.outputs ?? ack.data;
  assert.equal(out.dose_rate, 102);
  assert.equal(out.background, 94.7);
  assert.equal(out.status, 'validated');
  assert.match(
    out.summary,
    /^TOULOUSE \(Téléray\) : 102 nSv\/h \(\d\d\/\d\d \d\d:\d\d\), moyenne 24 h \d+/,
  );
  const unknown = await w.gladys.fake.sceneAction('get_dose_rate', { station: 'nope' });
  assert.equal(unknown.success, false);
});

test('the nearby search lists the closest stations with their number', async () => {
  const w = await createWorld();
  const ack = await w.gladys.fake.action('find_nearby', {});
  assert.equal(ack.success, true, ack.error);
  const message = ack.data.message ?? ack.data;
  assert.match(message.fr, /Balises les plus proches de Maison/);
  assert.match(message.fr, /• 1411 — TOULOUSE \(0,9 km\)/);
  const none = await createWorld({ houses: [] });
  const failed = await none.gladys.fake.action('find_nearby', {});
  assert.equal(failed.success, false);
  assert.match(failed.error, /Settings → Houses/);
});

test('a measurement validated or invalidated afterwards is read again', async () => {
  const t0 = START + 10 * MIN;
  const label = { value: 'NV' };
  const w = await createWorld({
    network: {
      measures: {
        [TOULOUSE]: (now) => toulouseWith([{ t: t0, raw: 300, label: label.value }])(now),
      },
    },
  });
  await createAll(w);
  w.advance(10 * MIN);
  await w.app.poller.cycle();
  const status = () => w.gladys.fake.lastState(featureId(w.gladys, TLSE, 'status'));
  assert.equal(status(), 'Pas encore validée');
  label.value = 'NVA';
  w.advance(10 * MIN);
  await w.app.poller.cycle();
  assert.equal(status(), 'Mesure invalidée');
  assert.equal(w.hub.records.get(TLSE).measures.at(-1).label, 'NVA');
});

test('a measurement dated in the future is dropped', async () => {
  const w = await createWorld();
  w.network.measures[TOULOUSE] = () => {
    const base = shifted('measures-toulouse-24h', START);
    return [...base, measure(base.at(-1), START + 365 * 24 * 60 * MIN, 99)];
  };
  await createAll(w);
  assert.ok(w.hub.records.get(TLSE).measures.at(-1).t <= START);
  assert.equal(w.gladys.fake.lastState(featureId(w.gladys, TLSE, 'dose_rate')), 102);
});

test('a device deleted then added again: a first look, no stale "back to normal"', async () => {
  const t0 = START + 10 * MIN;
  const w = await createWorld({
    network: {
      measures: {
        [TOULOUSE]: toulouseWith([
          { t: t0, raw: 140 },
          { t: t0 + 10 * MIN, raw: 95 },
        ]),
      },
    },
  });
  await createAll(w);
  w.advance(10 * MIN);
  await w.app.poller.cycle();
  assert.equal(w.gladys.fake.sceneEvents.length, 2);
  const device = w.gladys.devices[0];
  await w.gladys.fake.deviceDeleted(device);
  assert.equal(w.hub.records.get(TLSE).excess, null);
  w.advance(10 * MIN);
  await w.gladys.fake.deviceCreated(device);
  assert.equal(w.gladys.fake.sceneEvents.length, 2);
});

test('a located house set after the start is used at the next cycle', async () => {
  const w = await createWorld({ houses: [{ ...HOUSE, latitude: null, longitude: null }] });
  assert.equal(w.gladys.fake.discoveredDevices.length, 0);
  w.gladys.fake.houses.splice(0, 1, HOUSE);
  w.advance(PERIOD_MS);
  await w.app.poller.cycle();
  assert.equal(w.gladys.fake.discoveredDevices.length, 1);
});
