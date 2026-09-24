/**
 * Page numbers to show, with 'gap' for skipped ranges: always the first and last page, and the
 * pages around the current one.
 *   pageWindow(6, 12) → [1, 'gap', 5, 6, 7, 'gap', 12]
 */
export function pageWindow(page, totalPages, around = 1) {
  if (totalPages <= 1) return [1];
  const pages = new Set([1, totalPages]);
  for (let p = page - around; p <= page + around; p += 1) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, i) => {
    const previous = sorted[i - 1];
    if (previous != null && p - previous === 2) result.push(previous + 1);
    else if (previous != null && p - previous > 2) result.push('gap');
    result.push(p);
  });
  return result;
}

/** "Showing 21–40 of 83" numbers for a pagination meta { page, limit, total }. */
export function pageRange({ page, limit, total }) {
  if (!total) return { from: 0, to: 0, total: 0 };
  const from = (page - 1) * limit + 1;
  return { from, to: Math.min(total, page * limit), total };
}
