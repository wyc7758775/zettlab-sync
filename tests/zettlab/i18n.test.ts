import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { getLocale, t } from "../../src/i18n";

describe("Zettlab Memo notices", () => {
  it("uses the product-branded Chinese connection success copy", () => {
    assert.equal(t("connectionSuccess", {}, "zh-CN"), "Zettlab Memo 服务关联成功");
  });

  it("selects traditional Chinese and interpolates a failure reason", () => {
    assert.equal(getLocale("zh-HK"), "zh_TW");
    assert.equal(
      t("connectionFailed", { reason: "401" }, "zh-TW"),
      "Zettlab Memo 服務關聯失敗：401"
    );
  });

  it("falls back to English for other Obsidian locales", () => {
    assert.equal(t("connectionSuccess", {}, "fr-FR"), "Zettlab Memo service connected.");
  });

  it("describes a safety stop without exposing an English engine error", () => {
    assert.equal(
      t(
        "safetySummary",
        { changed: "1", total: "2", threshold: "50" },
        "zh-CN"
      ),
      "预计变更 1/2 个文件，已达到 50% 安全阈值。"
    );
  });

  it("localizes the conflict banner heading and action per locale", () => {
    assert.equal(t("settingsConflictTitle", {}, "zh-CN"), "同步已被阻止");
    assert.equal(t("settingsConflictTitle", {}, "zh-TW"), "同步已被阻止");
    assert.equal(t("settingsConflictTitle", {}, "en"), "Sync is blocked");
    assert.equal(
      t("settingsConflictDisableAction", {}, "zh-CN"),
      "停用 Remotely Save"
    );
    assert.equal(
      t("settingsConflictDisableAction", {}, "en"),
      "Disable Remotely Save"
    );
  });
});
