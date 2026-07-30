import { requestUrl } from "obsidian";
import type { DavProbeRequest } from "./davEndpoints";

/** Obsidian runtime adapter for the otherwise pure endpoint selector. */
export const obsidianDavProbeRequest: DavProbeRequest = async (
  address,
  headers,
  timeoutMs
) => {
  let timer: number | undefined;
  const request = requestUrl({
    url: address,
    method: "PROPFIND",
    throw: false,
    headers: { Depth: "0", ...headers },
  })
    .then((response) => ({
      status: response.status,
      headers: response.headers,
    }))
    .catch(() => null);
  try {
    return await Promise.race([
      request,
      new Promise<null>((resolve) => {
        timer = window.setTimeout(
          () => resolve(null),
          Math.max(1, timeoutMs)
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
};
