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
import type { DavEndpointSelection } from "./davEndpoints";
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
import { SettingsSaveQueue } from "./settingsSaveQueue";
import { syncer } from "./sync";
import { getSyncOverview, type SyncOverview } from "./syncOverview";
import { SyncRunGate } from "./syncRunGate";
import {
  ProtectModifyError,
  shouldOfferSafetyOverride,
} from "./syncSafety";
import { confirmProtectedChanges } from "./syncSafetyModal";
import {
  applyBootstrapPayload,
  buildBootstrapClaimRequest,
  buildBootstrapCompletionRequest,
  normalizeBootstrapPayload,
  normalizeDirectBootstrapPayload,
  retryBootstrapConnection,
} from "./bootstrap";
import {
  getVerifiedBootstrapEndpoint,
  retryBootstrapFirstSync,
  type SyncAttemptResult,
} from "./bootstrapFirstSync";

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
  private readonly settingsSaveQueue = new SettingsSaveQueue();
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

  async saveSettings(): Promise<number> {
    const persisted = normalConfigToMessy(this.settings);
    const revision = await this.settingsSaveQueue.run(() =>
      this.saveData(persisted)
    );
    this.configureAutoSync();
    return revision;
  }

  getSettingsRevision(): number {
    return this.settingsSaveQueue.revision;
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
      // Reuse the verified endpoint once, then reselect LAN/public on bounded
      // retries so a transient transport failure cannot create a false red
      // state or force the user to run the command palette manually.
      try {
        const verifiedEndpoint = getVerifiedBootstrapEndpoint(
          this.settings,
          this.activeTransport
        );
        const firstSyncResult = await retryBootstrapFirstSync(
          (reuseVerifiedEndpoint) =>
            this.runBootstrapSyncAttempt(
              reuseVerifiedEndpoint ? verifiedEndpoint : undefined
            )
        );
        await this.publishSyncResult("auto_once_init", firstSyncResult);
      } catch (error) {
        // Association has already succeeded. A local sync-state persistence
        // failure must not roll back valid DAV credentials or report the
        // one-time bootstrap session as failed after it was acknowledged.
        console.error("Zettlab bootstrap first sync failed", error);
        this.setStatus(localize("statusSyncFailed"));
        new Notice(localize("syncFailed", { reason: errorMessage(error) }));
      }
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
      return this.publishSyncResult(source, { ok: false, kind: "busy" });
    }
    try {
      let result: SyncAttemptResult;
      try {
        result = await this.syncRunAcquired(source);
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        console.error("Zettlab Sync failed", failure);
        result = { ok: false, kind: "sync", error: failure };
      }
      return await this.publishSyncResult(source, result);
    } finally {
      this.syncRunGate.release();
    }
  }

  private async runBootstrapSyncAttempt(
    preferredEndpoint?: DavEndpointSelection
  ): Promise<SyncAttemptResult> {
    if (this.isSyncing || !this.syncRunGate.tryAcquire()) {
      return { ok: false, kind: "busy" };
    }
    try {
      return await this.syncRunAcquired("auto_once_init", preferredEndpoint);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      console.error("Zettlab Sync failed", failure);
      return { ok: false, kind: "sync", error: failure };
    } finally {
      this.syncRunGate.release();
    }
  }

  private async syncRunAcquired(
    source: SyncTriggerSourceType,
    preferredEndpoint?: DavEndpointSelection
  ): Promise<SyncAttemptResult> {
    if (!this.isConfigured()) {
      return { ok: false, kind: "not_configured" };
    }

    const selected = preferredEndpoint
      ?? await selectDavEndpoint(this.settings, obsidianDavProbeRequest);
    if (!selected) {
      this.activeTransport = undefined;
      return { ok: false, kind: "unreachable" };
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
      this.settings.deleteToWhere,
      this.settings.ignoreNodeModules ?? true
    );
    const remote = getClient(selectedSettings, this.app.vault.getName(), async () => {
      await this.saveSettings();
    });
    const plainRemote = new PlainRemoteFs(remote);
    let failed: Error | undefined;
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
          localize("safetyStoppedReason", {
            changed: String(changed),
            total: String(total),
            threshold: String(threshold),
          }),
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
          failed = error;
          if (!(error instanceof ProtectModifyError)) {
            console.error("Zettlab Sync failed", error);
          }
        },
        undefined,
        undefined,
        undefined,
        shouldOfferSafetyOverride(source)
          ? (details) => confirmProtectedChanges(this.app, details, localize)
          : undefined
      );
    } catch (error) {
      failed = error instanceof Error ? error : new Error(String(error));
      console.error("Zettlab Sync failed", error);
    } finally {
      this.isSyncing = false;
      await plainRemote.closeResources();
    }
    if (failed !== undefined) {
      return failed instanceof ProtectModifyError
        ? { ok: false, kind: "safety", error: failed }
        : { ok: false, kind: "sync", error: failed };
    }
    return { ok: true };
  }

  private async publishSyncResult(
    source: SyncTriggerSourceType,
    result: SyncAttemptResult
  ): Promise<boolean> {
    if (result.ok) {
      this.lastSuccessfulSyncAt = Date.now();
      await upsertLastSuccessSyncTimeByVault(
        this.db,
        this.vaultRandomID,
        this.lastSuccessfulSyncAt
      );
      if (source === "manual") new Notice(localize("syncCompleted"));
      return true;
    }

    if (result.kind === "busy") {
      if (source === "manual") new Notice(localize("syncInProgress"));
      return false;
    }
    if (result.kind === "not_configured") {
      if (source === "manual") new Notice(localize("connectFirst"));
      return false;
    }
    if (
      result.kind === "safety"
      && (source === "manual" || source === "auto_once_init")
    ) {
      this.setStatus(this.statusWithTransport(localize("statusReady")));
      return false;
    }

    this.lastFailedSyncAt = Date.now();
    await upsertLastFailedSyncTimeByVault(
      this.db,
      this.vaultRandomID,
      this.lastFailedSyncAt
    );
    this.setStatus(localize("statusSyncFailed"));
    if (result.kind === "unreachable") {
      new Notice(localize("syncFailed", { reason: localize("noReachableEndpoint") }));
    } else if (result.kind === "sync" && result.error) {
      new Notice(localize("syncFailed", { reason: errorMessage(result.error) }));
    }
    return false;
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
