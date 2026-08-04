import type {
  ObsidianDavTransport,
  RemotelySavePluginSettings,
} from "./baseTypes";
import {
  normalizeLanDavAddress,
  normalizePublicDavAddress,
  normalizeZettlabDavEndpoints,
} from "./davEndpoints";
import { t, type MessageKey } from "./i18n";
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

export type SettingsConnectionModel = {
  mode: "dual" | "lan-only" | "public-only" | "legacy" | "unconfigured";
  modeLabel: string;
  modeDescription: string;
  lanAddress: string;
  publicAddress: string;
  transport: string;
};

const getTransportLabel = (
  activeTransport: ObsidianDavTransport | undefined,
  language?: string
): string =>
  activeTransport === "lan"
    ? t("transportLan", {}, language)
    : activeTransport === "public"
      ? t("transportPublic", {}, language)
      : activeTransport === "manual"
        ? t("settingsTransportManual", {}, language)
        : t("settingsTransportAutoPending", {}, language);

export const getSettingsConnectionModel = (
  settings: RemotelySavePluginSettings,
  activeTransport: ObsidianDavTransport | undefined,
  language?: string
): SettingsConnectionModel => {
  const endpoints = normalizeZettlabDavEndpoints(
    settings.webdav.zettlabEndpoints
  );
  const legacyAddress = endpoints ? "" : settings.webdav.address.trim();
  const lanAddress =
    endpoints?.lan ?? normalizeLanDavAddress(legacyAddress) ?? "";
  const publicAddress =
    endpoints?.public ?? normalizePublicDavAddress(legacyAddress) ?? "";
  const mode = endpoints
    ? endpoints.lan && endpoints.public
      ? "dual"
      : endpoints.lan
        ? "lan-only"
        : "public-only"
    : legacyAddress
      ? "legacy"
      : "unconfigured";
  const modeKey: MessageKey =
    mode === "dual"
      ? "settingsModeDual"
      : mode === "lan-only"
        ? "settingsModeLanOnly"
        : mode === "public-only"
          ? "settingsModePublicOnly"
          : mode === "legacy"
            ? "settingsModeLegacy"
            : "settingsModeUnconfigured";
  const modeLabel = t(modeKey, {}, language);
  return {
    mode,
    modeLabel,
    modeDescription:
      mode === "legacy"
        ? `${modeLabel} - ${t("settingsLegacyHint", {}, language)}`
        : modeLabel,
    lanAddress,
    publicAddress,
    transport: getTransportLabel(activeTransport, language),
  };
};

export const getSettingsDashboardModel = (
  overview: SyncOverview,
  activeTransport: ObsidianDavTransport | undefined,
  autoRunEveryMilliseconds: number,
  language?: string
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
  transport: getTransportLabel(activeTransport, language),
  lastSyncLabel:
    overview.lastSyncAt === undefined
      ? "最近同步"
      : overview.state === "needs-attention"
        ? "最近失败"
        : "上次完成",
  schedule: getSyncScheduleSummary(autoRunEveryMilliseconds),
});
