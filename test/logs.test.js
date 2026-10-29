// -----------------------------------------------------------------------------
// Quiet logs: a normal cycle writes nothing at the info level, and a failure
// that lasts writes one line when it starts and one when it ends.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAll, createWorld } from './helpers/world.js';
import { TOULOUSE, shifted } from './helpers/network.js';

/** Capture the log lines (the SDK logger writes through console) at a level. */
function capture(t, level) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  for (const stream of ['log', 'error']) {
    t.mock.method(console, stream, (...args) => lines.push(args.join(' ')));
  }
  return lines;
}

test('a normal cycle writes nothing at the info level', async (t) => {
  const lines = capture(t, 'info');
  const w = await createWorld();
  await createAll(w);
  // Start-up says what it follows: lifecycle.
  assert.ok(
    lines.some((line) => line.includes('[INFO]') && line.includes('Following TOULOUSE (1411)')),
  );
  const before = lines.length;
  for (let i = 0; i < 12; i += 1) {
    w.advance(10 * 60_000);
    await w.app.poller.cycle();
    await w.gladys.fake.widgetGet('station_dose', { language: 'fr' });
  }
  assert.deepEqual(lines.slice(before), []);
});

test('a lasting API failure: one line when it starts, one when it ends', async (t) => {
  const lines = capture(t, 'info');
  const w = await createWorld();
  await createAll(w);
  const before = lines.length;
  w.network.measures[TOULOUSE] = { status: 503 };
  for (let i = 0; i < 6; i += 1) {
    w.advance(10 * 60_000);
    await w.app.poller.cycle();
  }
  w.network.measures[TOULOUSE] = (now) => shifted('measures-toulouse-24h', now);
  w.advance(10 * 60_000);
  await w.app.poller.cycle();
  const logged = lines.slice(before);
  assert.equal(logged.filter((line) => line.includes('HTTP 503')).length, 1, logged.join('\n'));
  assert.equal(logged.filter((line) => line.includes('TOULOUSE (Téléray): read again')).length, 1);
});
