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
  | "noReachableEndpoint"
  | "commandSyncNow"
  | "commandTestConnection"
  | "ribbonSync"
  | "bootstrapInvalid"
  | "bootstrapRolledBack"
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
    noReachableEndpoint: "Neither the LAN nor public WebDAV address is reachable",
    commandSyncNow: "Sync Zettlab Memo now",
    commandTestConnection: "Test Zettlab Memo service",
    ribbonSync: "Sync Zettlab Memo",
    bootstrapInvalid: "This Zettlab Memo connection request is invalid or expired. Return to Zettlab Memo and retry.",
    bootstrapRolledBack: "Automatic setup failed. Your previous Obsidian settings were restored.",
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
    noReachableEndpoint: "局域网和公网 WebDAV 地址均不可用",
    commandSyncNow: "立即同步 Zettlab Memo",
    commandTestConnection: "检测 Zettlab Memo 服务",
    ribbonSync: "同步 Zettlab Memo",
    bootstrapInvalid: "Zettlab Memo 关联请求无效或已过期，请返回 Zettlab Memo 重试。",
    bootstrapRolledBack: "自动配置失败，已恢复原来的 Obsidian 设置。",
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
    noReachableEndpoint: "區域網路和公網 WebDAV 位址均無法使用",
    commandSyncNow: "立即同步 Zettlab Memo",
    commandTestConnection: "檢測 Zettlab Memo 服務",
    ribbonSync: "同步 Zettlab Memo",
    bootstrapInvalid: "Zettlab Memo 關聯請求無效或已過期，請返回 Zettlab Memo 重試。",
    bootstrapRolledBack: "自動設定失敗，已還原原本的 Obsidian 設定。",
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
  const normalized = (language ?? globalThis.navigator?.language ?? "en")
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
