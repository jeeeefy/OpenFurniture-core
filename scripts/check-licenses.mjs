// Checks that every production dependency (transitively) uses an allowed licence.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectProductionPackages, isAllowedLicence, licenceTexts } from './licences.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { packages, missing } = collectProductionPackages(root);

const rejected = packages.filter((entry) => !isAllowedLicence(entry.licence));
for (const entry of packages) {
  const files = licenceTexts(entry.dir).map((t) => t.file);
  console.log(`${entry.name}@${entry.version}: ${entry.licence} [${files.join(', ') || 'no licence file'}]`);
}

if (missing.length > 0) {
  console.error(`Missing production dependencies (run npm ci): ${missing.join(', ')}`);
  process.exit(1);
}
if (rejected.length > 0) {
  console.error('Disallowed licences:');
  for (const entry of rejected) console.error(`  ${entry.name}@${entry.version}: ${entry.licence}`);
  process.exit(1);
}
console.log(`Licence check passed for ${String(packages.length)} production packages.`);
