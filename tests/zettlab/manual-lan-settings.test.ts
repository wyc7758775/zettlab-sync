import assert from "node:assert/strict";
import { describe, it } from "mocha";
import type { DavProbeRequest } from "../../src/davEndpoints";
import {
  MANUAL_LAN_PROBE_TIMEOUT_MS,
  ManualLanAttemptGuard,
  prepareManualLanUpdate,
  prepareManualLanUpdateIfCurrent,
} from "../../src/manualLanSettings";
import { normalizeSettings } from "../../src/settingsModel";

const PUBLIC_ADDRESS = "https://memo.us-drive.zettlab.com/dav/";
const LAN_ADDRESS = "http://192.168.5.30:9091/dav/";

const reachableLan: DavProbeRequest = async (_address, headers, timeoutMs) => {
  assert.ok(timeoutMs > 0 && timeoutMs <= MANUAL_LAN_PROBE_TIMEOUT_MS);
  return headers.Authorization
    ? { status: 207, headers: {} }
    : {
        status: 401,
        headers: { "www-authenticate": 'Basic realm="Zettlab WebDAV"' },
      };
};

describe("manual LAN settings", () => {
  it("strictly rejects invalid and unreachable LAN addresses without mutation", async () => {
    const current = normalizeSettings({
      webdav: { address: PUBLIC_ADDRESS, password: "strong-test-password" },
    });

    const invalid = await prepareManualLanUpdate(
      current,
      "http://8.8.8.8:9091/dav/",
      reachableLan
    );
    assert.equal(invalid.ok, false);
    assert.equal(invalid.settings, current);

    const unreachable = await prepareManualLanUpdate(
      current,
      LAN_ADDRESS,
      async () => null
    );
    assert.deepEqual(unreachable, {
      ok: false,
      reason: "unreachable_lan",
      settings: current,
    });
  });

  it("upgrades legacy public settings while preserving the public address", async () => {
    const current = normalizeSettings({
      webdav: { address: PUBLIC_ADDRESS, password: "strong-test-password" },
    });

    const result = await prepareManualLanUpdate(
      current,
      LAN_ADDRESS,
      reachableLan
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.settings.webdav.address, PUBLIC_ADDRESS);
    assert.deepEqual(result.settings.webdav.zettlabEndpoints, {
      lan: LAN_ADDRESS,
      public: PUBLIC_ADDRESS,
    });
  });

  it("replaces a stale LAN primary when no public endpoint exists", async () => {
    const oldLan = "http://192.168.5.29:9091/dav/";
    const current = normalizeSettings({
      webdav: {
        address: oldLan,
        password: "strong-test-password",
        zettlabEndpoints: { lan: oldLan },
      },
    });

    const result = await prepareManualLanUpdate(
      current,
      LAN_ADDRESS,
      reachableLan
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.settings.webdav.address, LAN_ADDRESS);
    assert.deepEqual(result.settings.webdav.zettlabEndpoints, {
      lan: LAN_ADDRESS,
    });
  });

  it("rejects a successful probe when its configuration guard becomes stale", async () => {
    const current = normalizeSettings({
      webdav: { address: PUBLIC_ADDRESS, password: "strong-test-password" },
    });
    let currentRevision = true;

    const result = await prepareManualLanUpdateIfCurrent(
      current,
      LAN_ADDRESS,
      async (_address, headers) => {
        if (headers.Authorization) {
          currentRevision = false;
          return { status: 207, headers: {} };
        }
        return {
          status: 401,
          headers: { "www-authenticate": 'Basic realm="Zettlab WebDAV"' },
        };
      },
      () => currentRevision
    );

    assert.deepEqual(result, {
      ok: false,
      reason: "stale_configuration",
      settings: current,
    });
  });

  it("clears LAN only when the existing public endpoint remains available", async () => {
    const dual = normalizeSettings({
      webdav: {
        address: LAN_ADDRESS,
        password: "strong-test-password",
        zettlabEndpoints: {
          lan: LAN_ADDRESS,
          public: PUBLIC_ADDRESS,
        },
      },
    });
    const cleared = await prepareManualLanUpdate(dual, "", async () => {
      throw new Error("clearing LAN must not probe or rewrite public");
    });
    assert.equal(cleared.ok, true);
    if (!cleared.ok) return;
    assert.equal(cleared.settings.webdav.address, PUBLIC_ADDRESS);
    assert.deepEqual(cleared.settings.webdav.zettlabEndpoints, {
      public: PUBLIC_ADDRESS,
    });

    const lanOnly = normalizeSettings({
      webdav: {
        address: LAN_ADDRESS,
        password: "strong-test-password",
        zettlabEndpoints: { lan: LAN_ADDRESS },
      },
    });
    const rejected = await prepareManualLanUpdate(lanOnly, "", reachableLan);
    assert.deepEqual(rejected, {
      ok: false,
      reason: "public_required",
      settings: lanOnly,
    });
  });

  it("invalidates an older probe when a newer edit starts", () => {
    const attempts = new ManualLanAttemptGuard();
    const first = attempts.begin();
    const second = attempts.begin();
    assert.equal(attempts.isCurrent(first), false);
    assert.equal(attempts.isCurrent(second), true);
  });
});
