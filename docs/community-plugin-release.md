# Obsidian Community Plugin release

The default branch is the source of truth for `manifest.json`.

1. Update `package.json`, `manifest.json`, and `versions.json` to the same `x.y.z` version.
2. Run `npm test`, `npm run release:prepare`, and `npm audit --omit=dev`.
3. Merge the release-ready change into the default branch.
4. Create and push a tag exactly equal to the manifest version, for example `0.0.3` (without a `v` prefix).
5. Confirm that the GitHub Release contains `main.js`, `manifest.json`, and `styles.css` as individual assets. The ZIP and checksum are optional manual-install assets.
6. For the initial listing, submit the repository URL through the Obsidian Community directory and address its automated review.

Do not rewrite an already published tag. Increment the patch version when review feedback requires code or metadata changes.
