/** The nav item for the current path: the longest matching `to` (exact for `end` items). */
export function activeNavItem(items, pathname) {
  return items
    .filter((item) =>
      item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
    )
    .sort((a, b) => b.to.length - a.to.length)[0];
}
