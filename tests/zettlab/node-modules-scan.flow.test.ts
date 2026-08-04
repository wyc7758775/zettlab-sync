import assert from "node:assert/strict";
import { describe, it } from "mocha";
import type { ListedFiles, Vault } from "obsidian";
import { listFilesInObsFolder } from "../../src/obsFolderLister";

describe("node_modules local scan flow", () => {
  it("prunes a node_modules directory before stat or recursive listing", async () => {
    const statCalls: string[] = [];
    const listCalls: string[] = [];
    const listings: Record<string, ListedFiles> = {
      ".obsidian": {
        folders: [".obsidian/node_modules", ".obsidian/keep"],
        files: [],
      },
      ".obsidian/keep": {
        folders: [],
        files: [".obsidian/keep/config.json"],
      },
    };
    const vault = {
      adapter: {
        stat: async (path: string) => {
          statCalls.push(path);
          if (path.includes("node_modules")) {
            throw new Error("node_modules symlink was followed");
          }
          return path.endsWith(".json")
            ? { type: "file", ctime: 1, mtime: 1, size: 1 }
            : { type: "folder", ctime: 1, mtime: 1, size: 0 };
        },
        list: async (path: string) => {
          listCalls.push(path);
          return listings[path] ?? { folders: [], files: [] };
        },
      },
    } as unknown as Vault;

    const entries = await listFilesInObsFolder(
      ".obsidian",
      vault,
      "zettlab-sync",
      false,
      true
    );

    assert.equal(
      entries.some((entry) => entry.key?.includes("node_modules")),
      false
    );
    assert.equal(
      statCalls.some((path) => path.includes("node_modules")),
      false
    );
    assert.equal(
      listCalls.some((path) => path.includes("node_modules")),
      false
    );
    assert.equal(
      entries.some((entry) => entry.key === ".obsidian/keep/config.json"),
      true
    );
    assert.equal(
      entries.find((entry) => entry.key === ".obsidian/")
        ?.preserveEmptyFolder,
      true
    );
  });

  it("restores node_modules traversal when the toggle is disabled", async () => {
    const listCalls: string[] = [];
    const listings: Record<string, ListedFiles> = {
      ".obsidian": {
        folders: [".obsidian/node_modules"],
        files: [],
      },
      ".obsidian/node_modules": {
        folders: [],
        files: [".obsidian/node_modules/package.json"],
      },
    };
    const vault = {
      adapter: {
        stat: async (path: string) =>
          path.endsWith(".json")
            ? { type: "file", ctime: 1, mtime: 1, size: 1 }
            : { type: "folder", ctime: 1, mtime: 1, size: 0 },
        list: async (path: string) => {
          listCalls.push(path);
          return listings[path] ?? { folders: [], files: [] };
        },
      },
    } as unknown as Vault;

    const entries = await listFilesInObsFolder(
      ".obsidian",
      vault,
      "zettlab-sync",
      false,
      false
    );

    assert.ok(listCalls.includes(".obsidian/node_modules"));
    assert.ok(
      entries.some(
        (entry) => entry.key === ".obsidian/node_modules/package.json"
      )
    );
  });
});
