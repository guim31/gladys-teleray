# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- One device per Téléray station of the ASNR: ambient gamma dose rate, 24-hour
  average and background level (nSv/h), time of the measurement and state of
  the station (validated, not validated yet, invalidated, no recent
  measurement), read every 10 minutes from the public Téléray map, no account.
- The station closest to the house by default, or up to 5 stations typed by
  number or name, and a button listing the stations near a house.
- Scene triggers "Dose rate above background" (margin +20, +40, +100 or
  +200 nSv/h, once per crossing) and "Dose rate back to normal".
- Scene action "Get the dose rate of a station", with a sentence ready for a
  notification.
- Dashboard widget "Téléray dose rate": tiles, 24-hour curve with the
  background, time and state of the measurement.
- Feature names and texts in English, French, German and Spanish.
