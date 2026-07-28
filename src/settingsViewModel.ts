import type { ObsidianDavTransport } from "./baseTypes";
import type { SyncOverview } from "./syncOverview";
import { getSyncScheduleSummary } from "./syncOverview";

export type SettingsStatusTone = "success" | "warning" | "neutral";

export type SettingsDashboardModel = {
  tone: SettingsStatusTone;
  icon: string;
  transport: string;
  lastSyncLabel: string;
  schedule: string;
};

export const getSettingsDashboardModel = (
  overview: SyncOverview,
  activeTransport: ObsidianDavTransport | undefined,
  autoRunEveryMilliseconds: number
): SettingsDashboardModel => ({
  tone:
    overview.state === "synced"
      ? "success"
      : overview.state === "needs-attention"
        ? "warning"
        : "neutral",
  icon:
    overview.state === "synced"
      ? "cloud-check"
      : overview.state === "needs-attention"
        ? "triangle-alert"
        : overview.state === "not-configured"
          ? "unplug"
          : "clock-3",
  transport:
    activeTransport === "lan"
      ? "局域网"
      : activeTransport === "public"
        ? "公网"
        : activeTransport === "manual"
          ? "手动地址"
          : "自动选择",
  lastSyncLabel:
    overview.lastSyncAt === undefined
      ? "最近同步"
      : overview.state === "needs-attention"
        ? "最近失败"
        : "上次完成",
  schedule: getSyncScheduleSummary(autoRunEveryMilliseconds),
});
