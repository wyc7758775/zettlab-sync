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
  | "bootstrapRolledBack";

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
