# Téléray

## What it does

Brings into Gladys the **ambient gamma dose rate** measured by the stations of the **Téléray** network of the ASNR
(the French nuclear safety and radiation protection authority, formerly IRSN): about 480 stations in France, its
overseas territories and some embassies, one measurement every 10 minutes. The integration reads the public Téléray
map ([teleray.asnr.fr](https://teleray.asnr.fr)), with no account.

For each followed station you get the dose rate, its 24-hour average, the background level of the station, the time
of the measurement and its state, a dashboard widget with the 24-hour curve, and scene triggers when the dose rate
rises above the background.

**This integration is not an official alert system**: in an emergency, follow the instructions of the authorities.
Natural levels vary: rain washes radon decay products to the ground and can add 20 to 50 nSv/h for a few hours. The
integration is not affiliated with the ASNR. Data © ASNR.

## Requirements

- Gladys 5.3.0 or later.
- Internet access from Gladys.
- The location of your house (Settings → Houses), to follow the closest station automatically.

## Configuration

1. Install the integration: Integrations → Install from GitHub, address `https://github.com/guim31/gladys-teleray`.
2. **Stations**: leave it empty to follow the station closest to your house, or type up to 5 station numbers or names
   separated by commas (e.g. `1411, PARIS-BERCY`). The **Find the stations near a house** button lists the closest
   ones with their number and distance.
3. **Language**: language of the feature names (set when a device is added) and of the texts.
4. Open the **Discovery** tab and add the station.

## Devices

One device per station, named after it (e.g. `TOULOUSE (Téléray)`):

| Feature                  | What it is                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Dose rate (nSv/h)        | ambient gamma dose rate of the last measurement, in nanosieverts per hour                   |
| 24 h average (nSv/h)     | average of the valid measurements of the last 24 hours                                      |
| Background level (nSv/h) | the usual level of the station, as computed by the ASNR                                     |
| Measurement time         | time of the last measurement (the map publishes it 20 to 40 minutes later)                  |
| Station state            | Measurement validated, Not validated yet, Measurement invalidated, or No recent measurement |

Gladys has no radiation unit: the unit is in the feature names. A measurement older than 2 hours is not published as
current (the state then says "No recent measurement"), as on the ASNR map.

## Widget

**Téléray dose rate**: the dose rate, the 24-hour average and the background as tiles, the curve of the last 24 hours
with the background, and the time, state and source of the measurement. Settings: the station (empty: the first one
added), and two switches to hide the curve or the time and state.

## Scenes

- Trigger **Dose rate above background**: a validated or pending measurement exceeds the background of the station by
  the chosen margin (+20, +40, +100 or +200 nSv/h). Fired once when the margin is crossed; the margin stays reached
  until the dose rate falls 10 nSv/h below it. +40 nSv/h is the threshold of the ASNR map. Variables: station name,
  dose rate, background, excess, measurement time.
- Trigger **Dose rate back to normal**: after an exceedance, the dose rate is less than 20 nSv/h above the background
  again.
- Action **Get the dose rate of a station**: the last values and a ready-made sentence (`summary`) for a
  notification.

The devices also give their values to the usual scene conditions.

## Scene examples

- Notify me when the dose rate is 40 nSv/h above the background: trigger "Dose rate above background", margin
  +40 nSv/h, then "Get the dose rate of a station" and a notification with its summary.
- A weekly report: a scheduled scene, "Get the dose rate of a station", then a message with the summary.

## Troubleshooting

- **"No station"**: set the location of a house (Settings → Houses) or type a station in the configuration.
- **"Unknown stations"**: the number or the name was not found; use the search button and copy the number.
- **"The Téléray map does not answer"**: the measurements are read again every 10 minutes.
- **"No recent measurement"**: the station has published nothing for 2 hours (maintenance, transmission). The values
  come back with its next measurement.

## Limits

- The integration reads the backend of the public Téléray map, which has no published API contract: it may change
  without notice.
- Measurements arrive 20 to 40 minutes after they are taken; one request per station every 10 minutes, the station
  list once a day.
- 5 stations at most.
- A device's feature names are set when it is added; changing the language afterwards does not rename them.
