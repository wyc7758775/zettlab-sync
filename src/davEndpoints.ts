import type {
  ObsidianDavEndpoints,
  ObsidianDavTransport,
  RemotelySavePluginSettings,
} from "./baseTypes";

const DAV_PATH = "/dav/";
const LAN_PORT = "9091";
const TOTAL_PROBE_TIMEOUT_MS = 3_000;
const LAN_PROBE_TIMEOUT_MS = 1_500;
const ZETTLAB_WEBDAV_REALM = /basic\s+realm="?Zettlab WebDAV"?/i;

export interface DavProbeResponse {
  status: number;
  headers: Record<string, string>;
}

export type DavProbeRequest = (
  address: string,
  headers: Record<string, string>,
  timeoutMs: number
) => Promise<DavProbeResponse | null>;

export interface DavEndpointSelection {
  address: string;
  transport: ObsidianDavTransport;
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isUniqueLocalIpv6(hostname: string): boolean {
  if (!hostname.includes(":")) return false;
  const firstHextet = Number.parseInt(hostname.split(":", 1)[0] ?? "", 16);
  return Number.isFinite(firstHextet) && (firstHextet & 0xfe00) === 0xfc00;
}

function normalizeDavPath(url: URL): boolean {
  if (
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    (url.pathname !== "/dav" && url.pathname !== DAV_PATH)
  ) {
    return false;
  }
  url.pathname = DAV_PATH;
  return true;
}

export function normalizeLanDavAddress(raw: string): string | null {
  if (typeof raw !== "string" || raw.trim() === "" || raw.length > 2_048)
    return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const hostname = stripIpv6Brackets(url.hostname.toLowerCase());
  if (
    url.protocol !== "http:" ||
    url.port !== LAN_PORT ||
    (!isPrivateIpv4(hostname) && !isUniqueLocalIpv6(hostname)) ||
    !normalizeDavPath(url)
  ) {
    return null;
  }
  return url.toString();
}

export function normalizePublicDavAddress(raw: string): string | null {
  if (typeof raw !== "string" || raw.trim() === "" || raw.length > 2_048)
    return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    (url.port !== "" && url.port !== "443") ||
    !hostname.endsWith(".zettlab.com") ||
    !normalizeDavPath(url)
  ) {
    return null;
  }
  return url.toString();
}

export function normalizeZettlabDavEndpoints(
  raw: unknown
): ObsidianDavEndpoints | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { lan?: unknown; public?: unknown };
  const lanRaw = typeof value.lan === "string" ? value.lan.trim() : "";
  const publicRaw = typeof value.public === "string" ? value.public.trim() : "";
  if (value.lan !== undefined && typeof value.lan !== "string") return null;
  if (value.public !== undefined && typeof value.public !== "string")
    return null;
  const lan =
    lanRaw === "" ? undefined : normalizeLanDavAddress(lanRaw) ?? undefined;
  const publicAddress =
    publicRaw === ""
      ? undefined
      : normalizePublicDavAddress(publicRaw) ?? undefined;
  if ((lanRaw !== "" && !lan) || (publicRaw !== "" && !publicAddress))
    return null;
  if (!lan && !publicAddress) return null;
  return {
    ...(lan ? { lan } : {}),
    ...(publicAddress ? { public: publicAddress } : {}),
  };
}

function normalizeLegacyAddress(raw: string): string | null {
  if (typeof raw !== "string" || raw.trim() === "" || raw.length > 2_048)
    return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username !== "" ||
    url.password !== "" ||
    !url.pathname.startsWith("/dav")
  ) {
    return null;
  }
  return url.toString();
}

function basicAuthorization(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${globalThis.btoa(binary)}`;
}

function headerValue(headers: Record<string, string>, name: string): string {
  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === target
  );
  return entry?.[1] ?? "";
}

async function probeAuthenticatedDav(
  address: string,
  username: string,
  password: string,
  timeoutMs: number,
  request: DavProbeRequest
): Promise<boolean> {
  const response = await request(
    address,
    { Authorization: basicAuthorization(username, password) },
    timeoutMs
  );
  return response?.status === 207;
}

async function probeLanDav(
  address: string,
  username: string,
  password: string,
  timeoutMs: number,
  request: DavProbeRequest
): Promise<boolean> {
  const startedAt = Date.now();
  const challenge = await request(
    address,
    {},
    Math.max(1, Math.floor(timeoutMs / 2))
  );
  if (
    challenge?.status !== 401 ||
    !ZETTLAB_WEBDAV_REALM.test(
      headerValue(challenge.headers, "www-authenticate")
    )
  ) {
    return false;
  }
  const remaining = timeoutMs - (Date.now() - startedAt);
  if (remaining <= 0) return false;
  return probeAuthenticatedDav(address, username, password, remaining, request);
}

function inferLegacyTransport(address: string): ObsidianDavTransport {
  if (normalizeLanDavAddress(address)) return "lan";
  if (normalizePublicDavAddress(address)) return "public";
  return "manual";
}

export async function selectDavEndpoint(
  settings: RemotelySavePluginSettings,
  request: DavProbeRequest,
  totalTimeoutMs = TOTAL_PROBE_TIMEOUT_MS
): Promise<DavEndpointSelection | null> {
  const startedAt = Date.now();
  const endpoints = normalizeZettlabDavEndpoints(
    settings.webdav.zettlabEndpoints
  );
  if (!endpoints) {
    const address = normalizeLegacyAddress(settings.webdav.address);
    if (!address) return null;
    const connected = await probeAuthenticatedDav(
      address,
      settings.webdav.username,
      settings.webdav.password,
      totalTimeoutMs,
      request
    );
    return connected
      ? { address, transport: inferLegacyTransport(address) }
      : null;
  }

  if (endpoints.lan) {
    const lanTimeout = endpoints.public
      ? Math.min(LAN_PROBE_TIMEOUT_MS, totalTimeoutMs)
      : totalTimeoutMs;
    if (
      await probeLanDav(
        endpoints.lan,
        settings.webdav.username,
        settings.webdav.password,
        lanTimeout,
        request
      )
    ) {
      return { address: endpoints.lan, transport: "lan" };
    }
  }

  const remaining = totalTimeoutMs - (Date.now() - startedAt);
  if (!endpoints.public || remaining <= 0) return null;
  const connected = await probeAuthenticatedDav(
    endpoints.public,
    settings.webdav.username,
    settings.webdav.password,
    remaining,
    request
  );
  return connected ? { address: endpoints.public, transport: "public" } : null;
}
