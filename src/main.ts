/*
 * Derived from Remotely Save commit 7ca2d192552819777318d9d521dca45450934b4f
 * (Apache-2.0). Modified by Zettlab.
 */
import { getLanguage, Notice, Plugin, requestUrl } from "obsidian";
import type { InternalDBs } from "./localdb";
import type {
  ObsidianDavTransport,
  RemotelySavePluginSettings,
  SyncTriggerSourceType,
} from "./baseTypes";
import { messyConfigToNormal, normalConfigToMessy } from "./configPersist";
import { getClient } from "./fsGetter";
import { selectDavEndpoint } from "./davEndpoints";
import { obsidianDavProbeRequest } from "./obsidianDavProbe";
import { FakeFsLocal } from "./fsLocal";
import { PlainRemoteFs } from "./fsPlain";
import { t, type MessageKey } from "./i18n";
import {
  getLastFailedSyncTimeByVault,
  getLastSuccessSyncTimeByVault,
  prepareDBs,
  upsertLastFailedSyncTimeByVault,
  upsertLastSuccessSyncTimeByVault,
} from "./localdb";
import { ZettlabSyncSettingTab } from "./settings";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settingsModel";
import { syncer } from "./sync";
import { getSyncOverview, type SyncOverview } from "./syncOverview";
import { SyncRunGate } from "./syncRunGate";
import {
  applyBootstrapPayload,
  buildBootstrapClaimRequest,
  buildBootstrapCompletionRequest,
  normalizeBootstrapPayload,
  normalizeDirectBootstrapPayload,
  retryBootstrapConnection,
} from "./bootstrap";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Obsidian's selected UI language can differ from Electron's navigator.language.
const localize = (key: MessageKey, values?: Record<string, string>): string =>
  t(key, values, getLanguage());

export default class ZettlabSyncPlugin extends Plugin {
  settings: RemotelySavePluginSettings = DEFAULT_SETTINGS;
  db!: InternalDBs;
  vaultRandomID = "";
  private isSyncing = false;
  private autoSyncTimer?: number;
  private saveSyncTimer?: number;
  private statusBar?: HTMLElement;
  private lastSuccessfulSyncAt?: number;
  private lastFailedSyncAt?: number;
  private activeTransport?: ObsidianDavTransport;
  private readonly syncRunGate = new SyncRunGate();

  async onload(): Promise<void> {
    await this.loadSettings();
    const prepared = await prepareDBs(
      this.app.vault.getName(),
      this.settings.vaultRandomID ?? "",
      "default"
    );
    this.db = prepared.db;
    this.vaultRandomID = prepared.vaultRandomID;
    this.settings.vaultRandomID = prepared.vaultRandomID;
    const [lastSuccessfulSyncAt, lastFailedSyncAt] = await Promise.all([
      getLastSuccessSyncTimeByVault(this.db, this.vaultRandomID),
      getLastFailedSyncTimeByVault(this.db, this.vaultRandomID),
    ]);
    this.lastSuccessfulSyncAt =
      typeof lastSuccessfulSyncAt === "number" ? lastSuccessfulSyncAt : undefined;
    this.lastFailedSyncAt =
      typeof lastFailedSyncAt === "number" ? lastFailedSyncAt : undefined;

    this.statusBar = this.addStatusBarItem();
    this.setIdleStatus();
    this.addSettingTab(new ZettlabSyncSettingTab(this));
    this.addCommand({
      id: "sync-now",
      name: localize("commandSyncNow"),
      callback: () => void this.syncRun("manual"),
    });
    this.addCommand({
      id: "test-webdav-connection",
      name: localize("commandTestConnection"),
      callback: () => void this.testConnection(),
    });
    this.addRibbonIcon("refresh-cw", localize("ribbonSync"), () => {
      void this.syncRun("manual");
    });
    this.registerObsidianProtocolHandler("zettlab-sync", (params) => {
      void this.bootstrapFromZettlabMemo(params);
    });
    this.registerEvent(
      this.app.vault.on("modify", () => {
        this.scheduleSyncAfterSave();
      })
    );
    this.configureAutoSync();
  }

  onunload(): void {
    if (this.autoSyncTimer !== undefined) window.clearInterval(this.autoSyncTimer);
    if (this.saveSyncTimer !== undefined) window.clearTimeout(this.saveSyncTimer);
  }

  async loadSettings(): Promise<void> {
    const persisted = messyConfigToNormal(await this.loadData());
    this.settings = normalizeSettings(persisted);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(normalConfigToMessy(this.settings));
    this.configureAutoSync();
  }

