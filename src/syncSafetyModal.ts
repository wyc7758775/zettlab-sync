import { type App, Modal, Setting } from "obsidian";
import type { MessageKey } from "./i18n";
import type {
  ProtectedChangeAction,
  ProtectModifyDetails,
} from "./syncSafety";

type Localize = (
  key: MessageKey,
  values?: Record<string, string>
) => string;

const ACTION_MESSAGE_KEYS: Record<ProtectedChangeAction, MessageKey> = {
  upload: "safetyActionUpload",
  download: "safetyActionDownload",
  delete_local: "safetyActionDeleteLocal",
  delete_remote: "safetyActionDeleteRemote",
  conflict: "safetyActionConflict",
};

class SyncSafetyModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly details: ProtectModifyDetails,
    private readonly localize: Localize,
    private readonly resolve: (continueOnce: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("zettlab-sync-safety-modal");
    contentEl.createEl("h2", { text: this.localize("safetyTitle") });
    contentEl.createEl("p", {
      cls: "zettlab-sync-safety-summary",
      text: this.localize("safetySummary", {
        changed: String(this.details.changed),
        total: String(this.details.total),
        threshold: String(this.details.threshold),
      }),
    });
    contentEl.createEl("p", { text: this.localize("safetyDescription") });

    const stats = contentEl.createDiv({ cls: "zettlab-sync-safety-stats" });
    for (const [action, count] of Object.entries(this.details.actionCounts)) {
      if (count === 0) continue;
      stats.createEl("span", {
        text: `${this.localize(
          ACTION_MESSAGE_KEYS[action as ProtectedChangeAction]
        )} ${count}`,
      });
    }

    const list = contentEl.createEl("ul", {
      cls: "zettlab-sync-safety-list",
    });
    for (const item of this.details.items) {
      const row = list.createEl("li");
      row.createEl("span", {
        cls: "zettlab-sync-safety-action",
        text: this.localize(ACTION_MESSAGE_KEYS[item.action]),
      });
      row.createEl("span", {
        cls: "zettlab-sync-safety-path",
        text: item.path,
      });
    }
    if (this.details.hiddenItemCount > 0) {
      contentEl.createEl("p", {
        text: this.localize("safetyMoreItems", {
          count: String(this.details.hiddenItemCount),
        }),
      });
    }

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText(this.localize("safetyCancel"))
          .setCta()
          .onClick(() => this.finish(false))
      )
      .addButton((button) =>
        button
          .setButtonText(this.localize("safetyContinueOnce"))
          .setWarning()
          .onClick(() => this.finish(true))
      );
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) {
      this.settled = true;
      this.resolve(false);
    }
  }

  private finish(continueOnce: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(continueOnce);
    this.close();
  }
}

export const confirmProtectedChanges = (
  app: App,
  details: ProtectModifyDetails,
  localize: Localize
): Promise<boolean> =>
  new Promise((resolve) => {
    new SyncSafetyModal(app, details, localize, resolve).open();
  });
