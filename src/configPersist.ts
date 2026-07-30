import { base64url } from "rfc4648";
import { reverseString } from "./misc";

import type { RemotelySavePluginSettings } from "./baseTypes";

const DEFAULT_README: string =
  "The file contains sensitive info, so DO NOT take screenshot of, copy, or share it to anyone! It's also generated automatically, so do not edit it manually.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * this should accept the result after loadData();
 */
export const messyConfigToNormal = (
  x: unknown
): RemotelySavePluginSettings | null | undefined => {
  if (x === null || x === undefined) {
    return x;
  }
  if (!isRecord(x)) return undefined;
  if (typeof x.readme === "string" && typeof x.d === "string") {
    const decoded: unknown = JSON.parse(
      new TextDecoder().decode(
        base64url.parse(reverseString(x.d), { loose: true })
      )
    );
    return isRecord(decoded)
      ? (decoded as unknown as RemotelySavePluginSettings)
      : undefined;
  }
  return x as unknown as RemotelySavePluginSettings;
};

/**
 * this should accept the result of original config
 */
export const normalConfigToMessy = (
  x: RemotelySavePluginSettings | null | undefined
) => {
  if (x === null || x === undefined) {
    return x;
  }
  const y = {
    readme: DEFAULT_README,
    d: reverseString(
      base64url.stringify(new TextEncoder().encode(JSON.stringify(x)), {
        pad: false,
      })
    ),
  };
  return y;
};
