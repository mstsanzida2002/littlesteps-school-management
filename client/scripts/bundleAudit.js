/**
 * What does a page download? Builds the client with a plugin that records each chunk's modules,
 * then lists the chunks (and source folders) a page loads: the entry, the page's chunk and
 * everything they import statically. Flags code that page should never need.
 *
 *   npm run audit:bundle -w client            (student home, login)
 *   npm run audit:bundle -w client -- StudentDashboardPage LoginPage TeacherDashboardPage
 *
 * Exits with 1 when a guardian or login page pulls in teacher/admin pages or Recharts.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['StudentDashboardPage', 'LoginPage'];

const chunks = new Map();
await build({
  root,
  logLevel: 'warn',
  build: { write: false },
  plugins: [
    {
      name: 'bundle-audit',
      generateBundle(_options, bundle) {
        for (const [fileName, item] of Object.entries(bundle)) {
          if (item.type !== 'chunk') continue;
          chunks.set(fileName, {
            name: item.name,
            isEntry: item.isEntry,
            imports: item.imports,
            modules: item.moduleIds,
            gzip: zlib.gzipSync(item.code).length,
          });
        }
      },
    },
  ],
});

const entry = [...chunks.entries()].find(([, c]) => c.isEntry)[0];
const closure = (start) => {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file) || !chunks.has(file)) return;
    seen.add(file);
    for (const dep of chunks.get(file).imports) visit(dep);
  };
  visit(entry);
  if (start) visit(start);
  return seen;
};
const rel = (id) => path.relative(path.join(root, 'src'), id).replaceAll('\\', '/');
const FORBIDDEN = /features\/(teacher|admin)\/pages\/|recharts|TrendLineChart|ComparisonBarChart/;

let failed = false;
for (const page of pages) {
  const pageChunk = [...chunks.entries()].find(([, c]) => c.name === page)?.[0];
  if (!pageChunk) {
    console.log(`\n${page}: no chunk with that name`);
    continue;
  }
  const files = closure(pageChunk);
  const modules = [...files].flatMap((f) => chunks.get(f).modules);
  const own = modules.filter((m) => !m.includes('node_modules')).map(rel);
  const vendors = new Set(
    modules
      .filter((m) => m.includes('node_modules'))
      .map((m) =>
        m
          .split('node_modules/')
          .pop()
          .split('/')
          .slice(0, m.includes('/@') ? 2 : 1)
          .join('/'),
      ),
  );
  const gzip = [...files].reduce((sum, f) => sum + chunks.get(f).gzip, 0);
  const folders = {};
  for (const m of own) {
    const folder = m
      .split('/')
      .slice(0, m.startsWith('features/') ? 2 : 1)
      .join('/');
    folders[folder] = (folders[folder] ?? 0) + 1;
  }
  const bad = modules.filter((m) => FORBIDDEN.test(m.replaceAll('\\', '/'))).map(rel);
  console.log(`\n${page}: ${files.size} JS files, ${(gzip / 1024).toFixed(1)} KB gzip`);
  console.log(
    `  source folders: ${Object.entries(folders)
      .map(([k, v]) => `${k} (${v})`)
      .join(', ')}`,
  );
  console.log(`  packages: ${[...vendors].sort().join(', ')}`);
  if (bad.length && page !== 'TeacherDashboardPage' && !page.startsWith('Admin')) {
    failed = true;
    console.log(`  ✗ should not load: ${bad.join(', ')}`);
  } else {
    console.log('  ✓ no teacher/admin pages or chart library');
  }
}
process.exit(failed ? 1 : 0);
