/** @param {string} [value] */
export function isDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const formats = {
  /** @param {string} value */
  'trip-date': value => value === '' || isDate(value),
  /** @param {string} value */
  'trip-datetime': value => /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(?:\.\d+)?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)?$/.test(value) && isDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value)),
  /** @param {string} value */
  'trip-url': value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } },
  /** @param {string} value */
  'trip-image': value => {
    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true;
    if (!value.startsWith('https://')) return false;
    try { const url = new URL(value); return !url.username && !url.password; } catch { return false; }
  },
};
