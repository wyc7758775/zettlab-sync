import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  messyConfigToNormal,
  normalConfigToMessy,
} from "../../src/configPersist";
import { DEFAULT_SETTINGS } from "../../src/settingsModel";

describe("plugin settings persistence", () => {
  it("round-trips Unicode settings without a Node-only buffer", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      ignorePaths: ["笔记/草稿.md"],
      ignoreNodeModules: false,
    };

    assert.deepEqual(
      messyConfigToNormal(normalConfigToMessy(settings)),
      settings
    );
  });

  it("drops malformed primitive persisted data", () => {
    assert.equal(messyConfigToNormal("invalid"), undefined);
  });
});
