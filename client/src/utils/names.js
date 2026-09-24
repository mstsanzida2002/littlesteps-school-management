/**
 * What guardians call the child: the nickname when the school has one on file, otherwise the
 * first name. Bangladeshi names often start with an honorific ("Md.", "Mst.", "মোঃ"), which is
 * not what anyone calls a child, so those are skipped.
 */
const PREFIXES = new Set([
  'md',
  'mohammad',
  'mohammed',
  'muhammad',
  'mohamed',
  'mohd',
  'mst',
  'most',
  'mosammat',
  'mosammot',
  'musammat',
  'syed',
  'sk',
  'মোঃ',
  'মো',
  'মোহাম্মদ',
  'মোছাঃ',
  'মোসাম্মৎ',
]);

// Trailing dots, colons and the Bangla visarga (ঃ, a combining mark, so not in a class).
const normalise = (word) => word.toLowerCase().replace(/(?:\.|:|ঃ)+$/u, '');

/** "Md. Arham Hossain" → "Arham"; "Ayaan Rahman" → "Ayaan"; a one-word name stays as it is. */
export function firstNameOf(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  const first = words.find((word) => !PREFIXES.has(normalise(word)) && !PREFIXES.has(word));
  return first ?? words.at(-1);
}

/** The child's name for guardian-facing text: { nickname, name } → nickname or first name. */
export function childName(child) {
  const nickname = child?.nickname?.trim();
  return nickname || firstNameOf(child?.name);
}
