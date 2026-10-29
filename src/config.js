// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. This module provides the
// defaults and normalizes the received object, so the rest of the code never
// deals with `undefined`, strings typed with spaces, or invalid values.
// -----------------------------------------------------------------------------

/** The languages of the Gladys interface, the ones every text carries. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** At most this many stations are followed: one request each per cycle. */
export const MAX_STATIONS = 5;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  stations: '', // station numbers or names; empty: the one closest to the house
  language: 'fr', // language of the feature names and of the generated texts
};

/**
 * Merge the user config with the defaults and normalize every value.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const tokens = parseStations(raw.stations ?? DEFAULT_CONFIG.stations);
  const language = String(raw.language ?? DEFAULT_CONFIG.language).trim();
  return {
    stations: tokens,
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}

/**
 * Split the typed list of stations: commas and semicolons separate them (a
 * name may hold spaces). Duplicates dropped (case-insensitive), order kept.
 * @param {unknown} text
 * @returns {string[]}
 */
export function parseStations(text) {
  const result = [];
  for (const token of String(text).split(/[,;\n]+/)) {
    const clean = token.trim();
    if (clean !== '' && !result.some((known) => known.toLowerCase() === clean.toLowerCase())) {
      result.push(clean);
    }
  }
  return result;
}
