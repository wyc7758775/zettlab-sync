import type { RemotelySavePluginSettings } from "./baseTypes";
import {
  type DavProbeRequest,
  normalizeLanDavAddress,
  normalizePublicDavAddress,
  normalizeZettlabDavEndpoints,
  selectDavEndpoint,
} from "./davEndpoints";
import { normalizeSettings } from "./settingsModel";

export const MANUAL_LAN_PROBE_TIMEOUT_MS = 3_000;

export class ManualLanAttemptGuard {
  private revision = 0;

  begin(): number {
    return ++this.revision;
  }

  isCurrent(revision: number): boolean {
    return revision === this.revision;
  }
}

export type ManualLanUpdateFailure =
  | "invalid_lan"
  | "unreachable_lan"
  | "public_required"
  | "stale_configuration";

export type ManualLanUpdateResult =
  | { ok: true; settings: RemotelySavePluginSettings }
  | {
      ok: false;
      reason: ManualLanUpdateFailure;
      settings: RemotelySavePluginSettings;
    };

const getExistingPublicAddress = (
  settings: RemotelySavePluginSettings
): string | undefined => {
  const endpoints = normalizeZettlabDavEndpoints(
    settings.webdav.zettlabEndpoints
  );
  return (
    endpoints?.public ??
    normalizePublicDavAddress(settings.webdav.address) ??
    undefined
  );
};

export const prepareManualLanUpdate = async (
  current: RemotelySavePluginSettings,
  rawLanAddress: string,
  request: DavProbeRequest
): Promise<ManualLanUpdateResult> => {
  const lanInput = rawLanAddress.trim();
  const publicAddress = getExistingPublicAddress(current);

  if (lanInput === "") {
    if (!publicAddress) {
      return { ok: false, reason: "public_required", settings: current };
    }
    return {
      ok: true,
      settings: normalizeSettings({
        ...current,
        webdav: {
          ...current.webdav,
          address: publicAddress,
          zettlabEndpoints: { public: publicAddress },
        },
      }),
    };
  }

  const lanAddress = normalizeLanDavAddress(lanInput);
  if (!lanAddress) {
    return { ok: false, reason: "invalid_lan", settings: current };
  }

  const probeSettings = normalizeSettings({
    ...current,
    webdav: {
      ...current.webdav,
      address: lanAddress,
      zettlabEndpoints: { lan: lanAddress },
    },
  });
  try {
    const selected = await selectDavEndpoint(
      probeSettings,
      request,
      MANUAL_LAN_PROBE_TIMEOUT_MS
    );
    if (selected?.transport !== "lan") {
      return { ok: false, reason: "unreachable_lan", settings: current };
    }
  } catch {
    return { ok: false, reason: "unreachable_lan", settings: current };
  }

  return {
    ok: true,
    settings: normalizeSettings({
      ...current,
      webdav: {
        ...current.webdav,
        address: normalizePublicDavAddress(current.webdav.address)
          ? publicAddress ?? lanAddress
          : lanAddress,
        zettlabEndpoints: {
          lan: lanAddress,
          ...(publicAddress ? { public: publicAddress } : {}),
        },
      },
    }),
  };
};

export const prepareManualLanUpdateIfCurrent = async (
  current: RemotelySavePluginSettings,
  rawLanAddress: string,
  request: DavProbeRequest,
  isCurrent: () => boolean
): Promise<ManualLanUpdateResult> => {
  const result = await prepareManualLanUpdate(current, rawLanAddress, request);
  return isCurrent()
    ? result
    : {
        ok: false,
        reason: "stale_configuration",
        settings: current,
      };
};
