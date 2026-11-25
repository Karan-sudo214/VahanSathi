import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePickupTime, parseSpokenPickupTime } from '../shared/time.js';

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

test('parses explicit AM/PM and noon/midnight correctly', () => {
  assert.equal(parseSpokenPickupTime('at 7 AM').time, '07:00');
  assert.equal(parseSpokenPickupTime('7:45 p.m.').time, '19:45');
  assert.equal(parseSpokenPickupTime('12 AM').time, '00:00');
  assert.equal(parseSpokenPickupTime('12 PM').time, '12:00');
  assert.equal(parseSpokenPickupTime('5:30 pm').time, '17:30');
});

test('parses day-parts before and after the hour in Hindi and Hinglish', () => {
  assert.equal(parseSpokenPickupTime('shaam 5 baje').time, '17:00');
  assert.equal(parseSpokenPickupTime('5 baje shaam ko').time, '17:00');
  assert.equal(parseSpokenPickupTime('subah 7 baje').time, '07:00');
  assert.equal(parseSpokenPickupTime('7 in the morning').time, '07:00');
  assert.equal(parseSpokenPickupTime('1 in the afternoon').time, '13:00');
  assert.equal(parseSpokenPickupTime('दोपहर २ बजे').time, '14:00');
  assert.equal(parseSpokenPickupTime('रात ९ बजे').time, '21:00');
});

test('keeps ambiguous 12-hour answers unconfirmed', () => {
  assert.equal(parseSpokenPickupTime('5', { expectTime: true }).ambiguous, true);
  assert.equal(parseSpokenPickupTime('5', { expectTime: true }).time, null);
  assert.equal(parseSpokenPickupTime('17', { expectTime: true }).time, '17:00');
  assert.equal(parseSpokenPickupTime('17:30').time, '17:30');
  assert.equal(parseSpokenPickupTime('from India Gate to CP').mentioned, false);
});
