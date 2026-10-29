// -----------------------------------------------------------------------------
// The stations the integration follows, what it knows about them, and what it
// publishes to Gladys.
//
// The station list of the network (~480 stations, names and positions) is
// read once a day and kept under /data: it resolves the configured stations
// (numbers or names) and finds the one closest to the house. Each followed
// station has a "record": its last 24 hours of measurements (one every
// 10 minutes), also kept under /data, so a restart asks only for what is new.
//
// Threshold triggers: "Dose rate above background" fires once per margin
// crossed (20, 40, 100, 200 nSv/h above the station's background, src/dose.js),
// "Dose rate back to normal" once when no margin is exceeded any more. Only
// for a station added to Gladys, never on the first look at a station (a level
// already high when the station is added is no news to fire on).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { distanceKm, fetchMeasures, fetchStations } from './api.js';
import { buildDevice, deviceName, idsOf } from './devices.js';
import {
  DAY_MS,
  MARGINS,
  STATUS,
  background,
  excessMargin,
  isFresh,
  latest,
  mean24h,
  merge,
  stationStatus,
} from './dose.js';
import { STATUS_TEXT, formatTime } from './i18n.js';
import { MAX_STATIONS } from './config.js';
import { createIssueLog } from './issues.js';

const logger = createLogger({ name: 'stations' });

/** The station list is read again after this long. */
export const STATIONS_MAX_AGE_MS = DAY_MS;

/** The last measurements are asked again this far back: their validity may have changed. */
export const REVALIDATE_MS = 3 * 60 * 60 * 1000;

/** A measurement dated further in the future is dropped (a wrong clock would freeze the station). */
const FUTURE_MS = 15 * 60_000;

/** An unchanged value is published again this often (Gladys: "no recent value" past 48 h). */
export const STATE_HEARTBEAT_MS = 6 * 60 * 60 * 1000;

/** Keys of the scene triggers. */
export const TRIGGER = {
  ABOVE: 'dose_above_background',
  BACK: 'dose_back_to_normal',
};

const STORE_VERSION = 1;

const normalize = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[\s_]+/g, '-');

