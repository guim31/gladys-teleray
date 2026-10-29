// -----------------------------------------------------------------------------
// What the measurements of a station say: the current dose rate, the mean of
// the last 24 hours, the background level, the state of the measurement, and
// how far the dose rate stands above the background.
//
// Pure functions of a record and a clock: the hub, the widget and the scene
// action read the same answers.
//
// Validity (field `libelle` of the API, colours of the ASNR map):
//   VA, VM   validated (automatically, manually)
//   NV, NVM  not validated yet
//   NVA      invalidated: kept on the chart, left out of the mean and of the
//            threshold trigger
// A station whose last measurement is older than 2 hours is shown "no recent
// measurement" by the ASNR map: same rule here.
// -----------------------------------------------------------------------------

/** Past this age, the last measurement is not current any more (ASNR map: 2 h). */
export const STALE_MS = 2 * 60 * 60 * 1000;

/** The window of the mean and of the chart. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The margins above the background offered by the "Dose rate above background"
 * trigger, in nSv/h. 40 is the rule of the ASNR map, which marks a station red
 * when its dose rate reaches its background + 40 nSv/h.
 */
export const MARGINS = [20, 40, 100, 200];

/** A margin stays exceeded until the dose rate falls this far below it (nSv/h). */
export const HYSTERESIS = 10;

export const STATUS = {
  VALIDATED: 'validated',
  NOT_VALIDATED: 'not_validated',
  INVALIDATED: 'invalidated',
  NO_RECENT: 'no_recent',
};

/** The state of one measurement, from its validity code. */
export function validity(label) {
  if (label === 'VA' || label === 'VM') {
    return STATUS.VALIDATED;
  }
  if (label === 'NVA') {
    return STATUS.INVALIDATED;
  }
  return STATUS.NOT_VALIDATED;
}

/** The newest measurement of a record, or null. */
export function latest(record) {
  const measures = record?.measures ?? [];
  return measures.length > 0 ? measures[measures.length - 1] : null;
}

/** True when the newest measurement is recent enough to be current. */
export function isFresh(record, now) {
  const last = latest(record);
  return Boolean(last) && now - last.t <= STALE_MS;
}

/** The state shown for a station. */
export function stationStatus(record, now) {
  if (!isFresh(record, now)) {
    return STATUS.NO_RECENT;
  }
  return validity(latest(record).label);
}

/** The mean of the valid measurements of the 24 hours before the newest one, or null. */
export function mean24h(record) {
  const last = latest(record);
  if (!last) {
    return null;
  }
  const values = record.measures
    .filter((m) => m.t > last.t - DAY_MS && validity(m.label) !== STATUS.INVALIDATED)
    .map((m) => m.raw);
  if (values.length === 0) {
    return null;
  }
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

/** The background of the newest measurement that has one, or null. */
export function background(record) {
  const measures = record?.measures ?? [];
  for (let i = measures.length - 1; i >= 0; i -= 1) {
    if (measures[i].background !== null) {
      return measures[i].background;
    }
  }
  return null;
}

/**
 * The highest margin the dose rate stands above, given the one reached so far
 * (hysteresis on the way down). 0 when none; null when the newest measurement
 * cannot tell (stale, invalidated, no background): the previous state holds.
 * @param {object} record
 * @param {number} now
 * @param {number} previous the margin reached before (0 when none)
 */
export function excessMargin(record, now, previous = 0) {
  const last = latest(record);
  const bg = background(record);
  if (!isFresh(record, now) || validity(last.label) === STATUS.INVALIDATED || bg === null) {
    return null;
  }
  const above = last.raw - bg;
  let reached = 0;
  for (const margin of MARGINS) {
    const keep = margin <= previous ? margin - HYSTERESIS : margin;
    if (above >= keep) {
      reached = margin;
    }
  }
  return reached;
}

/** Keep the measurements of the last 24 hours before the newest one (plus margin). */
export function trim(measures) {
  if (measures.length === 0) {
    return measures;
  }
  const newest = measures[measures.length - 1].t;
  return measures.filter((m) => m.t > newest - DAY_MS - 10 * 60_000);
}

/**
 * Merge measurements into a sorted list (by time, one per time). A known time
 * is replaced: the ASNR validates (or invalidates) a measurement afterwards.
 * @returns {{ measures: Array, added: number, changed: number }}
 */
export function merge(measures, incoming) {
  const byTime = new Map(measures.map((m) => [m.t, m]));
  let added = 0;
  let changed = 0;
  for (const m of incoming) {
    const known = byTime.get(m.t);
    if (!known) {
      added += 1;
    } else if (
      known.raw !== m.raw ||
      known.label !== m.label ||
      known.background !== m.background
    ) {
      changed += 1;
    }
    byTime.set(m.t, m);
  }
  const sorted = [...byTime.values()].sort((a, b) => a.t - b.t);
  return { measures: trim(sorted), added, changed };
}
