#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  const args = {
    record: false,
    dist: join(root, 'dist'),
    out: join(root, 'scripts', 'bundle-baseline.json'),
    tolerance: 2048,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--record') args.record = true;
    else if (a === '--dist') args.dist = argv[(i += 1)];
    else if (a === '--out') args.out = argv[(i += 1)];
    else if (a === '--tolerance') args.tolerance = Number(argv[(i += 1)]);
  }
  return args;
}

/** Collects the JS files the `/` page loads: entry scripts plus module preloads. */
function collectJsFiles(dist) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
  const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)].map((m) => m[1]);
  return [...new Set([...scripts, ...preloads])];
}

function measure(dist) {
  let totalGzipBytes = 0;
  const files = [];
  for (const file of collectJsFiles(dist)) {
    const abs = join(dist, file);
    if (!existsSync(abs)) continue;
    files.push(file);
    totalGzipBytes += gzipSync(readFileSync(abs)).length;
  }
  return { totalGzipBytes, files };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const measured = measure(args.dist);
  if (args.record) {
    writeFileSync(args.out, `${JSON.stringify({ totalGzipBytes: measured.totalGzipBytes }, null, 2)}\n`);
    console.log(`Recorded baseline ${measured.totalGzipBytes} gzip bytes -> ${args.out}`);
    return;
  }
  if (!existsSync(args.out)) {
    console.error(`Baseline not found at ${args.out}. Run "npm run bundle:check -- --record" first.`);
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(args.out, 'utf8'));
  const limit = baseline.totalGzipBytes + args.tolerance;
  console.log(`Bundle JS gzip: ${measured.totalGzipBytes} bytes (limit ${limit} = baseline ${baseline.totalGzipBytes} + ${args.tolerance})`);
  if (measured.totalGzipBytes > limit) {
    console.error(`Bundle exceeds the ${args.tolerance}-byte tolerance over the recorded baseline.`);
    process.exit(1);
  }
}

main();
