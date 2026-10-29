// -----------------------------------------------------------------------------
// The button of the Configuration screen (manifest `actions`):
//
//   find_nearby : the stations closest to a house of Gladys (its location,
//                 `location: true` in the manifest), with their number and
//                 distance — to pick the ones to follow.
// -----------------------------------------------------------------------------

import { MESSAGES, TEXT } from './i18n.js';

export const ACTION = { FIND_NEARBY: 'find_nearby' };

/** The search lists this many stations (the message stays readable). */
const LISTED = 8;

/**
 * @param {object} gladys
 * @param {import('./hub.js').Hub} hub
 * @param {{ house?: string }} fields
 */
export async function findNearby(gladys, hub, fields) {
  const houses = (await gladys.getHouses()).filter(
    (house) => typeof house.latitude === 'number' && typeof house.longitude === 'number',
  );
  const house = fields.house ? houses.find((h) => h.selector === fields.house) : houses[0];
  if (!house) {
    throw new Error(MESSAGES.thrown(TEXT.noHouse));
  }
  await hub.refreshNetwork();
  if (hub.network.list.length === 0) {
    throw new Error(MESSAGES.thrown(TEXT.apiUnreachable));
  }
  await hub.save();
  return MESSAGES.nearby({ house: house.name, stations: hub.nearest(house, LISTED) });
}
