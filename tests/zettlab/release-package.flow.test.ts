import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageRelease } from "../../scripts/package-release.mjs";

describe("Obsidian store release package flow", () => {
  it("emits store assets and the optional manual-install archive", () => {
    const root = mkdtempSync(join(tmpdir(), "zettlab-sync-release-"));
    try {
      writeFileSync(
        join(root, "manifest.json"),
        JSON.stringify({
          id: "zettlab-sync",
          version: "0.0.3",
          minAppVersion: "1.5.0",
        })
      );
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ version: "0.0.3" })
      );
      writeFileSync(
        join(root, "versions.json"),
        JSON.stringify({ "0.0.3": "1.5.0" })
      );
      for (const asset of ["main.js", "styles.css"])
        writeFileSync(join(root, asset), asset);

      packageRelease({ root, tagName: "0.0.3" });

      for (const asset of ["main.js", "manifest.json", "styles.css"]) {
        assert.equal(existsSync(join(root, "release", asset)), true);
      }
      assert.equal(
        existsSync(join(root, "release", "zettlab-sync-v0.0.3.zip")),
        true
      );
      assert.equal(
        existsSync(join(root, "release", "zettlab-sync-v0.0.3.zip.sha256")),
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
