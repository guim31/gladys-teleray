// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of Gladys (en, fr,
// de, es). German says "du", Spanish "usted" (Guilhem's choice for all his
// integrations). The brands (Téléray, ASNR) are not translated.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';
import { STATUS } from './dose.js';

/** Feature names (fixed when a device is added to Gladys). No nSv/h unit in Gladys: it is in the name. */
export const NAMES = {
  en: {
    dose_rate: 'Dose rate (nSv/h)',
    mean_24h: '24 h average (nSv/h)',
    background: 'Background level (nSv/h)',
    measured_at: 'Measurement time',
    status: 'Station state',
  },
  fr: {
    dose_rate: 'Débit de dose (nSv/h)',
    mean_24h: 'Moyenne 24 h (nSv/h)',
    background: 'Bruit de fond (nSv/h)',
    measured_at: 'Heure de la mesure',
    status: 'État de la balise',
  },
  de: {
    dose_rate: 'Dosisleistung (nSv/h)',
    mean_24h: '24-h-Mittel (nSv/h)',
    background: 'Untergrund (nSv/h)',
    measured_at: 'Messzeit',
    status: 'Zustand der Sonde',
  },
  es: {
    dose_rate: 'Tasa de dosis (nSv/h)',
    mean_24h: 'Media 24 h (nSv/h)',
    background: 'Fondo natural (nSv/h)',
    measured_at: 'Hora de la medición',
    status: 'Estado de la baliza',
  },
};

/** The state of a station, as a text feature and in the widget. */
export const STATUS_TEXT = {
  [STATUS.VALIDATED]: {
    en: 'Measurement validated',
    fr: 'Mesure validée',
    de: 'Messung validiert',
    es: 'Medición validada',
  },
  [STATUS.NOT_VALIDATED]: {
    en: 'Not validated yet',
    fr: 'Pas encore validée',
    de: 'Noch nicht validiert',
    es: 'Aún no validada',
  },
  [STATUS.INVALIDATED]: {
    en: 'Measurement invalidated',
    fr: 'Mesure invalidée',
    de: 'Messung verworfen',
    es: 'Medición invalidada',
  },
  [STATUS.NO_RECENT]: {
    en: 'No recent measurement',
    fr: 'Pas de mesure récente',
    de: 'Keine aktuelle Messung',
    es: 'Sin medición reciente',
  },
};

export const TEXT = {
  notConfigured: {
    en: 'No station: set the location of a house (Settings → Houses) or type a station in the configuration.',
    fr: 'Aucune balise : renseignez la position d’une maison (Paramètres → Maisons) ou saisissez une balise dans la configuration.',
    de: 'Keine Sonde: Lege den Standort eines Hauses fest (Einstellungen → Häuser) oder gib eine Sonde in der Konfiguration ein.',
    es: 'Ninguna baliza: indique la ubicación de una casa (Ajustes → Casas) o escriba una baliza en la configuración.',
  },
  apiUnreachable: {
    en: 'The Téléray map does not answer: the measurements are read again in 10 minutes.',
    fr: 'La carte Téléray ne répond pas : les mesures seront relues dans 10 minutes.',
    de: 'Die Téléray-Karte antwortet nicht: Die Messwerte werden in 10 Minuten erneut gelesen.',
    es: 'El mapa Téléray no responde: las mediciones se volverán a leer dentro de 10 minutos.',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: 'L’initialisation a échoué, consultez les journaux de l’intégration.',
    de: 'Die Initialisierung ist fehlgeschlagen, sieh in den Protokollen der Integration nach.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  noHouse: {
    en: 'No house with a location: set it in Settings → Houses.',
    fr: 'Aucune maison située : renseignez sa position dans Paramètres → Maisons.',
    de: 'Kein Haus mit Standort: Lege ihn unter Einstellungen → Häuser fest.',
    es: 'Ninguna casa con ubicación: indíquela en Ajustes → Casas.',
  },
  noStation: {
    en: 'Add a Téléray station in Integrations → Téléray → Discovery.',
    fr: 'Ajoutez une balise Téléray dans Intégrations → Téléray → Découverte.',
    de: 'Füge eine Téléray-Sonde unter Integrationen → Téléray → Erkennung hinzu.',
    es: 'Añada una baliza Téléray en Integraciones → Téléray → Descubrimiento.',
  },
  unknownStation: {
    en: 'This station is not followed any more.',
    fr: 'Cette balise n’est plus suivie.',
    de: 'Diese Sonde wird nicht mehr verfolgt.',
    es: 'Esta baliza ya no se sigue.',
  },
  noReading: {
    en: 'No measurement read yet for this station.',
    fr: 'Aucune mesure encore lue pour cette balise.',
    de: 'Für diese Sonde wurde noch keine Messung gelesen.',
    es: 'Todavía no se ha leído ninguna medición de esta baliza.',
  },
  doseTile: { en: 'Dose rate', fr: 'Débit de dose', de: 'Dosisleistung', es: 'Tasa de dosis' },
  meanTile: { en: '24 h average', fr: 'Moyenne 24 h', de: '24-h-Mittel', es: 'Media 24 h' },
  backgroundTile: { en: 'Background', fr: 'Bruit de fond', de: 'Untergrund', es: 'Fondo natural' },
  chartTitle: {
    en: 'Last 24 hours',
    fr: '24 dernières heures',
    de: 'Letzte 24 Stunden',
    es: 'Últimas 24 horas',
  },
  backgroundMark: { en: 'Background', fr: 'Bruit de fond', de: 'Untergrund', es: 'Fondo' },
  measurement: { en: 'Measurement', fr: 'Mesure', de: 'Messung', es: 'Medición' },
  state: { en: 'State', fr: 'État', de: 'Zustand', es: 'Estado' },
  source: { en: 'Source', fr: 'Source', de: 'Quelle', es: 'Fuente' },
};

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** A time in the zone of Gladys (TZ), e.g. "29/10 11:30". */
export function formatTime(t, lang) {
  return new Intl.DateTimeFormat(LOCALES[lang] ?? LOCALES.en, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(t));
}

