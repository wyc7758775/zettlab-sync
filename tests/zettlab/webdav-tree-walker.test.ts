import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  getWebdavRelativePath,
  stripLeadingWebdavPath,
  walkWebdavTree,
} from "../../src/webdavTreeWalker";
import type { FileStat } from "webdav";

describe("WebDAV tree path normalization", () => {
  it("normalizes server paths relative to the vault without matching the vault name", () => {
    assert.equal(stripLeadingWebdavPath("/../vault/notes"), "/vault/notes");
    assert.equal(
      getWebdavRelativePath(
        "/node_modules-vault/skills/demo/node_modules/pkg",
        "node_modules-vault"
      ),
      "skills/demo/node_modules/pkg"
    );
    assert.throws(() =>
      getWebdavRelativePath("/another-vault/node_modules", "vault")
    );
  });

  it("reports the visible parent of a pruned node_modules subtree", async () => {
    const preservedFolders: string[] = [];
    const result = await walkWebdavTree(
      "vault",
      async (path) =>
        path === "/vault"
          ? ([
              { filename: "/vault/skills", type: "directory" },
            ] as FileStat[])
          : ([
              {
                filename: "/vault/skills/node_modules",
                type: "directory",
              },
            ] as FileStat[]),
      true,
      undefined,
      (path) => preservedFolders.push(path)
    );

    assert.deepEqual(
      result.map((entry) => entry.filename),
      ["/vault/skills"]
    );
    assert.deepEqual(preservedFolders, ["skills/"]);
  });
});
