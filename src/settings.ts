/*
 * Derived from Remotely Save commit 7ca2d192552819777318d9d521dca45450934b4f
 * (Apache-2.0). Modified by Zettlab.
 */
import { getLanguage, Notice, PluginSettingTab, Setting, setIcon } from "obsidian";
import type { ConflictActionType } from "./baseTypes";
import { t, type MessageKey } from "./i18n";
import type ZettlabSyncPlugin from "./main";
import {
  ManualLanAttemptGuard,
  prepareManualLanUpdateIfCurrent,
  shouldRollbackManualLanSave,
} from "./manualLanSettings";
import { obsidianDavProbeRequest } from "./obsidianDavProbe";
import {
  disableRemotelySave,
  isRemotelySaveEnabled,
} from "./pluginConflicts";
import {
  SYNC_ON_SAVE_DELAY_MILLISECONDS,
  parseProtectModifyPercentage,
} from "./settingsModel";
import { getSettingsConnectionModel, getSettingsDashboardModel } from "./settingsViewModel";
import { ZETTLAB_LOGO_DATA_URL } from "./zettlabLogo";
export { DEFAULT_SETTINGS, normalizeSettings } from "./settingsModel";

const saveText = async (
  plugin: ZettlabSyncPlugin,
  update: () => void
): Promise<void> => {
  update();
  await plugin.saveSettings();
};

const formatTime = (millis: number | undefined): string => {
  if (millis === undefined) return "尚未同步";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(millis));
};

const appendZettlabLogo = (parent: HTMLElement): void => {
  const logo = parent.createEl("img", {
    cls: "zettlab-sync-brand-mark",
    attr: {
      src: ZETTLAB_LOGO_DATA_URL,
      alt: "Zettlab Memo",
    },
  });
  logo.decoding = "async";
};

export class ZettlabSyncSettingTab extends PluginSettingTab {
  private readonly manualLanAttempts = new ManualLanAttemptGuard();

