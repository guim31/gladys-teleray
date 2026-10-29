// -----------------------------------------------------------------------------
// A simulated network: the Téléray map's API, answering with the real answers
// recorded in test/fixtures/api (29/10/2026). Tests never touch the network.
//
// The measurement fixtures carry the times of the day they were taken:
// `shifted()` moves them so the newest one is `ageMs` before "now", and the
// server filters them by `time[$gte]` as the real one does.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8');

/** API fixture by name (test/fixtures/api/<name>.json). */
export const apiFixture = (name) => JSON.parse(read(`api/${name}.json`));

/** Technical names of the stations of the measurement fixtures. */
export const TOULOUSE = 'TOULOUSE_31_AGG_CP';
export const CAYENNE = 'CAYENNE-GUYANE_973_AGG_CP';
export const TOULON = 'TOULON-ARSENAL-BSL_83_SIT_CP';

/**
 * The features of a measurement fixture, oldest first, moved so the newest is
 * `ageMs` before `now`.
 */
export function shifted(name, now, ageMs = 30 * 60_000) {
  const features = [...apiFixture(name).features].sort(
    (a, b) => Date.parse(a.time) - Date.parse(b.time),
  );
  const newest = Date.parse(features[features.length - 1].time);
  const delta = now - ageMs - newest;
  return features.map((f) => {
    const time = new Date(Date.parse(f.time) + delta).toISOString();
    return { ...f, time, properties: { ...f.properties, measurementDate: time } };
  });
}

/** A measurement feature made up from a template feature. */
export function measure(template, t, raw, label = 'VA') {
  const time = new Date(t).toISOString();
  return {
    ...template,
    time,
    properties: { ...template.properties, measurementDate: time, doseRateRaw: raw, libelle: label },
  };
}

/**
 * @param {object} [options]
 * @param {unknown} [options.stations] the station list answer, an Error, or { status }
 * @param {Record<string, unknown>} [options.measures] station name → features,
 *   a function (now) => features, an Error, or { status }
 * @param {() => number} [options.now]
 */
export function createNetwork({
  stations = apiFixture('stations'),
  measures = {},
  now = () => Date.now(),
} = {}) {
  const calls = [];
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const failure = (value) => {
    if (value instanceof Error) {
      throw value;
    }
    return value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value.status &&
      !value.type
      ? json({ name: 'GeneralError', message: 'nope' }, value.status)
      : null;
  };

  async function fetch(url, options = {}) {
    const href = new URL(String(url));
    calls.push({ url: String(url), headers: options.headers ?? {} });
    if (href.origin !== 'https://teleray.asnr.fr') {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }
    if (href.pathname === '/api/stations') {
      return failure(network.stations) ?? json(network.stations);
    }
    if (href.pathname === '/api/measures') {
      const name = href.searchParams.get('properties.name');
      const since = Date.parse(href.searchParams.get('time[$gte]'));
      const limit = Number(href.searchParams.get('$limit'));
      const route = network.measures[name] ?? [];
      const value = typeof route === 'function' ? route(now()) : route;
      const failed = failure(value);
      if (failed) {
        return failed;
      }
      const all = value.filter((f) => Date.parse(f.time) >= since);
      const features = all.slice(0, limit);
      return json({ type: 'FeatureCollection', features, total: all.length, skip: 0, limit });
    }
    return new Response('Cannot GET', { status: 404 });
  }

  const network = {
    fetch,
    calls,
    stations,
    measures,
    /** Calls for the measurements of one station. */
    measureCalls: (name) =>
      calls.filter(
        (c) =>
          c.url.includes('/measures?') &&
          new URL(c.url).searchParams.get('properties.name') === name,
      ),
    stationCalls: () => calls.filter((c) => c.url.includes('/stations?')).length,
  };
  return network;
}
