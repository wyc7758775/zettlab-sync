import type { RemotelySavePluginSettings } from "./baseTypes";
import { normalizeSettings } from "./settingsModel";

export interface ZettlabBootstrapPayload {
  address: string;
  username: "sync";
  password: string;
  autoRunEveryMilliseconds: number;
  syncOnSaveAfterMilliseconds: number;
}

export interface BootstrapRequest {
  mode: "desktop";
  url: string;
  method: "GET";
  headers: Record<string, string>;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const CONNECTION_RETRY_DELAYS_MS = [0, 500, 1_000, 2_000, 4_000, 4_000, 4_000] as const;

export const retryBootstrapConnection = async (
  check: () => Promise<boolean>,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds))
): Promise<boolean> => {
  for (const delay of CONNECTION_RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    if (await check()) return true;
  }
  return false;
};

const parseDesktopEndpoint = (
  params: Record<string, string>
): { token: string; port: number } | null => {
  if (params.mode === "direct") return null;
  const token = params.token ?? "";
  const port = Number(params.port);
  if (!TOKEN_PATTERN.test(token) || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  return { token, port };
};

export const normalizeDirectBootstrapPayload = (
  params: Record<string, string>
): ZettlabBootstrapPayload | null => {
  if (params.mode !== "direct") return null;
  const payload = normalizeBootstrapPayload({
    address: params.webdav_addr,
    username: params.webdav_username,
    password: params.webdav_password,
    autoRunEveryMilliseconds: Number(params.auto_run_every_milliseconds),
    syncOnSaveAfterMilliseconds: Number(params.sync_on_save_after_milliseconds),
  });
  if (!payload) return null;
  const address = new URL(payload.address);
  const host = address.hostname.toLowerCase();
  if (
    address.protocol !== "https:" ||
    (host !== "zettlab.com" && !host.endsWith(".zettlab.com")) ||
    (address.port !== "" && address.port !== "443") ||
    (address.pathname !== "/dav" && address.pathname !== "/dav/") ||
    address.search !== "" ||
    address.hash !== ""
  ) {
    return null;
  }
  return payload;
};

export const buildBootstrapClaimUrl = (
  params: Record<string, string>
): string | null => {
  const endpoint = parseDesktopEndpoint(params);
  if (!endpoint) return null;
  return `http://127.0.0.1:${endpoint.port}/claim?token=${encodeURIComponent(endpoint.token)}`;
};

export const buildBootstrapCompletionUrl = (
  params: Record<string, string>,
  status: "ok" | "failed"
): string | null => {
  const endpoint = parseDesktopEndpoint(params);
  if (!endpoint) return null;
  return `http://127.0.0.1:${endpoint.port}/complete?token=${encodeURIComponent(endpoint.token)}&status=${status}`;
};

export const buildBootstrapClaimRequest = (
  params: Record<string, string>
): BootstrapRequest | null => {
  const desktopUrl = buildBootstrapClaimUrl(params);
  if (!desktopUrl) return null;
  return {
    mode: "desktop",
    url: desktopUrl,
    method: "GET",
    headers: { "Cache-Control": "no-store" },
  };
};

export const buildBootstrapCompletionRequest = (
  params: Record<string, string>,
  status: "ok" | "failed"
): BootstrapRequest | null => {
  const desktopUrl = buildBootstrapCompletionUrl(params, status);
  if (!desktopUrl) return null;
  return {
    mode: "desktop",
    url: desktopUrl,
    method: "GET",
    headers: { "Cache-Control": "no-store" },
  };
};

export const normalizeBootstrapPayload = (raw: unknown): ZettlabBootstrapPayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<ZettlabBootstrapPayload>;
  if (value.username !== "sync") return null;
  if (
    typeof value.password !== "string" ||
    value.password.length < 12 ||
    value.password.length > 512
  ) {
    return null;
  }
  if (
    value.autoRunEveryMilliseconds !== 300_000 ||
    value.syncOnSaveAfterMilliseconds !== 1_000 ||
    typeof value.address !== "string" ||
    value.address.length > 2_048
  ) {
    return null;
  }

  let address: URL;
  try {
    address = new URL(value.address);
  } catch {
    return null;
  }
  if (
    !["http:", "https:"].includes(address.protocol) ||
    address.username !== "" ||
    address.password !== "" ||
    !address.pathname.startsWith("/dav")
  ) {
    return null;
  }
  return {
    address: address.toString(),
    username: "sync",
    password: value.password,
    autoRunEveryMilliseconds: value.autoRunEveryMilliseconds,
    syncOnSaveAfterMilliseconds: value.syncOnSaveAfterMilliseconds,
  };
};

export const applyBootstrapPayload = (
  current: RemotelySavePluginSettings,
  payload: ZettlabBootstrapPayload
): RemotelySavePluginSettings =>
  normalizeSettings({
    ...current,
    webdav: {
      ...current.webdav,
      address: payload.address,
      username: "sync",
      password: payload.password,
      authType: "basic",
    },
    serviceType: "webdav",
    autoRunEveryMilliseconds: payload.autoRunEveryMilliseconds,
    syncOnSaveAfterMilliseconds: payload.syncOnSaveAfterMilliseconds,
  });