export class Hub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {() => object} options.getConfig the current normalized config
   * @param {{ load: Function, save: Function }} options.store
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   */
  constructor({ gladys, getConfig, store, fetch, now = () => Date.now() }) {
    this.gladys = gladys;
    this.getConfig = getConfig;
    this.store = store;
    this.deps = { fetch };
    this.now = now;
    /** The network: { list, fetchedAt }. */
    this.network = { list: [], fetchedAt: 0 };
    /** Record by station number. */
    this.records = new Map();
    /** The followed stations, resolved from the config: station objects. */
    this.followed = [];
    /** Typed stations that match none. */
    this.unknown = [];
    /** True when the config is empty and no house has a location. */
    this.noHouse = false;
    /** Outcome of the last read of each station: { ok, at }. */
    this.lastResults = new Map();
    /** Scene events waiting for the publication of their station's states. */
    this.pendingEvents = new Map();
    this.widgetChanged = false;
    this.persistNeeded = false;
    this.issues = createIssueLog(logger);
  }

  async load() {
    const data = await this.store.load();
    if (data.version !== STORE_VERSION) {
      return;
    }
    if (Array.isArray(data.network?.list)) {
      const list = data.network.list.filter(
        (s) =>
          s &&
          Number.isInteger(s.id) &&
          typeof s.name === 'string' &&
          typeof s.publicName === 'string',
      );
      this.network = { list, fetchedAt: Number(data.network.fetchedAt) || 0 };
    }
    for (const record of data.records ?? []) {
      if (record && Number.isInteger(record.id) && Array.isArray(record.measures)) {
        this.records.set(record.id, record);
      }
    }
  }

  persist() {
    return this.store.save({
      version: STORE_VERSION,
      network: this.network,
      records: [...this.records.values()],
    });
  }

  /** Persist if anything changed since the last save. */
  async save() {
    if (this.persistNeeded) {
      this.persistNeeded = false;
      await this.persist();
    }
  }

  /** Read the station list when it is missing or a day old. Keeps the old one on failure. */
  async refreshNetwork({ force = false } = {}) {
    if (
      !force &&
      this.network.list.length > 0 &&
      this.now() - this.network.fetchedAt < STATIONS_MAX_AGE_MS
    ) {
      return;
    }
    try {
      const list = await fetchStations(this.deps);
      if (list.length > 0) {
        this.network = { list, fetchedAt: this.now() };
        this.persistNeeded = true;
      }
      this.issues.ok('network', 'Téléray station list read again');
    } catch (err) {
      this.issues.fail('network', `Cannot read the Téléray station list: ${err.message}`);
    }
  }

  /** The stations of the network sorted by distance to a point. */
  nearest(point, count) {
    return this.network.list
      .filter((s) => s.latitude !== null && s.longitude !== null)
      .map((s) => ({ ...s, distanceKm: distanceKm(point, s) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, count);
  }

  /** The station a typed token designates: its number, its public or technical name. */
  find(token) {
    const list = this.network.list;
    if (/^\d+$/.test(token)) {
      return list.find((s) => s.id === Number(token)) ?? null;
    }
    const wanted = normalize(token);
    // A nuclear site has a counter and a spectrometer under the same public
    // name (CHINON 1144 and 6006): the name gives the counter, the number the other.
    const exact = list
      .filter((s) => normalize(s.publicName) === wanted || normalize(s.name) === wanted)
      .sort((a, b) => Number(a.spectrometer) - Number(b.spectrometer));
    if (exact.length > 0) {
      return exact[0];
    }
    const partial = list.filter((s) => normalize(s.publicName).startsWith(wanted));
    return partial.length === 1 ? partial[0] : null;
  }

  /**
   * Resolve the followed stations from the config (or the house location).
   * @param {Array<{ latitude: number|null, longitude: number|null }>} houses
   */
  resolve(houses, config = this.getConfig()) {
    const followed = [];
    const unknown = [];
    this.noHouse = false;
    if (config.stations.length === 0) {
      const house = houses.find(
        (h) => typeof h.latitude === 'number' && typeof h.longitude === 'number',
      );
      if (house) {
        followed.push(...this.nearest(house, 1).map(({ distanceKm: _, ...station }) => station));
      } else {
        this.noHouse = true;
      }
    } else {
      for (const token of config.stations) {
        const station = this.find(token);
        if (!station) {
          unknown.push(token);
        } else if (!followed.some((s) => s.id === station.id) && followed.length < MAX_STATIONS) {
          followed.push(station);
        }
      }
    }
    this.followed = followed;
    this.unknown = unknown;
    for (const station of followed) {
      const record = this.records.get(station.id);
      if (record) {
        Object.assign(record, station);
      }
    }
    return followed;
  }

  /** The record of a followed station, created on first use. */
  recordOf(station) {
    let record = this.records.get(station.id);
    if (!record) {
      record = { ...station, measures: [], excess: null };
      this.records.set(station.id, record);
    }
    return record;
  }

  /** The followed station behind a device external id. */
  stationByDevice(externalId) {
    return this.followed.find((s) => idsOf(this.gladys, s).device === externalId) ?? null;
  }

  /** The discovery payload. */
  buildDevices(config = this.getConfig()) {
    return this.followed.map((station) => buildDevice(this.gladys, station, config.language));
  }

  /** The device of a station in Gladys, if the user added it. */
  createdDevice(station) {
    const external = idsOf(this.gladys, station).device;
    return (this.gladys.devices ?? []).find((device) => device.external_id === external);
  }

  isCreated(station) {
    return Boolean(this.createdDevice(station));
  }

  /** The name the user gave the device in Gladys, else ours. */
  nameOf(station) {
    return this.createdDevice(station)?.name || deviceName(station);
  }

  /** True when every followed station failed its last read. */
  apiDown() {
    const results = this.followed.map((s) => this.lastResults.get(s.id)).filter(Boolean);
    return results.length > 0 && results.every((r) => !r.ok);
  }

  /**
   * Read the new measurements of one station and publish what changed.
   * Throws the read error (the poller logs it).
   */
  async refresh(station) {
    const record = this.recordOf(station);
    const last = latest(record);
    const since = Math.max(last ? last.t - REVALIDATE_MS : 0, this.now() - DAY_MS);
    let incoming;
    try {
      incoming = await fetchMeasures(station.name, since, this.deps);
      this.issues.ok(`station:${station.id}`, `${deviceName(station)}: read again`);
      this.lastResults.set(station.id, { ok: true, at: this.now() });
    } catch (err) {
      this.issues.fail(`station:${station.id}`, `${deviceName(station)}: ${err.message}`);
      this.lastResults.set(station.id, { ok: false, at: this.now() });
      throw err;
    }
    const valid = incoming.filter((m) => m.t <= this.now() + FUTURE_MS);
    const { measures, added, changed } = merge(record.measures, valid);
    record.measures = measures;
    if (added > 0 || changed > 0) {
      this.persistNeeded = true;
      this.widgetChanged = true;
    }
    const status = stationStatus(record, this.now());
    if (status !== record.status) {
      this.widgetChanged = true;
      this.persistNeeded = true;
      // The first look at a station already silent is said too: once.
      if (status === STATUS.NO_RECENT) {
        this.issues.fail(
          `silent:${station.id}`,
          `${deviceName(station)}: no measurement for 2 hours`,
        );
      } else {
        this.issues.ok(`silent:${station.id}`, `${deviceName(station)}: measurements again`);
      }
      record.status = status;
    }
    this.watchExcess(record);
    try {
      await this.publishStates(station);
      this.issues.ok('gladys', 'Gladys accepts the states again');
    } catch (err) {
      this.issues.fail('gladys', `Cannot publish to Gladys: ${err.message}`);
    }
    return record;
  }

  /** Queue the threshold events of a record. */
  watchExcess(record) {
    if (!this.isCreated(record)) {
      // Not followed in Gladys: forgotten, so its first read once added is a first look.
      if (record.excess !== null) {
        record.excess = null;
        this.persistNeeded = true;
      }
      return;
    }
    const previous = record.excess;
    const margin = excessMargin(record, this.now(), previous ?? 0);
    if (margin === null || margin === previous) {
      return;
    }
    record.excess = margin;
    this.persistNeeded = true;
    if (previous === null || previous === undefined) {
      return;
    }
    const last = latest(record);
    const common = {
      device: idsOf(this.gladys, record).device,
      station_name: this.nameOf(record),
      dose_rate: last.raw,
      background: background(record),
    };
    const events = MARGINS.filter((m) => m > previous && m <= margin).map((m) => ({
      key: TRIGGER.ABOVE,
      data: {
        ...common,
        margin: String(m),
        excess: Math.round((last.raw - common.background) * 10) / 10,
        measured_at: new Date(last.t).toISOString(),
      },
    }));
    if (previous > 0 && margin === 0) {
      events.push({ key: TRIGGER.BACK, data: common });
    }
    if (events.length > 0) {
      this.pendingEvents.set(record.id, [...(this.pendingEvents.get(record.id) ?? []), ...events]);
    }
  }

  /**
   * Publish the states of a station whose device exists in Gladys. Only the
   * changes go out (the SDK deduplicates), plus a heartbeat. Then its scene
   * events.
   * @param {object} station
   * @param {{ force?: boolean }} [options] force: the device was just added
   */
  async publishStates(station, { force = false } = {}) {
    const record = this.records.get(station.id);
    if (!record || !this.isCreated(station)) {
      this.pendingEvents.delete(station.id);
      return;
    }
    const ids = idsOf(this.gladys, station);
    if (force) {
      this.gladys.forgetPublishedStates(ids.device);
    }
    const language = this.getConfig().language;
    const now = this.now();
    const last = latest(record);
    const states = [];
    const number = (key, value) => {
      if (value !== null && value !== undefined) {
        states.push({ device_feature_external_id: ids.feature(key), state: value });
      }
    };
    // A stale dose rate is not published: a value Gladys shows as recent is a
    // recent measurement. The time and the state say how old it is.
    if (isFresh(record, now)) {
      number('dose_rate', last.raw);
      number('mean_24h', mean24h(record));
      number('background', background(record));
    }
    if (last) {
      states.push({
        device_feature_external_id: ids.feature('measured_at'),
        text: formatTime(last.t, language),
      });
    }
    states.push({
      device_feature_external_id: ids.feature('status'),
      text: STATUS_TEXT[stationStatus(record, now)][language],
    });
    await this.gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });

    // An event leaves the queue once Gladys took it: a failed publication is
    // tried again on the next read.
    const events = this.pendingEvents.get(station.id) ?? [];
    while (events.length > 0) {
      const event = events[0];
      await this.gladys.publishSceneEvent(event.key, event.data);
      events.shift();
      logger.info(
        event.key === TRIGGER.ABOVE
          ? `${deviceName(record)}: ${event.data.dose_rate} nSv/h, ${event.data.margin} nSv/h above background or more`
          : `${deviceName(record)}: back to normal (${event.data.dose_rate} nSv/h)`,
      );
    }
    this.pendingEvents.delete(station.id);
  }

  /** A device deleted from Gladys: its threshold state is forgotten (a first look once added again). */
  forgetDevice(externalId) {
    const station = this.stationByDevice(externalId);
    const record = station && this.records.get(station.id);
    if (record && record.excess !== null) {
      record.excess = null;
      this.persistNeeded = true;
    }
    if (station) {
      this.pendingEvents.delete(station.id);
    }
  }

  /** Forget the records of the stations no longer followed (never without a station list). */
  prune() {
    if (this.network.list.length === 0) {
      return;
    }
    const kept = new Set(this.followed.map((s) => s.id));
    for (const id of this.records.keys()) {
      if (!kept.has(id)) {
        this.records.delete(id);
        this.persistNeeded = true;
      }
    }
  }
}
