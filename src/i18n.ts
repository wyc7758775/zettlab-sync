/*
 * Derived from Remotely Save commit 7ca2d192552819777318d9d521dca45450934b4f
 * (Apache-2.0). Modified by Zettlab.
 */
type Locale = "en" | "zh_CN" | "zh_TW";

export type MessageKey =
  | "connectionSuccess"
  | "connectionFailed"
  | "unknownError"
  | "connectFirst"
  | "syncInProgress"
  | "syncCompleted"
  | "syncFailed"
  | "statusReady"
  | "statusNotConnected"
  | "statusSyncing"
  | "statusSyncFailed"
  | "transportLan"
  | "transportPublic"
  | "settingsTransportManual"
  | "settingsTransportAutoPending"
  | "settingsModeDual"
  | "settingsModeLanOnly"
  | "settingsModePublicOnly"
  | "settingsModeLegacy"
  | "settingsModeUnconfigured"
  | "settingsLegacyHint"
  | "settingsConfigMode"
  | "settingsCurrentTransport"
  | "settingsLanAddress"
  | "settingsLanAddressDescription"
  | "settingsLanSave"
  | "settingsLanInvalid"
  | "settingsLanPublicRequired"
  | "settingsLanUnreachable"
  | "settingsLanStale"
  | "settingsLanCleared"
  | "settingsLanSaved"
  | "settingsLanSaveFailed"
  | "settingsPublicAddress"
  | "settingsPublicAddressDescription"
  | "settingsNotConfigured"
  | "settingsIgnoreNodeModules"
  | "settingsIgnoreNodeModulesDescription"
  | "noReachableEndpoint"
  | "commandSyncNow"
  | "commandTestConnection"
  | "ribbonSync"
  | "bootstrapInvalid"
  | "bootstrapRolledBack"
  | "bootstrapSavedOffline"
  | "statusSyncBlocked"
  | "remotelySaveConflict"
  | "remotelySaveDisabled"
  | "settingsConflictTitle"
  | "settingsConflictDisableAction"
  | "emptySideStoppedReason"
  | "safetyStoppedReason"
  | "safetyTitle"
  | "safetySummary"
  | "safetyDescription"
  | "safetyCancel"
  | "safetyContinueOnce"
  | "safetyMoreItems"
  | "safetyActionUpload"
  | "safetyActionDownload"
  | "safetyActionDeleteLocal"
  | "safetyActionDeleteRemote"
  | "safetyActionConflict";

