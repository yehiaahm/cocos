/**
 * SQL fragments shared by the queries (MySQL).
 * Timestamps are stored as ISO-8601 UTC text ("2026-11-17T19:03:20.749Z"), so they sort and compare as plain strings.
 */
export const NOW_SQL = "CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')";

/** The same format, `n` units in the past. `n` is spliced into the SQL, so it must be a whole number. */
export function agoSql(n: number, unit: 'MINUTE' | 'HOUR' | 'DAY'): string {
  if (!Number.isInteger(n) || n < 0) throw new Error('agoSql: n must be a non-negative integer');
  return `CONCAT(SUBSTRING(DATE_FORMAT(UTC_TIMESTAMP(3) - INTERVAL ${n} ${unit}, '%Y-%m-%dT%H:%i:%s.%f'), 1, 23), 'Z')`;
}
