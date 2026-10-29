// -----------------------------------------------------------------------------
// The container's own timer.
//
// Téléray measures every 10 minutes, and its map shows a measurement some
// 20 to 40 minutes later: reading every 10 minutes is enough, a faster pace
// would only load a public service. The devices are published with
// `should_poll: false` (10 minutes is not a polling frequency of Gladys): the
// container reads by itself. What is read: the followed stations whose device
// the user added to Gladys, one after the other. The station list is read
// again once a day.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'poller' });

/** The pace of the reads. */
export const PERIOD_MS = 10 * 60_000;

/** A station read less than this ago is not read again (a device just added, a restart). */
const MIN_GAP_MS = 60_000;

/**
 * @param {object} options
 * @param {object} options.gladys
 * @param {import('./hub.js').Hub} options.hub
 * @param {() => Promise<void>} options.afterCycle publishes what the reads changed
 * @param {() => Promise<void>} [options.beforeCycle] the daily station list
 * @param {boolean} [options.timers] run the periodic timer (tests may turn it off)
 * @param {() => number} [options.now]
 */
export function createPoller({
  gladys,
  hub,
  afterCycle = async () => {},
  beforeCycle = async () => {},
  timers = true,
  now = () => Date.now(),
}) {
  const lastReadAt = new Map();
  const inFlight = new Map();
  let timer = null;
  let stopped = true;

  async function readStation(station, { force = false } = {}) {
    const running = inFlight.get(station.id);
    if (running) {
      await running.catch(() => {});
      return;
    }
    const last = lastReadAt.get(station.id);
    if (!force && last !== undefined && now() - last < MIN_GAP_MS) {
      return;
    }
    lastReadAt.set(station.id, now());
    const run = hub.refresh(station);
    inFlight.set(station.id, run);
    try {
      await run;
    } catch (err) {
      // Logged once by the hub's issue log; the next cycle retries.
      logger.debug(`${station.id}: ${err.message}`);
    } finally {
      inFlight.delete(station.id);
    }
  }

  /** One cycle: the followed stations added to Gladys (or the given ones), in sequence. */
  async function cycle({ stations, force = true } = {}) {
    if (gladys.connected === false) {
      logger.debug('Gladys unreachable: cycle skipped');
      return;
    }
    await beforeCycle();
    for (const station of stations ?? hub.followed.filter((s) => hub.isCreated(s))) {
      await readStation(station, { force });
    }
    await afterCycle();
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } catch (err) {
        logger.error(`Reading cycle failed (${err.message})`);
      } finally {
        schedule();
      }
    }, PERIOD_MS);
  }

  return {
    /** (Re)start: read now, then every PERIOD_MS. */
    async restart() {
      stopped = false;
      schedule();
      await cycle({ force: false });
    },
    cycle,
    /** Read some stations now unless read in the last minute. */
    async refreshNow(stations) {
      await cycle({ stations, force: false });
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
