const segmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/** First user-perceived character, so Bangla letters keep their vowel signs ("আ", not "আ" + "্"). */
const firstGrapheme = (word) =>
  segmenter ? (segmenter.segment(word)[Symbol.iterator]().next().value?.segment ?? '') : word[0];

/** Up to two initials for an avatar: "Ayaan Rahman" → "AR", "আয়ান রহমান" → "আর". */
export function initialsOf(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '?';
  const picked = words.length === 1 ? [words[0]] : [words[0], words.at(-1)];
  return picked.map((w) => firstGrapheme(w).toLocaleUpperCase()).join('');
}
