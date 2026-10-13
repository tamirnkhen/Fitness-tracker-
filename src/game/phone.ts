/** Israeli mobile: 05XXXXXXXX / +972-5X… → 9725XXXXXXXX, or null. Mirrors q__phone in SQL. */
export function normalizePhone(input: string): string | null {
  let d = (input || '').replace(/[^0-9]/g, '');
  if (d.startsWith('00972')) d = d.slice(2);
  if (d.startsWith('0')) d = '972' + d.slice(1);
  return /^9725\d{8}$/.test(d) ? d : null;
}

/** 0501234567 → 050-123-4567 for display. */
export function formatPhone(input: string): string {
  const n = normalizePhone(input);
  if (!n) return input;
  const local = '0' + n.slice(3);
  return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
}

const WEAK = new Set([
  '1234',
  '4321',
  '0123',
  '3210',
  '1212',
  '2121',
  '2580',
  '0852',
  '1122',
  '6969',
  '1010',
  '2000',
  '1984',
  '2468',
  '1357',
]);

/** Mirrors q__weak_pin in SQL. */
export function isWeakPin(p: string): boolean {
  return /^(\d)\1{3}$/.test(p) || WEAK.has(p);
}
