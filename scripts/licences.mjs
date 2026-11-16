// Production dependency scan shared by `npm run licenses` and the build (licence list + texts).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const ALLOWED_LICENCES = new Set([
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'CC0-1.0',
]);

// Only real licence text files; prefixes alone would also match e.g. icon modules named "license.js".
const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i;

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function licenceOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license.type === 'string') return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  return 'UNKNOWN';
}

export function isAllowedLicence(expression) {
  const cleaned = expression.replace(/[()]/g, ' ').trim();
  if (/\sAND\s/.test(cleaned)) {
    return cleaned.split(/\s+AND\s+/).every((part) => isAllowedLicence(part));
  }
  return cleaned.split(/\s+OR\s+/).some((part) => ALLOWED_LICENCES.has(part.trim()));
}

// Node-style lookup: nested node_modules first, then each ancestor directory.
function resolvePackageDir(root, name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (dir === root) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Every production package (transitively), sorted by name. */
export function collectProductionPackages(root) {
  const rootPkg = readJson(path.join(root, 'package.json'));
  const seen = new Map();
  const missing = [];
  const queue = Object.keys(rootPkg.dependencies ?? {}).map((name) => ({ name, from: root, optional: false }));
  while (queue.length > 0) {
    const { name, from, optional } = queue.shift();
    const dir = resolvePackageDir(root, name, from);
    if (!dir) {
      if (!optional) missing.push(name);
      continue;
    }
    if (seen.has(dir)) continue;
    const pkg = readJson(path.join(dir, 'package.json'));
    seen.set(dir, { name: pkg.name, version: pkg.version, licence: licenceOf(pkg), dir });
    for (const dep of Object.keys(pkg.dependencies ?? {})) queue.push({ name: dep, from: dir, optional: false });
    for (const dep of Object.keys(pkg.optionalDependencies ?? {})) queue.push({ name: dep, from: dir, optional: true });
    // Installed peers ship with the bundle too; absent optional peers are skipped.
    for (const dep of Object.keys(pkg.peerDependencies ?? {})) queue.push({ name: dep, from: dir, optional: true });
  }
  const packages = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  return { packages, missing };
}

/** Licence texts found in the package root. */
export function licenceTexts(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && LICENCE_FILE.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({ file: entry.name, text: readFileSync(path.join(dir, entry.name), 'utf8') }));
}

/** Plain-text bundle of all licence texts, shipped as `third-party-licenses.txt`. */
export function licenceDocument(packages) {
  return packages
    .map((p) => {
      const texts = licenceTexts(p.dir);
      const body = texts.length > 0 ? texts.map((t) => t.text.trim()).join('\n\n') : `(No licence file in the package; declared licence: ${p.licence})`;
      return `${'='.repeat(72)}\n${p.name}@${p.version} – ${p.licence}\n${'='.repeat(72)}\n\n${body}\n`;
    })
    .join('\n');
}
