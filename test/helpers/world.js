// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a simulated network, a store
// in memory, a clock, and the integration wired on top (registerHandlers).
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { MemoryStore } from '../../src/store.js';
import { CAYENNE, TOULON, TOULOUSE, createNetwork, shifted } from './network.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';

/** The test clock starts here (the day the fixtures were taken). */
export const START = Date.parse('2026-10-29T11:00:00Z');

/** A house in Toulouse (Capitole). */
export const HOUSE = {
  id: 'h1',
  name: 'Maison',
  selector: 'maison',
  latitude: 43.6045,
  longitude: 1.4442,
};

/** The recorded stations, answering their fixtures moved to "now". */
export const freshMeasures = () => ({
  [TOULOUSE]: (now) => shifted('measures-toulouse-24h', now),
  [CAYENNE]: (now) => shifted('measures-cayenne-invalid', now),
  [TOULON]: (now) => shifted('measures-toulon-not-validated', now),
});

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {object} [options.network] createNetwork options
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys (a house in Toulouse by default)
 * @param {object} [options.store]
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] run the reading timer (to be mocked by the test)
 */
export async function createWorld({
  config = {},
  network: networkOptions = {},
  devices = [],
  houses = [HOUSE],
  store = new MemoryStore(),
  connect = true,
  timers = false,
} = {}) {
  const clock = { now: START };
  const now = () => clock.now;
  const network = createNetwork({ measures: freshMeasures(), ...networkOptions, now });
  const gladys = createFakeGladys({ config, devices, houses });
  const app = registerHandlers(gladys, { store, fetch: network.fetch, timers, now });
  if (connect) {
    await gladys.connect();
  }
  return {
    gladys,
    app,
    network,
    store,
    clock,
    hub: app.hub,
    /** Move the clock forward. */
    advance(ms) {
      clock.now += ms;
    },
  };
}

/** Add every discovered device to Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.gladys.fake.discoveredDevices) {
    await world.gladys.fake.deviceCreated(device);
  }
}

/** The external id of a feature of a station. */
export const featureId = (gladys, id, key) =>
  gladys.externalIds('station', String(id)).feature(key);

/** The external id of the device of a station. */
export const deviceId = (gladys, id) => gladys.externalIds('station', String(id)).device;