  constructor(private readonly plugin: ZettlabSyncPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    this.manualLanAttempts.invalidate();
    const { containerEl } = this;
    const language = getLanguage();
    const localize = (key: MessageKey): string => t(key, {}, language);
    containerEl.empty();
    containerEl.addClass("zettlab-sync-settings");

    const pageHeader = containerEl.createDiv({
      cls: "zettlab-sync-page-header",
    });
    const pageHeaderBrand = pageHeader.createDiv({
      cls: "zettlab-sync-page-header-brand",
    });
    appendZettlabLogo(pageHeaderBrand);
    const pageHeaderCopy = pageHeaderBrand.createDiv({
      cls: "zettlab-sync-page-header-copy",
    });
    pageHeaderCopy.createDiv({
      cls: "zettlab-sync-eyebrow",
      text: "ZETTLAB MEMO",
    });
    new Setting(pageHeaderCopy)
      .setName("同步中心")
      .setHeading()
      .setClass("zettlab-sync-page-title");
    pageHeaderCopy.createEl("p", {
      text: "让当前 Obsidian 仓库与 Memo 安全、稳定地保持同步。",
    });

    if (isRemotelySaveEnabled(this.app)) {
      const conflictBanner = containerEl.createDiv({
        cls: "zettlab-sync-conflict",
      });
      const conflictIcon = conflictBanner.createDiv({
        cls: "zettlab-sync-conflict-icon",
      });
      setIcon(conflictIcon, "triangle-alert");
      const conflictCopy = conflictBanner.createDiv({
        cls: "zettlab-sync-conflict-copy",
      });
      conflictCopy.createEl("strong", {
        text: localize("settingsConflictTitle"),
      });
      conflictCopy.createSpan({ text: localize("remotelySaveConflict") });
      const disableButton = conflictBanner.createEl("button", {
        cls: "zettlab-sync-action is-secondary",
      });
      const disableIcon = disableButton.createSpan();
      setIcon(disableIcon, "power-off");
      disableButton.createSpan({
        text: localize("settingsConflictDisableAction"),
      });
      disableButton.addEventListener("click", () => {
        void (async () => {
          disableButton.disabled = true;
          try {
            const disabled = await disableRemotelySave(this.app);
            new Notice(
              localize(
                disabled ? "remotelySaveDisabled" : "remotelySaveConflict"
              )
            );
          } finally {
            this.display();
          }
        })();
      });
    }

    const overview = this.plugin.getSyncOverview();
    const activeTransport = this.plugin.getActiveTransport();
    const dashboard = getSettingsDashboardModel(
      overview,
      activeTransport,
      this.plugin.settings.autoRunEveryMilliseconds,
      language
    );
    const statusPanel = containerEl.createDiv({
      cls: `zettlab-sync-dashboard is-${dashboard.tone}`,
    });
    const statusTop = statusPanel.createDiv({ cls: "zettlab-sync-status-top" });
    const statusIcon = statusTop.createDiv({ cls: "zettlab-sync-status-icon" });
    setIcon(statusIcon, dashboard.icon);
    const statusCopy = statusTop.createDiv({ cls: "zettlab-sync-status-copy" });
    new Setting(statusCopy)
      .setName(overview.title)
      .setHeading()
      .setClass("zettlab-sync-status-heading");
    statusCopy.createEl("p", { text: overview.description });
    const transportBadge = statusTop.createDiv({
      cls: "zettlab-sync-transport-badge",
    });
    const transportIcon = transportBadge.createSpan();
    setIcon(transportIcon, activeTransport === "lan" ? "router" : "globe-2");
    transportBadge.createSpan({ text: dashboard.transport });

    const metrics = statusPanel.createDiv({ cls: "zettlab-sync-metrics" });
    const createMetric = (label: string, value: string, icon: string): void => {
      const metric = metrics.createDiv({ cls: "zettlab-sync-metric" });
      const metricIcon = metric.createDiv({ cls: "zettlab-sync-metric-icon" });
      setIcon(metricIcon, icon);
      const metricCopy = metric.createDiv();
      metricCopy.createSpan({ text: label });
      metricCopy.createEl("strong", { text: value });
    };
    createMetric(
      dashboard.lastSyncLabel,
      formatTime(overview.lastSyncAt),
      overview.state === "needs-attention" ? "circle-alert" : "history"
    );
    createMetric("同步频率", dashboard.schedule, "refresh-cw");
    createMetric("当前通道", dashboard.transport, "network");

    const actions = statusPanel.createDiv({ cls: "zettlab-sync-actions" });
    const actionButtons: HTMLButtonElement[] = [];
    const createActionButton = (
      label: string,
      loadingLabel: string,
      icon: string,
      className: string,
      action: () => Promise<unknown>
    ): void => {
      const button = actions.createEl("button", {
        cls: `zettlab-sync-action ${className}`,
      });
      const buttonIcon = button.createSpan();
      setIcon(buttonIcon, icon);
      const buttonText = button.createSpan({ text: label });
      actionButtons.push(button);
      button.addEventListener("click", () => {
        void (async () => {
          for (const item of actionButtons) item.disabled = true;
          button.addClass("is-loading");
          setIcon(buttonIcon, "loader-circle");
          buttonText.setText(loadingLabel);
          try {
            await action();
          } finally {
            this.display();
          }
        })();
      });
    };
    createActionButton("立即同步", "正在同步", "refresh-cw", "is-primary", () =>
      this.plugin.syncRun("manual")
    );
    createActionButton("检测连接", "正在检测", "activity", "is-secondary", () =>
      this.plugin.testConnection()
    );
    const advancedButton = actions.createEl("button", {
      cls: "zettlab-sync-action is-ghost",
    });
    const advancedIcon = advancedButton.createSpan();
    setIcon(advancedIcon, "sliders-horizontal");
    advancedButton.createSpan({ text: "高级选项" });
    advancedButton.addEventListener("click", () => {
      manualSettings.open = true;
      manualSettings.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const manualSettings = containerEl.createEl("details", {
      cls: "zettlab-sync-advanced",
    });
    const advancedSummary = manualSettings.createEl("summary");
    const advancedSummaryIcon = advancedSummary.createDiv({
      cls: "zettlab-sync-advanced-icon",
    });
    setIcon(advancedSummaryIcon, "settings-2");
    const advancedSummaryCopy = advancedSummary.createDiv({
      cls: "zettlab-sync-advanced-copy",
    });
    advancedSummaryCopy.createEl("strong", { text: "高级选项" });
    advancedSummaryCopy.createSpan({
      text: "连接信息、同步策略与安全保护",
    });
    const advancedChevron = advancedSummary.createDiv({
      cls: "zettlab-sync-advanced-chevron",
    });
    setIcon(advancedChevron, "chevron-down");

    const advancedBody = manualSettings.createDiv({
      cls: "zettlab-sync-advanced-body",
    });
    const privacyNote = advancedBody.createDiv({
      cls: "zettlab-sync-privacy-note",
    });
    const privacyIcon = privacyNote.createSpan();
    setIcon(privacyIcon, "shield-check");
    privacyNote.createSpan({
      text: "一般无需修改。自动关联会安全写入连接信息，密码仅保存在当前 Obsidian 仓库。",
    });

    const createAdvancedSection = (
      title: string,
      description: string,
      icon: string
    ): HTMLDivElement => {
      const section = advancedBody.createDiv({
        cls: "zettlab-sync-advanced-section",
      });
      const sectionHeader = section.createDiv({
        cls: "zettlab-sync-section-header",
      });
      const sectionIcon = sectionHeader.createDiv();
      setIcon(sectionIcon, icon);
      new Setting(sectionHeader)
        .setName(title)
        .setDesc(description)
        .setHeading()
        .setClass("zettlab-sync-section-heading");
      return section.createDiv({ cls: "zettlab-sync-section-content" });
    };

    const connectionSection = createAdvancedSection(
      "连接信息",
      "仅在自动关联不可用或排障时手动修改",
      "link-2"
    );
    const connection = getSettingsConnectionModel(
      this.plugin.settings,
      activeTransport,
      language
    );
    new Setting(connectionSection)
      .setName(localize("settingsConfigMode"))
      .setDesc(connection.modeDescription);
    new Setting(connectionSection)
      .setName(localize("settingsCurrentTransport"))
      .setDesc(connection.transport);

    let lanDraft = connection.lanAddress;
    let setLanInputDisabled = (_disabled: boolean): void => undefined;
    new Setting(connectionSection)
      .setName(localize("settingsLanAddress"))
      .setDesc(localize("settingsLanAddressDescription"))
      .addText((text) => {
        setLanInputDisabled = (disabled) => {
          text.setDisabled(disabled);
        };
        return text
          .setPlaceholder("http://192.168.x.x:9091/dav/")
          .setValue(connection.lanAddress)
          .onChange((value) => {
            lanDraft = value;
          });
      })
      .addButton((button) =>
        button.setButtonText(localize("settingsLanSave")).onClick(async () => {
          button.setDisabled(true);
          setLanInputDisabled(true);
          const requestedLanAddress = lanDraft.trim();
          const attemptRevision = this.manualLanAttempts.begin();
          const previous = this.plugin.settings;
          const previousRevision = this.plugin.getSettingsRevision();
          const result = await prepareManualLanUpdateIfCurrent(
            previous,
            requestedLanAddress,
            obsidianDavProbeRequest,
            () =>
              this.manualLanAttempts.isCurrent(attemptRevision) &&
              this.plugin.settings === previous &&
              this.plugin.getSettingsRevision() === previousRevision
          );
          if (!result.ok) {
            const messageKey: MessageKey =
              result.reason === "invalid_lan"
                ? "settingsLanInvalid"
                : result.reason === "public_required"
                  ? "settingsLanPublicRequired"
                  : result.reason === "stale_configuration"
                    ? "settingsLanStale"
                    : "settingsLanUnreachable";
            new Notice(localize(messageKey));
            if (result.reason === "stale_configuration") {
              if (this.manualLanAttempts.isCurrent(attemptRevision)) {
                this.display();
              }
              return;
            }
            button.setDisabled(false);
            setLanInputDisabled(false);
            return;
          }
          let saveRevision: number | undefined;
          try {
            this.plugin.settings = result.settings;
            this.plugin.clearActiveTransport();
            const savePromise = this.plugin.saveSettings();
            saveRevision = this.plugin.getSettingsRevision();
            await savePromise;
            if (
              !this.manualLanAttempts.isCurrent(attemptRevision) ||
              this.plugin.settings !== result.settings ||
              this.plugin.getSettingsRevision() !== saveRevision
            ) {
              new Notice(localize("settingsLanStale"));
              return;
            }
            new Notice(
              requestedLanAddress === ""
                ? localize("settingsLanCleared")
                : localize("settingsLanSaved")
            );
          } catch (error) {
            console.error("Failed to save manual LAN address", error);
            const ownsFailedSettings = shouldRollbackManualLanSave(
              this.plugin.settings,
              result.settings,
              this.plugin.getSettingsRevision(),
              saveRevision
            );
            if (ownsFailedSettings) {
              this.plugin.settings = previous;
            }
            const attemptStillCurrent =
              this.manualLanAttempts.isCurrent(attemptRevision);
            new Notice(
              localize(
                attemptStillCurrent && ownsFailedSettings
                  ? "settingsLanSaveFailed"
                  : "settingsLanStale"
              )
            );
          } finally {
            if (this.manualLanAttempts.isCurrent(attemptRevision)) {
              this.display();
            }
          }
        })
      );
    new Setting(connectionSection)
      .setName(localize("settingsPublicAddress"))
      .setDesc(localize("settingsPublicAddressDescription"))
      .addText((text) => {
        text
          .setPlaceholder(localize("settingsNotConfigured"))
          .setValue(connection.publicAddress);
        text.inputEl.readOnly = true;
        return text;
      });
    new Setting(connectionSection)
      .setName("App 密码")
      .setDesc("关联时自动生成，仅供当前仓库同步使用")
      .addText((text) => {
        text.inputEl.type = "password";
        return text
          .setValue(this.plugin.settings.webdav.password)
          .onChange(async (value) =>
            saveText(this.plugin, () => {
              this.plugin.settings.webdav.password = value;
            })
          );
      });

    const syncSection = createAdvancedSection(
      "同步策略",
      "控制同步时机与文件冲突处理方式",
      "refresh-cw"
    );
    new Setting(syncSection)
      .setName("自动同步间隔")
      .setDesc("分钟；填 0 关闭定时同步。")
      .addText((text) =>
        text
          .setValue(
            String(this.plugin.settings.autoRunEveryMilliseconds / 60_000)
          )
          .onChange(async (value) => {
            const minutes = Number(value);
            if (!Number.isFinite(minutes) || minutes < 0) {
              new Notice("请输入不小于 0 的分钟数。");
              return;
            }
            await saveText(this.plugin, () => {
              this.plugin.settings.autoRunEveryMilliseconds = minutes * 60_000;
            });
          })
      );
    new Setting(syncSection)
      .setName("保存后同步")
      .setDesc("开启后，保存停止 1 秒会自动同步。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncOnSaveAfterMilliseconds > 0)
          .onChange(async (enabled) =>
            saveText(this.plugin, () => {
              this.plugin.settings.syncOnSaveAfterMilliseconds = enabled
                ? SYNC_ON_SAVE_DELAY_MILLISECONDS
                : -1;
            })
          )
      );
    new Setting(syncSection)
      .setName("冲突处理")
      .setDesc("两端同时修改同一文件时的处理方式。")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("keep_newer", "保留较新版本")
          .addOption("keep_larger", "保留较大版本")
          .setValue(this.plugin.settings.conflictAction)
          .onChange(async (value) =>
            saveText(this.plugin, () => {
              this.plugin.settings.conflictAction = value as ConflictActionType;
            })
          )
      );

    const safetySection = createAdvancedSection(
      "安全与过滤",
      "限制批量变更，并排除不需要同步的文件",
      "shield"
    );
    new Setting(safetySection)
      .setName("批量变更保护")
      .setDesc(
        "本轮修改或删除的文件达到该比例时停止同步。范围 1–100；填写 100 关闭保护。"
      )
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "100";
        text.inputEl.step = "1";
        return text
          .setPlaceholder("50")
          .setValue(String(this.plugin.settings.protectModifyPercentage))
          .onChange(async (value) => {
            const percentage = parseProtectModifyPercentage(value);
            if (percentage === undefined) {
              new Notice("请输入 1–100 之间的整数百分比。");
              return;
            }
            await saveText(this.plugin, () => {
              this.plugin.settings.protectModifyPercentage = percentage;
            });
          });
      });
    new Setting(safetySection)
      .setName("跳过大文件")
      .setDesc("MB；填 0 不跳过任何文件。")
      .addText((text) =>
        text
          .setValue(
            this.plugin.settings.skipSizeLargerThan > 0
              ? String(this.plugin.settings.skipSizeLargerThan / 1024 / 1024)
              : "0"
          )
          .onChange(async (value) => {
            const megabytes = Number(value);
            if (!Number.isFinite(megabytes) || megabytes < 0) {
              new Notice("请输入不小于 0 的文件大小。");
              return;
            }
            await saveText(this.plugin, () => {
              this.plugin.settings.skipSizeLargerThan =
                megabytes > 0 ? megabytes * 1024 * 1024 : -1;
            });
          })
      );
    new Setting(safetySection)
      .setName(localize("settingsIgnoreNodeModules"))
      .setDesc(localize("settingsIgnoreNodeModulesDescription"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.ignoreNodeModules ?? true)
          .onChange(async (enabled) =>
            saveText(this.plugin, () => {
              this.plugin.settings.ignoreNodeModules = enabled;
            })
          )
      );
    new Setting(safetySection)
      .setName("忽略路径规则")
      .setDesc("每行一个正则表达式。")
      .addTextArea((text) =>
        text
          .setValue(this.plugin.settings.ignorePaths.join("\n"))
          .onChange(async (value) =>
            saveText(this.plugin, () => {
              this.plugin.settings.ignorePaths = value
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean);
            })
          )
      );
  }
}
