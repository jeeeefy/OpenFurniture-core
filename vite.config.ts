import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { collectProductionPackages, licenceDocument } from './scripts/licences.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// The dev server needs inline scripts for HMR, so the CSP is only injected into production builds.
export function cspMetaPlugin(): Plugin {
  return {
    name: 'fd-csp-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}

export const LICENCE_FILE_NAME = 'third-party-licenses.txt';
const LICENCE_MODULE = 'virtual:licences';

/** Settings licence list (`virtual:licences`) and the full texts as a static asset. */
export function licencesPlugin(): Plugin {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const packages = () => collectProductionPackages(root).packages;
  return {
    name: 'fd-licences',
    resolveId: (id) => (id === LICENCE_MODULE ? `\0${LICENCE_MODULE}` : null),
    load(id) {
      if (id !== `\0${LICENCE_MODULE}`) return null;
      const list = packages().map(({ name, version, licence }) => ({ name, version, licence }));
      return `export const LICENCES = ${JSON.stringify(list)};\nexport const LICENCE_FILE = ${JSON.stringify(LICENCE_FILE_NAME)};`;
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: LICENCE_FILE_NAME, source: licenceDocument(packages()) });
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), cspMetaPlugin(), licencesPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __FD_LINKS__: JSON.stringify({ header: [], footer: [], outputs: [] }),
  },
  build: {
    target: 'es2023',
    sourcemap: true,
    manifest: true,
  },
});
