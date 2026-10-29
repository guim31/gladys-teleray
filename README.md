# Téléray for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration that brings the **ambient gamma dose rate** of the
**Téléray** stations of the ASNR (the French nuclear safety and radiation protection authority, formerly IRSN) into
Gladys: about 480 stations in France, its overseas territories and some embassies, one measurement every 10 minutes.

## What it does

- One device per followed station: dose rate, 24-hour average and background level (nSv/h), time of the
  measurement, and state of the station (validated, not validated yet, invalidated, no recent measurement).
- The station closest to your house by default, or up to 5 stations typed by number or name; a button lists the
  stations near a house.
- Scene triggers **Dose rate above background** (margin +20, +40, +100 or +200 nSv/h; +40 is the threshold of the
  ASNR map) and **Dose rate back to normal**, and a scene action **Get the dose rate of a station**.
- A dashboard widget with the values, the 24-hour curve and the background.
- English, French, German and Spanish.

**Not an official alert system.** Natural levels vary (rain can add 20 to 50 nSv/h for a few hours). In an
emergency, follow the instructions of the authorities.

## Requirements

- Gladys Assistant 5.3.0 or later, with Internet access.
- The location of a house in Gladys (Settings → Houses), or the number of a station.

## Installation

In Gladys: **Integrations → Install from GitHub**, address `https://github.com/guim31/gladys-teleray`. Then open the
integration, leave **Stations** empty (closest station) or type station numbers or names, and add the station from the
**Discovery** tab. User documentation: [English](docs/en.md), [français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md).

## Respect of the service

There is no open-data feed of the Téléray measurements: the integration reads the backend of the public map
[teleray.asnr.fr](https://teleray.asnr.fr), with no account, as the map itself does. It sends one request per followed
station every 10 minutes (only the measurements it does not have yet), the station list once a day, and names itself
in the `User-Agent`. The data are public information of the ASNR, a French public body, reused with their source:
**Data © ASNR – Téléray network**.

## Limits

- The map backend has no published API contract: it may change without notice.
- Measurements reach the map 20 to 40 minutes after they are taken.
- 5 stations at most. Gladys has no radiation unit: the unit is in the feature names.
- Developed against the recorded answers of the real map (29/10/2026), without a Gladys instance: feedback welcome.

## Development

```bash
npm install
npm test                 # node --test, never touches the network
npm run lint
npm run format:check
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

See [CLAUDE.md](CLAUDE.md) for the architecture and the pitfalls of the Gladys core. Versions and releases are made
by the Release workflow.

## Credits

- Measurements: [Téléray network](https://teleray.asnr.fr) of the
  [ASNR](https://www.asnr.fr) (Autorité de sûreté nucléaire et de radioprotection).
- Cover: the ASNR logo, from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:ASNR_LOGO_CLASSIQUE_BLEU_FONDCLAIR_RVB.svg) (© ASNR).
- Started from the official [integration template](https://github.com/GladysAssistant/integration-template-js) and
  [SDK](https://github.com/GladysAssistant/integration-sdk-js) of Gladys Assistant.

This integration is not affiliated with, nor endorsed by, the ASNR.

## License

[Apache-2.0](LICENSE)
