/**
 * The calendar date on this device as "yyyy-MM-dd".
 * Don't use toISOString() for this: it gives the UTC date, which in India is
 * still yesterday between midnight and 5:30 AM.
 */
export const localDate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A time from the server (UTC, sometimes written without the trailing "Z") */
export const utcDate = (s: string): Date =>
  new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(s) ? s : `${s}Z`);
