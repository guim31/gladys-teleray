// -----------------------------------------------------------------------------
// The integration, wired on a Gladys client: the real one (index.js) or the
// SDK's fake Gladys (tests). Every handler is registered here, before
// connect().
//
//   connected       -> config, station list, followed stations, first read
//   poller          -> reads the stations every 10 minutes (src/poller.js)
//   onDeviceCreated -> the states of the new device, now
//   action          -> find_nearby (src/actions.js)
//   scene action    -> get_dose_rate (src/scenes.js)
//   scene triggers  -> dose_above_background, dose_back_to_normal (src/hub.js)
//   widget          -> station_dose (src/widgets.js)
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { Hub } from './hub.js';
import { Store } from './store.js';
import { createPoller } from './poller.js';
import { ACTION, findNearby } from './actions.js';
import { GET_DOSE_RATE, getDoseRate } from './scenes.js';
import { WIDGET_KEY, buildStationContent } from './widgets.js';
import { MESSAGES, TEXT } from './i18n.js';

const logger = createLogger({ name: 'teleray' });

/**
 * @param {object} gladys GladysIntegration, or the SDK's fake Gladys
 * @param {object} [options]
 * @param {{ load: Function, save: Function, flush?: Function }} [options.store]
 * @param {typeof fetch} [options.fetch]
 * @param {boolean} [options.timers] run the reading timer
 * @param {() => number} [options.now]
 */
export function registerHandlers(gladys, { store = new Store(), fetch, timers = true, now } = {}) {
  let config = normalizeConfig();
  const getConfig = () => config;
  const hub = new Hub({ gladys, getConfig, store, fetch, now });
  const ready = hub.load();
  let lastStatus = null;
  let houses = [];
  let followedKey = '';

  /** Daily: the station list, and the followed stations it resolves. */
  async function beforeCycle() {
    await hub.refreshNetwork();
    if (config.stations.length === 0 && hub.followed.length === 0) {
      // No located house at start (or Gladys failed to answer): asked again.
      await readHouses();
    }
    hub.resolve(houses, config);
    const key = hub.followed.map((s) => s.id).join(',');
    if (key !== followedKey) {
      hub.prune();
      await publishDevices();
      // Only once published: a failed publication is tried again next cycle.
      followedKey = key;
      logFollowed();
    }
  }

  async function readHouses() {
    houses = await gladys.getHouses().catch((err) => {
      logger.warn(`Cannot read the houses: ${err.message}`);
      return houses;
    });
  }

  /** Publish what the reads changed: /data, status, widget. */
  async function afterCycle() {
    await hub.save();
    await updateStatus();
    if (hub.widgetChanged) {
      hub.widgetChanged = false;
      gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  const poller = createPoller({ gladys, hub, afterCycle, beforeCycle, timers, now });

  async function publishDevices() {
    await gladys.publishDiscoveredDevices(hub.buildDevices(config));
  }

  /** The status of the Configuration screen, sent when it changes. */
  async function updateStatus() {
    let status = { connected: true };
    if (hub.followed.length === 0 && hub.network.list.length === 0) {
      status = { connected: false, message: TEXT.apiUnreachable };
    } else if (hub.unknown.length > 0) {
      status = { connected: false, message: MESSAGES.unknownStations(hub.unknown) };
    } else if (hub.followed.length === 0) {
      status = { connected: false, message: TEXT.notConfigured };
    } else if (hub.apiDown()) {
      status = { connected: false, message: TEXT.apiUnreachable };
    }
    const key = JSON.stringify(status);
    if (key !== lastStatus) {
      lastStatus = key;
      await gladys.setConnectionStatus(status.connected, status.message);
    }
  }

  function logFollowed() {
    const names = hub.followed.map((s) => `${s.publicName} (${s.id})`).join(', ');
    logger.info(names ? `Following ${names}` : 'No station followed');
    if (hub.unknown.length > 0) {
      logger.warn(`Unknown stations: ${hub.unknown.join(', ')}`);
    }
    if (hub.noHouse) {
      logger.warn('No station typed and no house with a location');
    }
  }

  async function start() {
    await ready;
    if (config.stations.length === 0) {
      await readHouses();
    }
    followedKey = null;
    await poller.restart();
  }

  // --- Connection lifecycle ----------------------------------------------------
  // The SDK logs the WebSocket lifecycle itself.
  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      await start();
    } catch (err) {
      logger.error(`Post-connection initialization failed: ${err.message}`);
      await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
    }
  });

  gladys.on('disconnected', () => {
    // Nothing reaches Gladys while it is away: the status is sent again on return.
    lastStatus = null;
  });

  gladys.onConfigUpdated(async (raw) => {
    logger.info('Configuration updated');
    config = normalizeConfig(raw);
    await start();
  });

  // --- Discovery -----------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await ready;
    await publishDevices();
  });

  // --- A device added (or updated) in Gladys: its states now ---------------------
  // The core dropped the states sent before the device existed: read the
  // station (unless read in the last minute), send everything, and nudge the
  // widget, which can now show it.
  async function onDeviceAdded(device) {
    await ready;
    const station = hub.stationByDevice(device.external_id);
    if (!station) {
      return;
    }
    await poller.refreshNow([station]);
    await hub.publishStates(station, { force: true });
    gladys.requestWidgetRefresh(WIDGET_KEY);
  }
  gladys.onDeviceCreated(onDeviceAdded);
  gladys.onDeviceUpdated(onDeviceAdded);
  gladys.onDeviceDeleted(async (device) => {
    await ready;
    hub.forgetDevice(device.external_id);
    await hub.save();
    gladys.requestWidgetRefresh(WIDGET_KEY);
  });

  // --- Configuration screen button ----------------------------------------------
  gladys.onAction(ACTION.FIND_NEARBY, async (fields) => {
    logger.info('Action: search for the closest stations');
    await ready;
    return findNearby(gladys, hub, fields ?? {});
  });

  // --- Scene action ---------------------------------------------------------------
  gladys.onSceneAction(GET_DOSE_RATE, async (fields) => {
    await ready;
    return getDoseRate(hub, fields ?? {}, config.language);
  });

  // --- Dashboard widget -----------------------------------------------------------
  gladys.onWidgetGet(WIDGET_KEY, async ({ settings, language }) => {
    await ready;
    return buildStationContent({ hub, settings, language });
  });

  return {
    hub,
    poller,
    ready,
    getConfig,
    /** Stop the timer and wait for the last write under /data. */
    async stop() {
      poller.stop();
      await store.flush?.();
    },
  };
}
