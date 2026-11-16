# Panel Furniture Designer 0.3.0

A local-first browser app for designing panel furniture (bookcases, cabinets, sideboards, chests of drawers, wardrobes) parametrically. It turns a design into a build document: cut list, hardware list, drilling plans per part, step-by-step assembly instructions with 3D illustrations, and an A4 print/PDF document.

Everything runs in the browser. There is no server, no account and no telemetry; designs stay on your computer.

> **Safety first.** The generated documents are a planning aid, not an engineering or safety approval. Read [Safety notes](#safety-notes) before you build anything.

## Features

- Six templates (bookcase, cabinet with doors, sideboard, chest of drawers, wardrobe, blank carcass).
- Parametric editing: overall size, plinth or no base, up to 6 columns, sections per column, fixed and individually positioned adjustable shelves, per-edge banding overrides, clothes rail (drawn in 3D), inner drawers (behind a door or open), doors (single/double, cup hinges; a door can cover several sections across fixed shelves), drawers (ball-bearing slides), handles, materials and hardware profiles.
- Live 3D preview with view presets; every action also works without 3D and by keyboard alone.
- Validation: errors block outputs and printing, warnings are shown in the editor, the outputs and the print document. Every message links to the field that fixes it.
- Outputs: cut list with cut sizes, edge banding and area per material, cutting layout (parts on as few boards as possible, with adjustable board size, saw kerf and edge trim), hardware list with spares, drilling plans (to scale, with hole tables), assembly steps with tools, safety callouts and 3D illustrations.
- Print view: A4 document with cover, safety notes, materials summary, cut list, hardware, tools, drilling plans and steps. Print it or use "Save as PDF" in the browser's print dialog.
- English and German; millimetres only; `.` and `,` both work as the decimal separator.
- Undo/redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y).
- German imprint (Impressum) with the provider's contact details, reachable from Settings. The design title in the editor is clickable and can be renamed inline.

## Requirements

- Node.js `^24.15.0 || >=26.0.0` (see `.nvmrc`) and npm.
- A current desktop Chrome, Edge or Firefox. Safari is best-effort and not verified.
- WebGL2 for the 3D view and the step illustrations. Without it, the app shows a notice and placeholders; everything else keeps working.

## Setup

Windows (PowerShell) and macOS/Linux (Terminal) use the same commands:

```powershell
npm ci
npx playwright install chromium firefox   # only needed for the E2E tests
npm run dev                               # http://localhost:5173
```

Behind a corporate proxy, set `HTTP_PROXY`/`HTTPS_PROXY` (and `NO_PROXY=localhost,127.0.0.1`) in the terminal before `npm ci`; Node does not use the Windows system proxy.

### Moving the project to another computer (e.g. a Mac)

