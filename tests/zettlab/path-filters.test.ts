import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  getNodeModulesParentFolder,
  isNodeModulesPath,
  shouldIgnoreNodeModulesPath,
} from "../../src/pathFilters";

describe("node_modules path filtering", () => {
  it("matches only an independent directory segment on every platform", () => {
    assert.equal(isNodeModulesPath("node_modules/pkg/index.js"), true);
    assert.equal(
      isNodeModulesPath("skills/demo/node_modules/pkg/index.js"),
      true
    );
    assert.equal(
      isNodeModulesPath("skills\\demo\\node_modules\\pkg\\index.js"),
      true
    );
    assert.equal(isNodeModulesPath("skills/node_modules_backup/a.js"), false);
    assert.equal(isNodeModulesPath("skills/my-node_modules/a.js"), false);
    assert.equal(isNodeModulesPath("skills/node_modules.txt"), false);
    assert.equal(
      getNodeModulesParentFolder("skills/demo/node_modules/pkg/index.js"),
      "skills/demo/"
    );
    assert.equal(getNodeModulesParentFolder("node_modules/pkg/index.js"), "");
    assert.equal(getNodeModulesParentFolder("skills/modules/pkg"), undefined);
  });

  it("applies the built-in rule only while its independent toggle is enabled", () => {
    const path = "skills/demo/node_modules/pkg/index.js";
    assert.equal(shouldIgnoreNodeModulesPath(path, true), true);
    assert.equal(shouldIgnoreNodeModulesPath(path, false), false);
  });
});