  async bootstrapFromZettlabMemo(params: Record<string, string>): Promise<boolean> {
    const directPayload = normalizeDirectBootstrapPayload(params);
    const claimRequest = directPayload ? null : buildBootstrapClaimRequest(params);
    const reportCompletion = async (
      status: "ok" | "failed",
      protocolVersion?: 2
    ): Promise<void> => {
      const transport = this.activeTransport === "lan" || this.activeTransport === "public"
        ? this.activeTransport
        : undefined;
      const completionRequest = buildBootstrapCompletionRequest(params, status, {
        ...(protocolVersion === 2 ? { protocolVersion } : {}),
        ...(status === "ok" && transport ? { transport } : {}),
      });
      if (!completionRequest) return;
      try {
        await requestUrl({
          url: completionRequest.url,
          method: completionRequest.method,
          throw: false,
          headers: completionRequest.headers,
        });
      } catch (error) {
        console.error("Zettlab bootstrap completion report failed", error);
      }
    };
    if (!directPayload && !claimRequest) {
      new Notice(localize("bootstrapInvalid"));
      return false;
    }

    let payload = directPayload;
    if (!payload && claimRequest) {
      let rawPayload: unknown;
      try {
        const response = await requestUrl({
          url: claimRequest.url,
          method: claimRequest.method,
          throw: false,
          headers: claimRequest.headers,
        });
        if (response.status !== 200) {
          new Notice(localize("bootstrapInvalid"));
          return false;
        }
        rawPayload = response.json;
      } catch (error) {
        console.error("Zettlab bootstrap claim failed", error);
        new Notice(localize("bootstrapInvalid"));
        return false;
      }
      payload = normalizeBootstrapPayload(rawPayload);
    }

    if (!payload) {
      await reportCompletion("failed");
      new Notice(localize("bootstrapInvalid"));
      return false;
    }
    const previous = this.settings;
    this.settings = applyBootstrapPayload(previous, payload);
    try {
      await this.saveSettings();
      if (!(await retryBootstrapConnection(() => this.testConnection(false)))) {
        this.settings = previous;
        await this.saveSettings();
        this.setIdleStatus();
        await reportCompletion("failed", payload.protocolVersion);
        new Notice(localize("bootstrapRolledBack"));
        return false;
      }
      await reportCompletion("ok", payload.protocolVersion);
      new Notice(localize("connectionSuccess"));
      // Connection is already proven and completion has been acknowledged.
      // A transient first-sync failure must not discard valid credentials; the
      // normal retry/manual sync paths can recover without making the user pair
      // again.
      await this.syncRun("auto_once_init");
      return true;
    } catch (error) {
      console.error("Zettlab bootstrap apply failed", error);
      this.settings = previous;
      await this.saveSettings();
      this.setIdleStatus();
      await reportCompletion("failed", payload.protocolVersion);
      new Notice(localize("bootstrapRolledBack"));
      return false;
    }
  }

  async testConnection(notify = true): Promise<boolean> {
    if (!this.isConfigured()) {
      new Notice(localize("connectFirst"));
      return false;
    }
    const selected = await selectDavEndpoint(this.settings, obsidianDavProbeRequest);
    const connected = selected !== null;
    if (selected) {
      this.activeTransport = selected.transport;
      this.setStatus(this.statusWithTransport(localize("statusReady")));
    } else {
      this.activeTransport = undefined;
      this.setStatus(localize("statusNotConnected"));
    }
    if (notify) {
      new Notice(
        connected
          ? localize("connectionSuccess")
          : localize("connectionFailed", {
              reason: localize("noReachableEndpoint"),
            })
      );
    }
    return connected;
  }

  async syncRun(source: SyncTriggerSourceType): Promise<boolean> {
    if (this.isSyncing || !this.syncRunGate.tryAcquire()) {
      if (source === "manual") new Notice(localize("syncInProgress"));
      return false;
    }
    try {
      return await this.syncRunAcquired(source);
    } finally {
      this.syncRunGate.release();
    }
  }

  private async syncRunAcquired(
    source: SyncTriggerSourceType
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      if (source === "manual") {
        new Notice(localize("connectFirst"));
      }
      return false;
    }

