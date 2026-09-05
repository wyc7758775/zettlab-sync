# AGENTS.md

WebDAV-only Obsidian plugin that syncs a vault with Zettlab Memo. Deliberately scoped: no cloud providers other than WebDAV, no OAuth, no QR pairing, no paid tier, no end-to-end encryption. Do not add features outside this scope.

## Commands

- `npm test` — mocha + tsx over `tests/zettlab/**/*.test.ts` (no Obsidian runtime needed).
- `npm run build` — `tsc -noEmit -skipLibCheck` then esbuild production bundle to `main.js`.
- `npm run dev` — esbuild watch.
- `npm run format` — Biome check with `--write` (2-space, double quotes, semicolons, LF, width 80).
- `npm run release:prepare` — build + package into `release/` (also runs store-review contract checks).
- CI (`verify.yml` on every push/PR) runs: `npm ci`, `npm test`, `npm run release:prepare`, `npm audit --omit=dev`. All must pass before merge.

## Architecture

- `src/main.ts` — plugin entry point and esbuild entry; wires commands, ribbon, settings tab.
- `src/sync.ts` — core sync engine (diff, upload/download/delete decisions).
- Settings are split MVVM-style: `settings.ts` (Obsidian SettingTab UI), `settingsModel.ts` (normalized model + defaults), `settingsViewModel.ts`, `settingsSaveQueue.ts` (serialized persistence).
- Endpoint selection: `davEndpoints.ts` + `obsidianDavProbe.ts` implement protocol v2 (LAN-first probe, bounded ~3s, fall back to public, fixed per sync round). Read `docs/obsidian-dav-endpoints-v2.md` before touching these — it defines the Hard Rules (HR1–HR5) and allowed address formats.
- One-click setup from Zettlab Memo: `bootstrap.ts`, `bootstrapFirstSync.ts`.
- Filesystem layer: `fsWebdav.ts`, `fsLocal.ts`, `fsPlain.ts`, `fsGetter.ts`, `fsAll.ts` (vault files stay plaintext Markdown by design).
- `localdb.ts` — localforage-backed sync metadata.
- Safety guardrails: `syncSafety.ts` / `syncSafetyModal.ts` (empty-side deletion protection, protected-modify confirmation) and `syncRunGate.ts` (single-flight sync). Be careful weakening any check here — they exist to prevent vault data loss.
- `pluginConflicts.ts` — detects and disables the conflicting Remotely Save plugin; on config failure the conflict state must be preserved (see `plugin-conflicts.test.ts`).
- `i18n.ts` — all UI strings; locales are `en`, `zh_CN`, `zh_TW`. Every new `MessageKey` must be defined in all three locale tables.
- `tests/zettlab/` — unit and `.flow.test.ts` integration tests; `webdav-server` is a devDependency for tests needing a real server.
- `scripts/release-contract.mjs` — Obsidian store review contract, unit-tested in `release-contract.test.ts`.

## Hard rules

- **Versioning/release**: `package.json`, `manifest.json`, and `versions.json` must carry the same `x.y.z`. Git tags are exactly `x.y.z` (no `v` prefix). Never rewrite a published tag; increment patch instead. See `docs/community-plugin-release.md`. The default branch is the source of truth for `manifest.json`.
- **Store review constraints** (enforced by `release:prepare` tests): no `!important` in `styles.css`, no dynamic `document.createElement("script")`, `manifest.authorUrl` must be a profile/organization URL.
- **Provenance**: most files derive from Remotely Save commit `7ca2d192…` (Apache-2.0). Keep the "Derived from Remotely Save" header comments and `src/LICENSE`; never reintroduce `pro/` or PolyForm-licensed code.
- **Platform**: `isDesktopOnly: false` — code must work on mobile. Node built-ins are polyfilled via the `browser` field (`path-browserify`, `process/browser`) and esbuild aliases/defines; don't import new Node modules without a bundler story.
- `tsconfig.json` is strict; tests import via relative paths and `node:assert/strict`.
