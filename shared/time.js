/**
 * Normalize a pickup time to the 24-hour HH:mm format used by HTML time inputs,
 * fare signatures, and the booking API.
 */
export function normalizePickupTime(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input) return null;
  const twentyFourHour = input.match(/^(?:([01]?\d|2[0-3])):([0-5]\d)(?::[0-5]\d)?$/);
  if (twentyFourHour) return String(Number(twentyFourHour[1])).padStart(2, '0') + ':' + twentyFourHour[2];
  const twelveHour = input.match(/^(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)$/i);
  if (!twelveHour) return null;
  let hour = Number(twelveHour[1]) % 12;
  if (twelveHour[3].toUpperCase() === 'PM') hour += 12;
  return String(hour).padStart(2, '0') + ':' + twelveHour[2];
}

export function parseSpokenPickupTime(value, { expectTime = false } = {}) {
  if (typeof value !== 'string' || !value.trim()) return { mentioned: false, ambiguous: false, time: null };
  const input = value.replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
    .toLocaleLowerCase('en-IN').replace(/a\.?m\.?/g, 'am').replace(/p\.?m\.?/g, 'pm');
  const amWords = /\b(?:morning|subah|savere|savera)\b|सुबह|सवेरे/.test(input);
  const pmWords = /\b(?:afternoon|evening|shaam|sham|raat|night|dopahar)\b|दोपहर|शाम|रात/.test(input);
  const hasMeridiem = /\b(?:am|pm)\b/.test(input);
  const timeCue = /\b(?:at|around|by|ko|baje|o'clock)\b|बजे/.test(input);

  const convert = (hourValue, minuteValue, meridiem) => {
    let hour = Number(hourValue);
    const minute = Number(minuteValue || 0);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
    if (meridiem) {
      if (hour < 1 || hour > 12) return null;
      hour = hour % 12 + (meridiem === 'pm' ? 12 : 0);
    } else if (amWords || pmWords) {
      if (hour < 1 || hour > 12) return null;
      hour = hour % 12 + (pmWords ? 12 : 0);
    } else if (hour < 13 || hour > 23) {
      return null;
    }
    return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  };

  const explicit = input.match(/\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/);
  if (explicit) {
    const time = convert(explicit[1], explicit[2], explicit[3]);
    return { mentioned: true, ambiguous: !time, time };
  }

  const clock = input.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (clock && !amWords && !pmWords) {
    return { mentioned: true, ambiguous: false, time: convert(clock[1], clock[2], null) };
  }

  if (amWords || pmWords) {
    const dayPartMatch = input.match(/(?:morning|subah|savere|savera|afternoon|evening|shaam|sham|raat|night|dopahar|सुबह|सवेरे|दोपहर|शाम|रात)[^0-9]{0,16}(\d{1,2})(?::([0-5]\d))?/i)
      || input.match(/(\d{1,2})(?::([0-5]\d))?[^0-9]{0,16}(?:morning|subah|savere|savera|afternoon|evening|shaam|sham|raat|night|dopahar|सुबह|सवेरे|दोपहर|शाम|रात)/i);
    if (dayPartMatch) {
      const time = convert(dayPartMatch[1], dayPartMatch[2], null);
      return { mentioned: true, ambiguous: !time, time };
    }
    return { mentioned: false, ambiguous: false, time: null };
  }

  if (expectTime) {
    const bare = input.match(/(?:^|\s)(\d{1,2})(?::([0-5]\d))?(?:\s*(?:baje|बजे))?(?:$|\s)/);
    if (bare) {
      const hour = Number(bare[1]);
      const minute = Number(bare[2] || 0);
      if (hour >= 1 && hour <= 12) return { mentioned: true, ambiguous: true, time: null };
      if (hour >= 13 && hour <= 23) return { mentioned: true, ambiguous: false, time: convert(hour, minute, null) };
    }
  }
  if (hasMeridiem || timeCue) return { mentioned: true, ambiguous: true, time: null };
  return { mentioned: false, ambiguous: false, time: null };
}
