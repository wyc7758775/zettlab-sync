import assert from "node:assert/strict";
import { describe, it } from "mocha";
import type { FileStat } from "webdav";
import {
  getWebdavRelativePath,
  walkWebdavTree,
} from "../../src/webdavTreeWalker";

const entry = (
  filename: string,
  type: "directory" | "file",
  symbolicLink = false
): FileStat =>
  ({ filename, type, isSymbolicLink: symbolicLink }) as unknown as FileStat;

describe("node_modules remote scan flow", () => {
  it("prunes node_modules before recursively listing it and restores traversal when disabled", async () => {
    const listings: Record<string, FileStat[]> = {
      "/vault": [
        entry("/vault", "directory"),
        entry("/vault/skills", "directory"),
        entry("/vault/node_modules", "directory", true),
        entry("/vault/node_modules_backup", "directory"),
      ],
      "/vault/skills": [entry("/vault/skills/demo", "directory")],
      "/vault/skills/demo": [
        entry("/vault/skills/demo/SKILL.md", "file"),
        entry("/vault/skills/demo/node_modules", "directory", true),
      ],
      "/vault/node_modules": [
        entry("/vault/node_modules/root-package.js", "file"),
      ],
      "/vault/skills/demo/node_modules": [
        entry("/vault/skills/demo/node_modules/pkg/index.js", "file"),
      ],
      "/vault/node_modules_backup": [
        entry("/vault/node_modules_backup/keep.js", "file"),
      ],
    };

    const run = async (ignoreNodeModules: boolean) => {
      const listCalls: string[] = [];
      const preservedFolders: string[] = [];
      const result = await walkWebdavTree(
        "vault",
        async (path) => {
          listCalls.push(path);
          return listings[path] ?? [];
        },
        ignoreNodeModules,
        undefined,
        (path) => preservedFolders.push(path)
      );
      return {
        listCalls,
        preservedFolders,
        relativePaths: result.map((item) =>
          getWebdavRelativePath(item.filename, "vault")
        ),
      };
    };

    const ignored = await run(true);
    assert.equal(
      ignored.listCalls.some((path) =>
        path.split("/").includes("node_modules")
      ),
      false
    );
    assert.equal(
      ignored.relativePaths.some((path) =>
        path.split("/").includes("node_modules")
      ),
      false
    );
    assert.ok(ignored.relativePaths.includes("node_modules_backup/keep.js"));
    assert.ok(ignored.relativePaths.includes("skills/demo/SKILL.md"));
    assert.deepEqual(ignored.preservedFolders.sort(), ["skills/demo/"]);

    const included = await run(false);
    assert.ok(included.listCalls.includes("/vault/node_modules"));
    assert.ok(included.listCalls.includes("/vault/skills/demo/node_modules"));
    assert.ok(
      included.relativePaths.includes("skills/demo/node_modules/pkg/index.js")
    );
  });
});
