/**
 * Normalize a pickup time to the 24-hour HH:mm format used by HTML time inputs,
 * fare signatures, and the booking API. Accept localized 12-hour display strings
 * as a defensive compatibility layer for browsers, voice input, and older clients.
 */
export function normalizePickupTime(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input) return null;

  const twentyFourHour = input.match(/^(?:([01]?\\d|2[0-3])):([0-5]\\d)(?::[0-5]\\d)?$/);
  if (twentyFourHour) return `${String(Number(twentyFourHour[1])).padStart(2, '0')}:${twentyFourHour[2]}`;

  const twelveHour = input.match(/^(1[0-2]|0?[1-9]):([0-5]\\d)\\s*(AM|PM)$/i);
  if (!twelveHour) return null;
  let hour = Number(twelveHour[1]) % 12;
  if (twelveHour[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${twelveHour[2]}`;
}