/** A number in the conventions of a language. */
export function formatNumber(value, lang, decimals = 0) {
  return new Intl.NumberFormat(LOCALES[lang] ?? LOCALES.en, {
    maximumFractionDigits: decimals,
  }).format(value);
}

const each = (build) => Object.fromEntries(LANGUAGES.map((lang) => [lang, build(lang)]));

export const MESSAGES = {
  /** Some typed stations match none of the network. */
  unknownStations: (tokens) =>
    each((lang) => {
      const list = tokens.join(', ');
      return {
        en: `Unknown stations: ${list}. Use the "Find the stations near a house" button.`,
        fr: `Balises inconnues : ${list}. Utilisez le bouton « Trouver les balises autour d’une maison ».`,
        de: `Unbekannte Sonden: ${list}. Nutze den Button „Sonden um ein Haus finden“.`,
        es: `Balizas desconocidas: ${list}. Use el botón «Buscar las balizas alrededor de una casa».`,
      }[lang];
    }),

  /** Result of the nearby search. */
  nearby: ({ house, stations }) =>
    each((lang) => {
      const km = (value) => `${formatNumber(value, lang, value < 10 ? 1 : 0)} km`;
      const lines = stations.map(
        (s) => `• ${s.id} — ${s.publicName} (${km(s.distanceKm)})${s.spectrometer ? ' γ' : ''}`,
      );
      const head = {
        en: `Stations closest to ${house} (number — name):`,
        fr: `Balises les plus proches de ${house} (numéro — nom) :`,
        de: `Sonden am nächsten zu ${house} (Nummer — Name):`,
        es: `Balizas más cercanas a ${house} (número — nombre):`,
      }[lang];
      const tail = {
        en: 'Type a number or a name in "Stations", or leave it empty for the closest one.',
        fr: 'Saisissez un numéro ou un nom dans « Balises », ou laissez vide pour la plus proche.',
        de: 'Gib eine Nummer oder einen Namen unter „Sonden“ ein, oder lass es leer für die nächste.',
        es: 'Escriba un número o un nombre en «Balizas», o déjelo vacío para la más cercana.',
      }[lang];
      return [head, ...lines, tail].join('\n');
    }),

  /** Sentence of the scene action. */
  summary: ({ name, dose, mean, bg, time, status }) =>
    each((lang) => {
      const n = (v) => (v === null ? '?' : formatNumber(v, lang, 0));
      const at = time === null ? '' : ` (${formatTime(time, lang)})`;
      const state = STATUS_TEXT[status][lang];
      return {
        en: `${name}: ${n(dose)} nSv/h${at}, 24 h average ${n(mean)}, background ${n(bg)} nSv/h. ${state}.`,
        fr: `${name} : ${n(dose)} nSv/h${at}, moyenne 24 h ${n(mean)}, bruit de fond ${n(bg)} nSv/h. ${state}.`,
        de: `${name}: ${n(dose)} nSv/h${at}, 24-h-Mittel ${n(mean)}, Untergrund ${n(bg)} nSv/h. ${state}.`,
        es: `${name}: ${n(dose)} nSv/h${at}, media 24 h ${n(mean)}, fondo natural ${n(bg)} nSv/h. ${state}.`,
      }[lang];
    }),

  /** A thrown error: the core shows it as is, so every language is joined. */
  thrown: (text) => LANGUAGES.map((lang) => text[lang]).join(' / '),
};
