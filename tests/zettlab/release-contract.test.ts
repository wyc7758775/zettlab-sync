import assert from "node:assert/strict";
import {
  releaseTagFromEnvironment,
  validateReleaseContract,
  validateStoreReviewAssets,
} from "../../scripts/release-contract.mjs";

const validContract = {
  manifest: { version: "0.0.3", minAppVersion: "1.5.0" },
  packageJson: { version: "0.0.3" },
  versions: { "0.0.3": "1.5.0" },
};

describe("Obsidian store release contract", () => {
  it("accepts an exact version tag", () => {
    assert.doesNotThrow(() =>
      validateReleaseContract({ ...validContract, tagName: "0.0.3" })
    );
  });

  it("rejects a v-prefixed tag", () => {
    assert.throws(
      () => validateReleaseContract({ ...validContract, tagName: "v0.0.3" }),
      /must exactly match/
    );
  });

  it("rejects inconsistent version metadata", () => {
    assert.throws(
      () =>
        validateReleaseContract({
          ...validContract,
          packageJson: { version: "0.0.4" },
        }),
      /same version/
    );
  });

  it("validates only tag events and ignores branch names", () => {
    assert.equal(
      releaseTagFromEnvironment({
        GITHUB_REF_TYPE: "branch",
        GITHUB_REF_NAME: "codex/obsidian-store-readiness",
      }),
      undefined
    );
    assert.equal(
      releaseTagFromEnvironment({
        GITHUB_REF_TYPE: "tag",
        GITHUB_REF_NAME: "0.0.3",
      }),
      "0.0.3"
    );
  });

  it("accepts assets that satisfy automated store review checks", () => {
    assert.doesNotThrow(() =>
      validateStoreReviewAssets({
        manifest: { authorUrl: "https://github.com/wyc7758775" },
        javascript: "queueMicrotask(task);",
        stylesheet: ".setting-item { margin: 0; }",
      })
    );
  });

  for (const testCase of [
    {
      name: "dynamic script creation",
      input: {
        manifest: { authorUrl: "https://github.com/wyc7758775" },
        javascript: 'document.createElement("script");',
        stylesheet: ".setting-item { margin: 0; }",
      },
      expected: /dynamically create script elements/,
    },
    {
      name: "a repository author URL",
      input: {
        manifest: {
          authorUrl: "https://github.com/wyc7758775/zettlab-sync",
        },
        javascript: "queueMicrotask(task);",
        stylesheet: ".setting-item { margin: 0; }",
      },
      expected: /profile or organization/,
    },
    {
      name: "an !important declaration",
      input: {
        manifest: { authorUrl: "https://github.com/wyc7758775" },
        javascript: "queueMicrotask(task);",
        stylesheet: ".setting-item { margin: 0 !important; }",
      },
      expected: /must not use !important/,
    },
  ]) {
    it(`rejects ${testCase.name}`, () => {
      assert.throws(
        () => validateStoreReviewAssets(testCase.input),
        testCase.expected
      );
    });
  }
});