const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  en: {
    connectionSuccess: "Zettlab Memo service connected.",
    connectionFailed: "Zettlab Memo service connection failed: {{reason}}",
    unknownError: "Unknown error",
    connectFirst:
      "Connect Zettlab Memo first, or enter the address and app password in Manual connection.",
    syncInProgress: "Zettlab Memo is already syncing. Please wait.",
    syncCompleted: "Zettlab Memo sync completed.",
    syncFailed: "Zettlab Memo sync failed: {{reason}}",
    statusReady: "Ready",
    statusNotConnected: "Not connected",
    statusSyncing: "Syncing…",
    statusSyncFailed: "Sync failed",
    transportLan: "LAN",
    transportPublic: "Public network",
    settingsTransportManual: "Manual address",
    settingsTransportAutoPending: "Automatic / awaiting probe",
    settingsModeDual: "v2 LAN + public",
    settingsModeLanOnly: "v2 LAN only",
    settingsModePublicOnly: "v2 public only",
    settingsModeLegacy: "Legacy single address",
    settingsModeUnconfigured: "Not configured",
    settingsLegacyHint:
      "Reassociate from Zettlab Memo, or enter a LAN address below, to enable automatic LAN/public selection.",
    settingsConfigMode: "Configuration mode",
    settingsCurrentTransport: "Current transport",
    settingsLanAddress: "LAN address",
    settingsLanAddressDescription:
      "Only a private address shown by Memo is accepted. It is verified within 3 seconds before saving.",
    settingsLanSave: "Verify and save",
    settingsLanInvalid:
      "The LAN address is invalid. Use the address shown by Memo.",
    settingsLanPublicRequired:
      "A public address is required before the LAN address can be cleared.",
    settingsLanUnreachable:
      "The LAN address is currently unreachable. The previous configuration was kept.",
    settingsLanStale:
      "The configuration changed during verification. The LAN edit was not saved.",
    settingsLanCleared:
      "LAN address cleared. Future syncs will continue over the public address.",
    settingsLanSaved: "LAN address verified and saved.",
    settingsLanSaveFailed: "Save failed. The previous configuration was kept.",
    settingsPublicAddress: "Public address",
    settingsPublicAddressDescription:
      "Written by Zettlab Memo automatic setup. Read-only and available to copy.",
    settingsNotConfigured: "Not configured",
    settingsIgnoreNodeModules: "Ignore node_modules",
    settingsIgnoreNodeModulesDescription:
      "Ignore node_modules directories and their contents at every depth by default.",
    noReachableEndpoint: "Neither the LAN nor public WebDAV address is reachable",
    commandSyncNow: "Sync Zettlab Memo now",
    commandTestConnection: "Test Zettlab Memo service",
    ribbonSync: "Sync Zettlab Memo",
    bootstrapInvalid: "This Zettlab Memo connection request is invalid or expired. Return to Zettlab Memo and retry.",
    bootstrapRolledBack: "Automatic setup failed. Your previous Obsidian settings were restored.",
    bootstrapSavedOffline: "Obsidian settings were updated. The service is temporarily unreachable; sync will retry later.",
    statusSyncBlocked: "Sync blocked",
    remotelySaveConflict: "Remotely Save is enabled. Disable it before using Zettlab Sync.",
    remotelySaveDisabled: "Remotely Save was disabled to prevent concurrent vault changes.",
    settingsConflictTitle: "Sync is blocked",
    settingsConflictDisableAction: "Disable Remotely Save",
    emptySideStoppedReason:
      "One side of the vault became empty; deletion was blocked. Restore the missing side before syncing again; deliberate clearing requires an explicit reset flow.",
    safetyStoppedReason: "{{changed}} of {{total}} files reached the {{threshold}}% safety limit",
    safetyTitle: "Review sync changes",
    safetySummary: "{{changed}} of {{total}} files would change, reaching the {{threshold}}% safety limit.",
    safetyDescription: "Review the files below. Continuing applies this sync plan once and does not change your safety setting.",
    safetyCancel: "Cancel sync",
    safetyContinueOnce: "Continue once",
    safetyMoreItems: "{{count}} more files are not shown.",
    safetyActionUpload: "Upload update",
    safetyActionDownload: "Download update",
    safetyActionDeleteLocal: "Delete locally",
    safetyActionDeleteRemote: "Delete from Memo",
    safetyActionConflict: "Resolve conflict",
  },
  zh_CN: {
    connectionSuccess: "Zettlab Memo 服务关联成功",
    connectionFailed: "Zettlab Memo 服务关联失败：{{reason}}",
    unknownError: "未知错误",
    connectFirst: "请先完成 Zettlab Memo 服务关联，或在手动接入中填写地址和 App 密码。",
    syncInProgress: "Zettlab Memo 正在同步，请稍候。",
    syncCompleted: "Zettlab Memo 同步完成。",
    syncFailed: "Zettlab Memo 同步失败：{{reason}}",
    statusReady: "已就绪",
    statusNotConnected: "未关联",
    statusSyncing: "正在同步…",
    statusSyncFailed: "同步失败",
    transportLan: "局域网",
    transportPublic: "公网",
    settingsTransportManual: "手动地址",
    settingsTransportAutoPending: "自动选择 / 待检测",
    settingsModeDual: "v2 双地址",
    settingsModeLanOnly: "v2 仅局域网",
    settingsModePublicOnly: "v2 仅公网",
    settingsModeLegacy: "旧版单地址",
    settingsModeUnconfigured: "未配置",
    settingsLegacyHint:
      "请从 Zettlab Memo 重新关联，或在下方填写局域网地址，以启用局域网/公网自动选择。",
    settingsConfigMode: "配置模式",
    settingsCurrentTransport: "当前通道",
    settingsLanAddress: "局域网地址",
    settingsLanAddressDescription:
      "仅接受 Memo 展示的私网地址；保存前会在 3 秒内完成验证。",
    settingsLanSave: "验证并保存",
    settingsLanInvalid: "局域网地址格式不正确，请使用 Memo 展示的地址。",
    settingsLanPublicRequired: "没有可用的公网地址，不能清空局域网地址。",
    settingsLanUnreachable: "局域网地址暂时无法连接，原配置未修改。",
    settingsLanStale: "验证期间配置已变更，本次局域网编辑未保存。",
    settingsLanCleared: "局域网地址已清空，后续同步继续使用公网。",
    settingsLanSaved: "局域网地址已验证并保存。",
    settingsLanSaveFailed: "保存失败，原配置未修改。",
    settingsPublicAddress: "公网地址",
    settingsPublicAddressDescription: "由 Memo 自动关联写入，只读且可复制。",
    settingsNotConfigured: "未配置",
    settingsIgnoreNodeModules: "忽略 node_modules",
    settingsIgnoreNodeModulesDescription:
      "默认忽略所有层级的 node_modules 目录及其内容。",
    noReachableEndpoint: "局域网和公网 WebDAV 地址均不可用",
    commandSyncNow: "立即同步 Zettlab Memo",
    commandTestConnection: "检测 Zettlab Memo 服务",
    ribbonSync: "同步 Zettlab Memo",
    bootstrapInvalid: "Zettlab Memo 关联请求无效或已过期，请返回 Zettlab Memo 重试。",
    bootstrapRolledBack: "自动配置失败，已恢复原来的 Obsidian 设置。",
    bootstrapSavedOffline: "Obsidian 配置已更新，但服务暂时无法连接，后续同步会自动重试。",
    statusSyncBlocked: "同步已阻止",
    remotelySaveConflict: "检测到 Remotely Save 已启用，请先停用它，再使用 Zettlab Sync。",
    remotelySaveDisabled: "已停用 Remotely Save，避免多个同步插件同时修改仓库。",
    settingsConflictTitle: "同步已被阻止",
    settingsConflictDisableAction: "停用 Remotely Save",
    emptySideStoppedReason:
      "检测到一端文件突然为空，已阻止删除。请先恢复缺失的一端再同步；如需故意清空整库，应使用明确的重置流程。",
    safetyStoppedReason: "{{changed}}/{{total}} 个文件达到 {{threshold}}% 安全阈值",
    safetyTitle: "确认本次同步变更",
    safetySummary: "预计变更 {{changed}}/{{total}} 个文件，已达到 {{threshold}}% 安全阈值。",
    safetyDescription: "请核对以下文件。继续只对本次同步生效，不会修改长期安全设置。",
    safetyCancel: "取消同步",
    safetyContinueOnce: "仅本次继续",
    safetyMoreItems: "另有 {{count}} 个文件未显示。",
    safetyActionUpload: "上传更新",
    safetyActionDownload: "下载更新",
    safetyActionDeleteLocal: "删除本地",
    safetyActionDeleteRemote: "删除 Memo 端",
    safetyActionConflict: "处理冲突",
  },
  zh_TW: {
    connectionSuccess: "Zettlab Memo 服務關聯成功",
    connectionFailed: "Zettlab Memo 服務關聯失敗：{{reason}}",
    unknownError: "未知錯誤",
    connectFirst: "請先完成 Zettlab Memo 服務關聯，或在手動接入中填寫位址和 App 密碼。",
    syncInProgress: "Zettlab Memo 正在同步，請稍候。",
    syncCompleted: "Zettlab Memo 同步完成。",
    syncFailed: "Zettlab Memo 同步失敗：{{reason}}",
    statusReady: "已就緒",
    statusNotConnected: "未關聯",
    statusSyncing: "正在同步…",
    statusSyncFailed: "同步失敗",
    transportLan: "區域網路",
    transportPublic: "公網",
    settingsTransportManual: "手動位址",
    settingsTransportAutoPending: "自動選擇 / 等待檢測",
    settingsModeDual: "v2 雙位址",
    settingsModeLanOnly: "v2 僅區域網路",
    settingsModePublicOnly: "v2 僅公網",
    settingsModeLegacy: "舊版單一位址",
    settingsModeUnconfigured: "未設定",
    settingsLegacyHint:
      "請從 Zettlab Memo 重新關聯，或在下方填寫區域網路位址，以啟用區域網路/公網自動選擇。",
    settingsConfigMode: "設定模式",
    settingsCurrentTransport: "目前通道",
    settingsLanAddress: "區域網路位址",
    settingsLanAddressDescription:
      "僅接受 Memo 顯示的私有網路位址；儲存前會在 3 秒內完成驗證。",
    settingsLanSave: "驗證並儲存",
    settingsLanInvalid: "區域網路位址格式不正確，請使用 Memo 顯示的位址。",
    settingsLanPublicRequired: "沒有可用的公網位址，無法清除區域網路位址。",
    settingsLanUnreachable: "區域網路位址目前無法連線，原設定未修改。",
    settingsLanStale: "驗證期間設定已變更，本次區域網路編輯未儲存。",
    settingsLanCleared: "區域網路位址已清除，後續同步將繼續使用公網。",
    settingsLanSaved: "區域網路位址已驗證並儲存。",
    settingsLanSaveFailed: "儲存失敗，原設定未修改。",
    settingsPublicAddress: "公網位址",
    settingsPublicAddressDescription: "由 Memo 自動關聯寫入，唯讀且可複製。",
    settingsNotConfigured: "未設定",
    settingsIgnoreNodeModules: "忽略 node_modules",
    settingsIgnoreNodeModulesDescription:
      "預設忽略所有層級的 node_modules 目錄及其內容。",
    noReachableEndpoint: "區域網路和公網 WebDAV 位址均無法使用",
    commandSyncNow: "立即同步 Zettlab Memo",
    commandTestConnection: "檢測 Zettlab Memo 服務",
    ribbonSync: "同步 Zettlab Memo",
    bootstrapInvalid: "Zettlab Memo 關聯請求無效或已過期，請返回 Zettlab Memo 重試。",
    bootstrapRolledBack: "自動設定失敗，已還原原本的 Obsidian 設定。",
    bootstrapSavedOffline: "Obsidian 設定已更新，但服務暫時無法連線，後續同步會自動重試。",
    statusSyncBlocked: "同步已阻止",
    remotelySaveConflict: "偵測到 Remotely Save 已啟用，請先停用它，再使用 Zettlab Sync。",
    remotelySaveDisabled: "已停用 Remotely Save，避免多個同步插件同時修改資料庫。",
    settingsConflictTitle: "同步已被阻止",
    settingsConflictDisableAction: "停用 Remotely Save",
    emptySideStoppedReason:
      "偵測到一端檔案突然為空，已阻止刪除。請先恢復缺失的一端再同步；如需故意清空整庫，應使用明確的重設流程。",
    safetyStoppedReason: "{{changed}}/{{total}} 個檔案達到 {{threshold}}% 安全門檻",
    safetyTitle: "確認本次同步變更",
    safetySummary: "預計變更 {{changed}}/{{total}} 個檔案，已達到 {{threshold}}% 安全門檻。",
    safetyDescription: "請核對以下檔案。繼續只對本次同步生效，不會修改長期安全設定。",
    safetyCancel: "取消同步",
    safetyContinueOnce: "僅本次繼續",
    safetyMoreItems: "另有 {{count}} 個檔案未顯示。",
    safetyActionUpload: "上傳更新",
    safetyActionDownload: "下載更新",
    safetyActionDeleteLocal: "刪除本機",
    safetyActionDeleteRemote: "刪除 Memo 端",
    safetyActionConflict: "處理衝突",
  },
};

export const getLocale = (language?: string): Locale => {
  const normalized = (language ?? "en")
    .toLowerCase()
    .replace("-", "_");
  if (normalized.startsWith("zh_tw") || normalized.startsWith("zh_hk")) {
    return "zh_TW";
  }
  if (normalized.startsWith("zh")) return "zh_CN";
  return "en";
};

export const t = (
  key: MessageKey,
  values: Record<string, string> = {},
  language?: string
): string =>
  MESSAGES[getLocale(language)][key].replace(
    /{{(\w+)}}/g,
    (_placeholder, name: string) => values[name] ?? ""
  );