1. Copy the project folder (USB stick, cloud drive or `git`), **without** `node_modules/`, `dist/`, `test-results/` and `playwright-report/`. These are recreated and `node_modules` contains Windows-specific binaries. Keep the hidden `.git` folder and `.nvmrc`.
2. On the Mac install Node.js 24 (installer from <https://nodejs.org> or `brew install node@24`).
3. In Terminal: `cd` into the folder, then `npm ci`, `npx playwright install chromium firefox`, `npm run verify`.
4. Designs live in the browser, not in the project folder: on the old computer use **Export** for each design and **Import** the files on the new one.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server (no CSP, hot reload) |
| `npm run build` | Type check and production build into `dist/` |
| `npm run preview` | Serves `dist/` on http://localhost:4173 |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (strict, type-aware) |
| `npm test` | Unit and component tests (Vitest), including golden files |
| `npm run test:e2e` | End-to-end tests (Playwright; Chromium runs all specs, Firefox the `@smoke` specs) against the production build |
| `npm run licenses` | Checks that all production dependencies use an allowed licence |
| `npm run verify` | All of the above in order – the quality gate |
| `npm run release` | Bumps the version, updates `CHANGELOG.md`, commits and tags the release |
| `npm run release:minor` / `release:major` | Same, forcing a minor/major bump |

Golden files (`tests/golden/*.golden.json`) pin the complete outputs of every template. After an intended change, regenerate them with `npx vitest run tests/unit/golden.test.ts -u`, review the diff and record the reason in the project progress log.

### Releasing and versioning

Commits use [Conventional Commits](https://www.conventionalcommits.org/) (`feat: …`, `fix: …`, `docs: …`). The release script reads them:

- `feat:` → minor version, `fix:` and everything else → patch, `!` or `BREAKING CHANGE:` → major.
- `npm run release` bumps `package.json` and `package-lock.json`, prepends the grouped changes to `CHANGELOG.md`, creates a `chore(release): vX.Y.Z` commit and an annotated `vX.Y.Z` tag.
- Add `--push` to push the commit and tag in one step: `npm run release -- --push`. Use `--dry-run` to preview, or pass an explicit version: `npm run release -- 1.2.3`.

Deployment can later listen for `v*` tags, so only tagged releases go live.

## Usage

1. **Start page**: pick a template, or open, rename, duplicate, delete, import or export a saved design.
2. **Editor**: select an item in the outline (left) or in the 3D view; edit it in the inspector (right). Values are checked when you press Enter or leave the field; Escape restores the old value.
3. **Validation** (bottom): errors must be fixed before outputs are available; click a message to jump to its field. Warnings remain visible but do not block.
4. **Outputs**: cut list, cutting layout, hardware, drilling plans and instructions tabs.
5. **Print / Save as PDF**: opens the print view. The button becomes active when all step illustrations are ready. Turn on the browser's header/footer option if you want page numbers.

## Data storage and export

- Designs are saved automatically in the browser's IndexedDB about one second after each change. The status in the editor bar shows "Saved", "Unsaved changes" or "Not saved".
- If IndexedDB is unavailable (e.g. some private windows), the app runs in memory only and shows a banner – export before closing the tab.
- Browsers may clear site data. Settings → Storage lets you request persistent storage, but this is best effort. **Export important designs regularly.**
- **Export** writes a `<name>.furniture.json` file. **Import** accepts only files of this format; they are validated strictly (size limit, schema, no unknown or prototype keys) and older schema versions are migrated. An imported design always gets a new id; a name clash appends " (imported)".
- Two tabs editing the same design are detected; you can reload or save your version as a copy. Nothing is overwritten silently.
- The app makes no network requests except loading its own files.

## Safety notes

These notes appear in the app and in every printed document:

1. The documents are a planning aid, not an engineering or safety approval.
2. Anchor tall or narrow furniture to the wall with fixings suitable for your wall type.
3. Shelf-span checks are rules of thumb without a load calculation.
4. Hardware positions come from generic profiles. Check them against the manufacturer's datasheet, mark each profile as verified in the app, and drill a test piece first.
5. Follow the tool manufacturers' safety instructions and wear eye, ear and dust protection.

These texts have not had a qualified (legal or engineering) review. That review is required before any public distribution of the app or its documents.

## Limitations of version 0.2.1

- Screw-butt joints only (no dowels, confirmat or pocket screws); surface-mounted back panel; overlay doors only (no inset doors).
- Doors can span several sections of one column, drawer fronts only their own section; fronts never span columns.
- Adjustable shelf heights can be set individually; each shelf snaps to the nearest 32 mm pin row, and changing the shelf count resets the layout to even spacing.
- The cutting layout is a fast heuristic (guillotine cuts, several strategies tried), not a proven optimum; it does not reuse offcuts across materials or designs.
- PDF output uses the browser's print dialog; page breaks can differ slightly between browsers.
- Drawers at equal heights on both sides of a divider get an automatic vertical slide offset; if the drawer box is too shallow for the offset, a hole conflict remains – give them different front heights.
- Inner drawers have no handle or grip and are evenly stacked; behind a door their boxes start 70 mm behind the front edge to pass the hinges (a typical value – check it against your hinges).

## Deployment

`npm run build` produces a static site in `dist/` that works on any static host and under a sub-path (PowerShell: `$env:BASE_PATH='/sub/'; npm run build`, macOS/Linux: `BASE_PATH=/sub/ npm run build`). The build contains a Content Security Policy meta tag; `public/_headers` adds `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and `Permissions-Policy` on hosts that read it (Cloudflare Pages, Netlify). `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt` and `public/404.html` are deployed as-is and make the app discoverable by search engines and AI assistants; they contain absolute URLs for `https://free.openfurniture.de/`, so update them when deploying to another origin. Before any public deployment, the hosting choice, privacy/imprint obligations and the safety texts need a qualified review.

### Hosting

The free planner is fully static and private: it loads only its own files, makes no API calls, sets no cookies and needs no server or database. To self-host it, serve `dist/` from any static host (Cloudflare Pages, Netlify and GitHub Pages all work). Before a public launch, complete the legal checklist — imprint and privacy notice in particular — and have the safety texts reviewed.

## Project structure

```
src/domain       pure TypeScript: schema, templates, layout, derivation, construction rules, validation, outputs, operations
src/render3d     three.js viewport and step illustrations
src/persistence  IndexedDB repository, autosave, file format and migrations, settings
src/i18n         English and German messages, number parsing and formatting
src/app          React UI: routes, components, store, print view
tests/unit       Vitest unit, component, golden and performance tests
tests/e2e        Playwright end-to-end tests
```

## Licences

The project's own code is licensed under the GNU Affero General Public License v3.0 or later (see [LICENSE](LICENSE)). Third-party packages are listed with their licences under Settings → Open-source licences; the full texts ship as `third-party-licenses.txt` with every build.
