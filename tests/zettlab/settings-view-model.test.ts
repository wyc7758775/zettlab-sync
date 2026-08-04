import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { normalizeSettings } from "../../src/settingsModel";
import {
  getSettingsConnectionModel,
  getSettingsDashboardModel,
} from "../../src/settingsViewModel";

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
        5 * 60_000,
        "zh-CN"
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
        0,
        "zh-CN"
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
        0,
        "zh-CN"
      ).icon,
      "unplug"
    );
    assert.equal(
      getSettingsDashboardModel(
        {
          state: "ready",
          title: "可以开始同步",
          description: "连接已配置。",
        },
        undefined,
        0,
        "zh-CN"
      ).transport,
      "自动选择 / 待检测"
    );
  });

  it("shows the complete managed addresses and configuration mode", () => {
    const settings = normalizeSettings({
      webdav: {
        address: "https://memo.us-drive.zettlab.com/dav/",
        zettlabEndpoints: {
          lan: "http://192.168.5.30:9091/dav/",
          public: "https://memo.us-drive.zettlab.com/dav/",
        },
      },
    });

    assert.deepEqual(getSettingsConnectionModel(settings, undefined, "zh-CN"), {
      mode: "dual",
      modeLabel: "v2 双地址",
      modeDescription: "v2 双地址",
      lanAddress: "http://192.168.5.30:9091/dav/",
      publicAddress: "https://memo.us-drive.zettlab.com/dav/",
      transport: "自动选择 / 待检测",
    });
    assert.equal(
      getSettingsConnectionModel(settings, "lan", "zh-CN").transport,
      "局域网"
    );
  });

  it("distinguishes legacy and single-endpoint v2 configurations", () => {
    const legacy = normalizeSettings({
      webdav: { address: "https://memo.us-drive.zettlab.com/dav/" },
    });
    assert.deepEqual(getSettingsConnectionModel(legacy, undefined, "zh-CN"), {
      mode: "legacy",
      modeLabel: "旧版单地址",
      modeDescription:
        "旧版单地址 - 请从 Zettlab Memo 重新关联，或在下方填写局域网地址，以启用局域网/公网自动选择。",
      lanAddress: "",
      publicAddress: "https://memo.us-drive.zettlab.com/dav/",
      transport: "自动选择 / 待检测",
    });

    const publicOnly = normalizeSettings({
      webdav: {
        address: "https://memo.us-drive.zettlab.com/dav/",
        zettlabEndpoints: {
          public: "https://memo.us-drive.zettlab.com/dav/",
        },
      },
    });
    assert.equal(
      getSettingsConnectionModel(publicOnly, "public", "zh-CN").modeLabel,
      "v2 仅公网"
    );
  });

  it("localizes new connection fields for English and Traditional Chinese", () => {
    const settings = normalizeSettings({
      webdav: {
        address: "https://memo.us-drive.zettlab.com/dav/",
        zettlabEndpoints: {
          public: "https://memo.us-drive.zettlab.com/dav/",
        },
      },
    });

    assert.equal(
      getSettingsConnectionModel(settings, "public", "en").modeLabel,
      "v2 public only"
    );
    assert.equal(
      getSettingsConnectionModel(settings, undefined, "zh-TW").transport,
      "自動選擇 / 等待檢測"
    );
  });
});
