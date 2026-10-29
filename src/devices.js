// -----------------------------------------------------------------------------
// The Gladys devices: one per followed Téléray station.
//
// External ids (forever, see CLAUDE.md):
//   device  : ext:<selector>:station:<irsnId>
//   feature : ext:<selector>:station:<irsnId>:<key>
// The irsnId is the station number of the ASNR: it survives a renamed station.
//
// Gladys has no radiation category and no nSv/h unit: the dose rates are
// `unknown/unknown` features with the unit in their name (three of them on a
// device, so the dashboard shows their names, not the generic label).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';
import { NAMES } from './i18n.js';

/** Feature keys, in display order. */
export const FEATURE_KEYS = ['dose_rate', 'mean_24h', 'background', 'measured_at', 'status'];

// min/max are display bounds (Gladys never clamps a state). Natural levels
// sit between 50 and 200 nSv/h in France; 1000 keeps a real rise on the scale.
const dose = { category: CATEGORIES.UNKNOWN, type: TYPES.UNKNOWN.UNKNOWN, min: 0, max: 1000 };
const text = { category: CATEGORIES.TEXT, type: TYPES.TEXT.TEXT, min: 0, max: 0 };

const FEATURES = {
  dose_rate: { ...dose, keep_history: true },
  mean_24h: { ...dose, keep_history: true },
  background: { ...dose, keep_history: true },
  // Texts: their history would only repeat what the dose rates already date.
  measured_at: { ...text, keep_history: false },
  status: { ...text, keep_history: false },
};

/**
 * The external ids of the device of a station.
 * @param {object} gladys
 * @param {{ id: number }} station
 */
export function idsOf(gladys, station) {
  return gladys.externalIds('station', String(station.id));
}

/**
 * The device name: the public name of the station, and the network. A gamma
 * spectrometer shares its public name with the counter of the same site.
 */
export function deviceName(station) {
  return `${station.publicName}${station.spectrometer ? ' γ' : ''} (Téléray)`;
}

/**
 * The discovery payload of one station.
 * @param {object} gladys
 * @param {object} station
 * @param {string} language language of the feature names
 */
export function buildDevice(gladys, station, language) {
  const names = NAMES[language] ?? NAMES.fr;
  const ids = idsOf(gladys, station);
  return {
    name: deviceName(station),
    external_id: ids.device,
    model: station.spectrometer ? 'Téléray γ spectrometer' : 'Téléray',
    // The container reads the stations itself every 10 minutes (src/poller.js):
    // no core polling.
    should_poll: false,
    features: FEATURE_KEYS.map((key) => ({
      name: names[key],
      external_id: ids.feature(key),
      ...FEATURES[key],
      read_only: true,
      has_feedback: false,
    })),
    params: [
      { name: 'station_number', value: String(station.id) },
      { name: 'station_name', value: station.name },
    ],
  };
}
