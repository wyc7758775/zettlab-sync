import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  disableRemotelySave,
  isPluginEnabled,
  isRemotelySaveEnabled,
} from "../../src/pluginConflicts";

describe("Obsidian plugin conflict detection", () => {
  it("detects an enabled plugin from Obsidian's Set registry", () => {
    const app = { plugins: { enabledPlugins: new Set(["remotely-save"]) } };
    assert.equal(isRemotelySaveEnabled(app), true);
    assert.equal(isPluginEnabled(app, "other-plugin"), false);
  });

  it("fails closed when the registry is unavailable", () => {
    assert.equal(isRemotelySaveEnabled({}), false);
    assert.equal(isRemotelySaveEnabled({ plugins: { enabledPlugins: [] } }), false);
    assert.equal(isRemotelySaveEnabled(null), false);
  });

  it("disables Remotely Save and verifies the registry changed", async () => {
    const enabledPlugins = new Set(["remotely-save"]);
    const calls: string[] = [];
    const app = {
      plugins: {
        enabledPlugins,
        async disablePlugin(pluginId: string): Promise<void> {
          calls.push(pluginId);
          enabledPlugins.delete(pluginId);
        },
      },
    };

    assert.equal(await disableRemotelySave(app), true);
    assert.deepEqual(calls, ["remotely-save"]);
    assert.equal(isRemotelySaveEnabled(app), false);
  });

  it("fails closed when disabling is unavailable or ineffective", async () => {
    const unavailable = {
      plugins: { enabledPlugins: new Set(["remotely-save"]) },
    };
    assert.equal(await disableRemotelySave(unavailable), false);

    const ineffective = {
      plugins: {
        enabledPlugins: new Set(["remotely-save"]),
        disablePlugin: async (): Promise<void> => undefined,
      },
    };
    assert.equal(await disableRemotelySave(ineffective), false);
  });
});