    const selected = await selectDavEndpoint(this.settings, obsidianDavProbeRequest);
    if (!selected) {
      this.activeTransport = undefined;
      const failedAt = Date.now();
      this.lastFailedSyncAt = failedAt;
      await upsertLastFailedSyncTimeByVault(this.db, this.vaultRandomID, failedAt);
      this.setStatus(localize("statusSyncFailed"));
      new Notice(localize("syncFailed", { reason: localize("noReachableEndpoint") }));
      return false;
    }
    this.activeTransport = selected.transport;
    const selectedSettings: RemotelySavePluginSettings = {
      ...this.settings,
      webdav: { ...this.settings.webdav, address: selected.address },
    };

    const local = new FakeFsLocal(
      this.app.vault,
      this.settings.syncConfigDir,
      false,
      this.app.vault.configDir,
      this.manifest.id,
      undefined,
      this.settings.deleteToWhere
    );
    const remote = getClient(selectedSettings, this.app.vault.getName(), async () => {
      await this.saveSettings();
    });
    const plainRemote = new PlainRemoteFs(remote);
    let failed = "";
    try {
      await syncer(
        local,
        remote,
        plainRemote,
        undefined,
        this.db,
        source,
        "default",
        this.vaultRandomID,
        this.app.vault.configDir,
        selectedSettings,
        (threshold: number, changed: number, total: number) =>
          `Stopped: ${changed}/${total} files would change, above the ${threshold}% safety limit.`,
        (isSyncing) => {
          this.isSyncing = isSyncing;
          this.setStatus(
            this.statusWithTransport(
              isSyncing ? localize("statusSyncing") : localize("statusReady")
            )
          );
        },
        undefined,
        async (_trigger, error) => {
          failed = errorMessage(error);
          console.error("Zettlab Sync failed", error);
        }
      );
    } catch (error) {
      failed = errorMessage(error);
      console.error("Zettlab Sync failed", error);
    } finally {
      this.isSyncing = false;
      await plainRemote.closeResources();
    }
    if (failed !== "") {
      this.lastFailedSyncAt = Date.now();
      await upsertLastFailedSyncTimeByVault(
        this.db,
        this.vaultRandomID,
        this.lastFailedSyncAt
      );
      this.setStatus(localize("statusSyncFailed"));
      new Notice(localize("syncFailed", { reason: failed }));
      return false;
    } else {
      this.lastSuccessfulSyncAt = Date.now();
      await upsertLastSuccessSyncTimeByVault(
        this.db,
        this.vaultRandomID,
        this.lastSuccessfulSyncAt
      );
      if (source === "manual") new Notice(localize("syncCompleted"));
      return true;
    }
  }

  isConfigured(): boolean {
    return /^https?:\/\/.+/.test(this.settings.webdav.address)
      || Boolean(
        this.settings.webdav.zettlabEndpoints?.lan
        || this.settings.webdav.zettlabEndpoints?.public
      );
  }

  getActiveTransport(): ObsidianDavTransport | undefined {
    return this.activeTransport;
  }

  clearActiveTransport(): void {
    this.activeTransport = undefined;
  }

  private statusWithTransport(status: string): string {
    if (this.activeTransport === "lan") return `${status} · ${localize("transportLan")}`;
    if (this.activeTransport === "public") return `${status} · ${localize("transportPublic")}`;
    return status;
  }

  private setIdleStatus(): void {
    this.setStatus(localize(this.isConfigured() ? "statusReady" : "statusNotConnected"));
  }

  getSyncOverview(): SyncOverview {
    return getSyncOverview({
      configured: this.isConfigured(),
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      lastFailedSyncAt: this.lastFailedSyncAt,
    });
  }

  private configureAutoSync(): void {
    if (this.autoSyncTimer !== undefined) {
      window.clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = undefined;
    }
    if (this.settings.autoRunEveryMilliseconds > 0) {
      this.autoSyncTimer = window.setInterval(() => {
        void this.syncRun("auto");
      }, this.settings.autoRunEveryMilliseconds);
    }
  }

  private scheduleSyncAfterSave(): void {
    if (
      this.settings.syncOnSaveAfterMilliseconds <= 0 ||
      this.isSyncing ||
      this.syncRunGate.isActive()
    )
      return;
    if (this.saveSyncTimer !== undefined) window.clearTimeout(this.saveSyncTimer);
    this.saveSyncTimer = window.setTimeout(() => {
      this.saveSyncTimer = undefined;
      void this.syncRun("auto_sync_on_save");
    }, this.settings.syncOnSaveAfterMilliseconds);
  }

  private setStatus(text: string): void {
    if (this.settings.enableStatusBarInfo && this.statusBar !== undefined) {
      this.statusBar.textContent = `Zettlab Memo: ${text}`;
    }
  }
}
