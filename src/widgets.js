// -----------------------------------------------------------------------------
// The "Téléray dose rate" dashboard widget (Gladys 5.2+).
//
// Three tiles (dose rate, 24 h average, background, in nSv/h: the unit Gladys
// lacks for a device-bound tile), the curve of the last 24 hours with the
// background, and the time and state of the measurement. Chart and state rows
// each have a setting to hide them.
//
// The content is built from what the integration already read: showing the
// widget never calls the API. The core caches it per (settings, language,
// units), so the texts are localized in the language it asks for; the hub
// asks for a refresh when a new measurement arrives.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import {
  STATUS,
  background,
  excessMargin,
  isFresh,
  latest,
  mean24h,
  stationStatus,
} from './dose.js';
import { STATUS_TEXT, TEXT, formatTime } from './i18n.js';

export const WIDGET_KEY = 'station_dose';

/** Seconds the core keeps a content: a measurement every 10 minutes. */
const TTL_SECONDS = 300;

const UNIT = 'nSv/h';

const STATUS_COLOR = {
  [STATUS.VALIDATED]: WIDGET_COLORS.SUCCESS,
  [STATUS.NOT_VALIDATED]: WIDGET_COLORS.WARNING,
  [STATUS.INVALIDATED]: WIDGET_COLORS.DANGER,
  [STATUS.NO_RECENT]: WIDGET_COLORS.NEUTRAL,
};

/** Settings are booleans, or strings from older forms. */
const shown = (value) => value !== false && value !== 'false';

const message = (text) => ({ ttl_seconds: TTL_SECONDS, components: [{ type: 'text', text }] });

/**
 * The widget content.
 * @param {object} options
 * @param {import('./hub.js').Hub} options.hub
 * @param {{ station?: string, show_chart?: boolean, show_status?: boolean }} [options.settings]
 * @param {string} [options.language]
 */
export function buildStationContent({ hub, settings = {}, language = 'en' }) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const created = hub.followed.filter((s) => hub.isCreated(s));
  const station = settings.station ? hub.stationByDevice(settings.station) : created[0];
  if (!station) {
    return message((settings.station ? TEXT.unknownStation : TEXT.noStation)[lang]);
  }
  const record = hub.records.get(station.id);
  const last = latest(record);
  if (!last) {
    return message(TEXT.noReading[lang]);
  }
  const now = hub.now();
  const fresh = isFresh(record, now);
  const bg = background(record);
  const margin = excessMargin(record, now) ?? 0;
  const doseColor =
    margin >= 40
      ? WIDGET_COLORS.DANGER
      : margin >= 20
        ? WIDGET_COLORS.WARNING
        : WIDGET_COLORS.PRIMARY;
  const tile = (label, value, color) => ({
    type: 'value',
    label: label[lang],
    value: value === null ? '—' : Math.round(value),
    unit: value === null ? undefined : UNIT,
    ...(color ? { color } : {}),
  });

  const components = [
    { type: 'text', variant: 'heading', text: hub.nameOf(station).slice(0, 40) },
    tile(TEXT.doseTile, fresh ? last.raw : null, fresh ? doseColor : WIDGET_COLORS.NEUTRAL),
    tile(TEXT.meanTile, fresh ? mean24h(record) : null),
    tile(TEXT.backgroundTile, bg),
  ];
  if (shown(settings.show_chart) && record.measures.length > 1) {
    const iso = (t) => new Date(t).toISOString();
    const series = [
      {
        name: TEXT.doseTile[lang],
        points: record.measures.map((m) => ({ t: iso(m.t), v: m.raw })),
      },
    ];
    const withBg = record.measures.filter((m) => m.background !== null);
    if (withBg.length > 1) {
      series.push({
        name: TEXT.backgroundMark[lang],
        points: withBg.map((m) => ({ t: iso(m.t), v: m.background })),
      });
    }
    components.push({
      type: 'chart',
      chart_type: 'line',
      title: TEXT.chartTitle[lang],
      unit: UNIT,
      series,
    });
  }
  if (shown(settings.show_status)) {
    const status = stationStatus(record, now);
    components.push({
      type: 'status',
      items: [
        { label: TEXT.measurement[lang], value: formatTime(last.t, lang), icon: 'clock' },
        { label: TEXT.state[lang], value: STATUS_TEXT[status][lang], color: STATUS_COLOR[status] },
        { label: TEXT.source[lang], value: 'ASNR — Téléray', icon: 'info' },
      ],
    });
  }
  return { ttl_seconds: TTL_SECONDS, components };
}
