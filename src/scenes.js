// -----------------------------------------------------------------------------
// Scene action "Get the dose rate of a station" (Gladys 5.1+).
//
// Gives a scene the last measurement of a station as outputs a notification
// can quote: "{{...summary}}" reads "TOULOUSE (Téléray): 102 nSv/h
// (29/10 11:30), 24 h average 98, background 95 nSv/h. Measurement
// validated.". The devices already give each value to the scene conditions;
// what this action adds is a ready-made sentence in the configured language.
//
// The triggers are fired by the hub (src/hub.js).
// -----------------------------------------------------------------------------

import { MESSAGES, TEXT } from './i18n.js';
import { background, isFresh, latest, mean24h, stationStatus } from './dose.js';

export const GET_DOSE_RATE = 'get_dose_rate';

/**
 * @param {import('./hub.js').Hub} hub
 * @param {{ station?: string }} fields
 * @param {string} language
 */
export function getDoseRate(hub, fields, language) {
  const station = fields.station ? hub.stationByDevice(fields.station) : null;
  if (!station) {
    throw new Error(MESSAGES.thrown(TEXT.unknownStation));
  }
  const record = hub.records.get(station.id);
  const last = latest(record);
  if (!last) {
    throw new Error(MESSAGES.thrown(TEXT.noReading));
  }
  const now = hub.now();
  const fresh = isFresh(record, now);
  const values = {
    dose: fresh ? last.raw : null,
    mean: fresh ? mean24h(record) : null,
    bg: background(record),
  };
  const status = stationStatus(record, now);
  const outputs = {
    summary: MESSAGES.summary({ name: hub.nameOf(station), ...values, time: last.t, status })[
      language
    ],
    measured_at: new Date(last.t).toISOString(),
    status,
  };
  if (values.dose !== null) {
    outputs.dose_rate = values.dose;
  }
  if (values.mean !== null) {
    outputs.mean_24h = values.mean;
  }
  if (values.bg !== null) {
    outputs.background = values.bg;
  }
  return outputs;
}
