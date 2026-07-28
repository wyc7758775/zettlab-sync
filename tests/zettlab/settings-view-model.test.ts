import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { getSettingsDashboardModel } from "../../src/settingsViewModel";

describe("settings dashboard model", () => {
  it("presents a successful public sync as a compact status summary", () => {
    assert.deepEqual(
      getSettingsDashboardModel(
        {
          state: "synced",
          title: "同步正常",
          description: "当前仓库已与 Memo 保持同步。",
          lastSyncAt: 100,
        },
        "public",
        5 * 60_000
      ),
      {
        tone: "success",
        icon: "cloud-check",
        transport: "公网",
        lastSyncLabel: "上次完成",
        schedule: "每 5 分钟自动同步",
      }
    );
  });

  it("keeps failed and unconfigured states explicit", () => {
    assert.equal(
      getSettingsDashboardModel(
        {
          state: "needs-attention",
          title: "需要检查连接",
          description: "最近一次同步未完成。",
          lastSyncAt: 200,
        },
        undefined,
        0
      ).tone,
      "warning"
    );
    assert.equal(
      getSettingsDashboardModel(
        {
          state: "not-configured",
          title: "尚未接入 Zettlab",
          description: "请先完成关联。",
        },
        undefined,
        0
      ).icon,
      "unplug"
    );
  });
});
