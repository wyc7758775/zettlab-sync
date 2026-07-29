import assert from "node:assert/strict";
import {
  releaseTagFromEnvironment,
  validateReleaseContract,
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
});
