import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePickupTime } from '../shared/time.js';

test('normalizes browser 24-hour time values', () => {
  assert.equal(normalizePickupTime('08:00'), '08:00');
  assert.equal(normalizePickupTime('8:05'), '08:05');
  assert.equal(normalizePickupTime('23:59'), '23:59');
});

test('normalizes 12-hour display and voice values', () => {
  assert.equal(normalizePickupTime('08:00 AM'), '08:00');
  assert.equal(normalizePickupTime('8:05 am'), '08:05');
  assert.equal(normalizePickupTime('12:00 AM'), '00:00');
  assert.equal(normalizePickupTime('12:00 PM'), '12:00');
  assert.equal(normalizePickupTime('01:30 PM'), '13:30');
});

test('rejects missing and malformed times', () => {
  for (const value of ['', ' ', '25:00', '13:70', '08:00 XM', '00:00 PM', null, 800]) {
    assert.equal(normalizePickupTime(value), null, String(value));
  }
});
