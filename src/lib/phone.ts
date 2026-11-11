/** Egyptian mobile (01x xxxx xxxx), with or without +20 / 0020, spaces or dashes. Shared by the site and the API. */
export function normaliseEgyptPhone(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0020')) d = d.slice(2);
  if (d.startsWith('20') && d.length === 12) d = '0' + d.slice(2);
  return /^01[0125]\d{8}$/.test(d) ? d : null;
}

/** 01012345678 → 201012345678 (for wa.me links). */
export const toInternational = (local: string) => `20${local.replace(/^0/, '')}`;
