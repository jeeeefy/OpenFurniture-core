#!/usr/bin/env node
// Create a semantic-version release: bump package.json, update CHANGELOG.md,
// commit and tag. Usage:
//   npm run release                 # auto: breaking -> major, feat -> minor, else patch
//   npm run release:minor           # force minor
//   npm run release:major           # force major
//   npm run release -- 1.2.3        # explicit version
//   npm run release -- --push       # also push commit and tag to origin
//   npm run release -- --dry-run    # show what would happen
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');
const changelogPath = path.join(root, 'CHANGELOG.md');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const push = args.includes('--push');
const choice = args.find((arg) => !arg.startsWith('--')) ?? 'auto';

function fail(message) {
  console.error(`\nrelease: ${message}\n`);
  process.exit(1);
}

function git(gitArgs) {
  return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).trim();
}

function parseCommit(subject, body) {
  const match = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?:\s*(?<desc>.+)$/.exec(subject);
  if (!match) return { type: 'other', scope: '', desc: subject, breaking: false };
  return {
    type: match.groups.type,
    scope: match.groups.scope ?? '',
    desc: match.groups.desc,
    breaking: Boolean(match.groups.breaking) || /BREAKING[ -]CHANGE:/i.test(body),
  };
}

function bumpVersion(version, kind) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const status = git(['status', '--porcelain']);
if (status) fail('the working tree is not clean. Commit or stash your changes first.');

let lastTag = null;
try {
  lastTag = git(['describe', '--tags', '--abbrev=0']);
} catch {
  // No tags yet: the release covers the whole history.
}

const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const raw = git(['log', range, '--pretty=format:%H%x1f%s%x1f%b%x1e']);
const commits = raw
  .split('\x1e')
  .map((record) => record.trim())
  .filter(Boolean)
  .map((record) => {
    const [hash, subject, body = ''] = record.split('\x1f');
    return { hash, subject, ...parseCommit(subject, body) };
  })
  .filter((commit) => !/^chore\(release\):/.test(commit.subject));

if (commits.length === 0) fail(`nothing to release since ${lastTag ?? 'the first commit'}.`);

const breaking = commits.some((commit) => commit.breaking);
const hasFeature = commits.some((commit) => commit.type === 'feat');
const automatic = breaking ? 'major' : hasFeature ? 'minor' : 'patch';

let kind = choice;
if (kind === 'auto') kind = automatic;
if (!['patch', 'minor', 'major'].includes(kind) && !/^\d+\.\d+\.\d+$/.test(kind)) {
  fail(`unknown version "${choice}". Use patch, minor, major, auto or an explicit version like 1.2.3.`);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const next = /^\d+\.\d+\.\d+$/.test(kind) ? kind : bumpVersion(pkg.version, kind);
if (next === pkg.version) fail(`version is already ${next}.`);

const sections = {
  feat: 'Added',
  fix: 'Fixed',
  perf: 'Performance',
  change: 'Changed',
  refactor: 'Changed',
  docs: 'Documentation',
  build: 'Build',
  ci: 'CI',
  test: 'Tests',
  chore: 'Chores',
  style: 'Styling',
  other: 'Other',
};
const order = ['Added', 'Changed', 'Fixed', 'Performance', 'Documentation', 'Build', 'CI', 'Tests', 'Chores', 'Styling', 'Other'];
const grouped = new Map();

for (const commit of commits) {
  const title = sections[commit.type] ?? 'Other';
  const prefix = commit.scope ? `**${commit.scope}:** ` : '';
  const line = `- ${prefix}${commit.desc}`;
  if (!grouped.has(title)) grouped.set(title, []);
  grouped.get(title).push(line);
}

const date = new Date().toISOString().slice(0, 10);
const lines = [`## [${next}] - ${date}`, '', `Previous version: ${pkg.version}${lastTag ? ` (${lastTag})` : ''}.`, ''];
if (breaking) {
  lines.push('### Breaking changes', '');
  for (const commit of commits.filter((c) => c.breaking)) {
    lines.push(`- ${commit.scope ? `**${commit.scope}:** ` : ''}${commit.desc}`);
  }
  lines.push('');
}
for (const title of order) {
  const items = grouped.get(title);
  if (!items?.length) continue;
  lines.push(`### ${title}`, '', ...items, '');
}
const section = `${lines.join('\n')}\n`;

const header = [
  '# Changelog',
  '',
  'All notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/).',
  '',
].join('\n');

let changelog;
if (existsSync(changelogPath)) {
  const existing = readFileSync(changelogPath, 'utf8');
  const marker = existing.indexOf('\n## ');
  changelog = marker === -1
    ? `${existing.replace(/\s*$/, '')}\n\n${section}`
    : `${existing.slice(0, marker)}\n${section}${existing.slice(marker + 1)}`;
} else {
  changelog = `${header}\n${section}`;
}

console.log(`\nReleasing ${pkg.version} -> ${next}${lastTag ? ` (commits since ${lastTag})` : ' (whole history)'}`);
for (const commit of commits) {
  const flags = [commit.type, commit.breaking ? 'breaking' : ''].filter(Boolean).join(', ');
  console.log(`  ${commit.hash.slice(0, 7)}  [${flags}] ${commit.subject}`);
}

if (dryRun) {
  console.log('\nDry run: nothing was changed.\n');
  process.exit(0);
}

writeFileSync(changelogPath, changelog);
execFileSync('npm', ['version', next, '--no-git-tag-version'], { cwd: root, stdio: 'inherit' });

const files = [pkgPath, changelogPath];
if (existsSync(lockPath)) files.push(lockPath);
git(['add', ...files.map((file) => path.relative(root, file))]);
git(['commit', '-m', `chore(release): v${next}`]);
git(['tag', '-a', `v${next}`, '-m', `v${next}`]);

console.log(`\nCreated commit "chore(release): v${next}" and tag v${next}.`);

if (push) {
  git(['push', '--follow-tags']);
  console.log('Pushed commit and tag to origin.');
} else {
  console.log('Not pushed. Run `git push --follow-tags` (or `npm run release -- --push`) when ready.\n');
}
