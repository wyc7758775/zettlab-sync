import type {
  ObsidianDavTransport,
  RemotelySavePluginSettings,
} from "./baseTypes";
import type { DavEndpointSelection } from "./davEndpoints";

export type SyncAttemptFailureKind =
  | "busy"
  | "not_configured"
  | "unreachable"
  | "safety"
  | "sync";

export type SyncAttemptResult =
  | { ok: true }
  | { ok: false; kind: SyncAttemptFailureKind; error?: Error };

export const BOOTSTRAP_FIRST_SYNC_RETRY_DELAYS_MS = [0, 500, 1_000] as const;

export const getVerifiedBootstrapEndpoint = (
  settings: RemotelySavePluginSettings,
  activeTransport?: ObsidianDavTransport
): DavEndpointSelection | undefined => {
  const endpoints = settings.webdav.zettlabEndpoints;
  if (activeTransport === "lan" && endpoints?.lan) {
    return { address: endpoints.lan, transport: "lan" };
  }
  if (activeTransport === "public" && endpoints?.public) {
    return { address: endpoints.public, transport: "public" };
  }
  if (activeTransport && settings.webdav.address) {
    return { address: settings.webdav.address, transport: activeTransport };
  }
  return undefined;
};

const isRetryable = (result: SyncAttemptResult): boolean =>
  !result.ok && ["busy", "unreachable", "sync"].includes(result.kind);

export const retryBootstrapFirstSync = async (
  attempt: (reuseVerifiedEndpoint: boolean) => Promise<SyncAttemptResult>,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds))
): Promise<SyncAttemptResult> => {
  let result: SyncAttemptResult = { ok: false, kind: "sync" };
  for (const [index, delay] of BOOTSTRAP_FIRST_SYNC_RETRY_DELAYS_MS.entries()) {
    if (delay > 0) await wait(delay);
    result = await attempt(index === 0);
    if (result.ok || !isRetryable(result)) return result;
  }
  return result;
};
