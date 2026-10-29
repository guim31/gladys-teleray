// -----------------------------------------------------------------------------
// Client of the public Téléray map (https://teleray.asnr.fr), no account, no key.
//
// The map of the ASNR (French nuclear safety and radiation protection
// authority) reads its data from its own Feathers API, the same answers for
// every visitor:
//
//   GET /api/stations?$limit=1000
//       every station: GeoJSON point, irsnId (the station number), name (the
//       technical name, e.g. TOULOUSE_31_AGG_CP), publicName (TOULOUSE), type
//       (Compteur_Proportionnel or Spectrometre_Gamma), strategie.
//   GET /api/measures?properties.name=<name>&time[$gte]=<ISO>&$sort[time]=1&$limit=200
//       the measurements of one station since a date, one every 10 minutes:
//       doseRateRaw (nSv/h, ambient gamma dose rate), bruitdefond (the
//       station's background level, nSv/h), libelle (VA/VM validated, NV/NVM
//       not validated yet, NVA invalidated), time.
//
// The query string is not typed by the server: a filter on the numeric
// irsnId never matches, hence the filter on the station name.
//
// Load: one request per followed station every 10 minutes (a few hundred
// bytes once the last 24 hours are known), the station list once a day.
// There is no published API contract: this is the map's own backend, it can
// change without notice. Data © ASNR, cited as the source.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const API_BASE_URL = 'https://teleray.asnr.fr/api';
const TIMEOUT_MS = 20_000;

/** The most measurements one request asks for (24 h at one every 10 min: 144). */
const PAGE = 200;

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Identifies the integration to the operators. */
export const USER_AGENT = `gladys-teleray/${version} (+https://github.com/guim31/gladys-teleray)`;

/** An error of the API (status 0: network). */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * GET a JSON document from the API.
 * @param {string} path e.g. "/stations?$limit=1000"
 * @param {{ fetch?: typeof fetch }} [deps]
 */
async function getJson(path, { fetch = globalThis.fetch } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code ?? err.message);
    throw new ApiError(`Téléray unreachable (${reason})`, 0);
  }
  if (!response.ok) {
    throw new ApiError(`Téléray answered HTTP ${response.status}`, response.status);
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError('Téléray answered something that is not JSON', response.status);
  }
  if (!body || !Array.isArray(body.features)) {
    throw new ApiError('Téléray answered an unexpected document', response.status);
  }
  return body;
}

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * A station of the API, or null when it lacks what the integration needs.
 * @param {any} feature
 */
export function parseStation(feature) {
  const p = feature?.properties ?? {};
  // Some stations carry their point as an object { "0": lon, "1": lat } (BASTIA, MENDE...).
  const point = feature?.geometry?.coordinates;
  const lon = point?.[0];
  const lat = point?.[1];
  if (!Number.isInteger(p.irsnId) || typeof p.name !== 'string' || p.name === '') {
    return null;
  }
  return {
    id: p.irsnId,
    name: p.name,
    publicName: typeof p.publicName === 'string' && p.publicName ? p.publicName : p.name,
    latitude: finite(lat),
    longitude: finite(lon),
    spectrometer: p.type === 'Spectrometre_Gamma',
  };
}

/**
 * A measurement of the API, or null when it carries no dose rate.
 * @param {any} feature
 * @returns {{ t: number, raw: number, background: number | null, label: string } | null}
 */
export function parseMeasure(feature) {
  const p = feature?.properties ?? {};
  const t = Date.parse(feature?.time ?? p.measurementDate ?? '');
  const raw = finite(p.doseRateRaw);
  if (!Number.isFinite(t) || raw === null || raw < 0) {
    return null;
  }
  const background = finite(p.bruitdefond);
  return {
    t,
    raw,
    background: background === null ? null : Math.round(background * 10) / 10,
    label: typeof p.libelle === 'string' ? p.libelle : '',
  };
}

/** Every station of the network. */
export async function fetchStations(deps) {
  const body = await getJson('/stations?$limit=1000', deps);
  return body.features.map(parseStation).filter(Boolean);
}

/**
 * The measurements of one station since a date, oldest first.
 * @param {string} name the station's technical name
 * @param {number} since epoch ms
 */
export async function fetchMeasures(name, since, deps) {
  const query = new URLSearchParams({
    'properties.name': name,
    'time[$gte]': new Date(since).toISOString(),
    '$sort[time]': '1',
    $limit: String(PAGE),
  });
  const body = await getJson(`/measures?${query}`, deps);
  return body.features
    .map(parseMeasure)
    .filter(Boolean)
    .sort((a, b) => a.t - b.t);
}

/** Great-circle distance in km. */
export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
