import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { applyBootstrapPayload } from "../../src/bootstrap";
import type { DavProbeRequest } from "../../src/davEndpoints";
import {
  prepareManualLanUpdate,
  prepareManualLanUpdateIfCurrent,
} from "../../src/manualLanSettings";
import { normalizeSettings } from "../../src/settingsModel";
import { SettingsSaveQueue } from "../../src/settingsSaveQueue";

const reachableLan: DavProbeRequest = async (_address, headers) =>
  headers.Authorization
    ? { status: 207, headers: {} }
    : {
        status: 401,
        headers: { "www-authenticate": 'Basic realm="Zettlab WebDAV"' },
      };

describe("manual LAN configuration flow", () => {
  it("upgrades legacy, then lets an explicit reassociation replace the override", async () => {
    const publicAddress = "https://memo.us-drive.zettlab.com/dav/";
    const manualLan = "http://192.168.5.30:9091/dav/";
    const reassociatedLan = "http://192.168.5.31:9091/dav/";
    const legacy = normalizeSettings({
      webdav: {
        address: publicAddress,
        password: "strong-test-password",
      },
    });

    const upgraded = await prepareManualLanUpdate(
      legacy,
      manualLan,
      reachableLan
    );
    assert.equal(upgraded.ok, true);
    if (!upgraded.ok) return;
    assert.equal(upgraded.settings.webdav.zettlabEndpoints?.lan, manualLan);
    assert.equal(
      upgraded.settings.webdav.zettlabEndpoints?.public,
      publicAddress
    );

    const reassociated = applyBootstrapPayload(upgraded.settings, {
      protocolVersion: 2,
      address: publicAddress,
      endpoints: { lan: reassociatedLan, public: publicAddress },
      username: "sync",
      password: "strong-test-password",
      autoRunEveryMilliseconds: 300_000,
      syncOnSaveAfterMilliseconds: 1_000,
    });
    assert.deepEqual(reassociated.webdav.zettlabEndpoints, {
      lan: reassociatedLan,
      public: publicAddress,
    });
  });

  it("keeps a reassociation that completes while a manual LAN probe is pending", async () => {
    const publicAddress = "https://memo.us-drive.zettlab.com/dav/";
    const manualLan = "http://192.168.5.30:9091/dav/";
    const reassociatedLan = "http://192.168.5.31:9091/dav/";
    const original = normalizeSettings({
      webdav: {
        address: publicAddress,
        password: "old-test-password",
      },
    });
    let currentSettings = original;
    let revision = 0;
    const capturedRevision = revision;
    let releaseAuthenticatedProbe = (): void => undefined;
    const authenticatedProbeReleased = new Promise<void>((resolve) => {
      releaseAuthenticatedProbe = resolve;
    });
    let markAuthenticatedProbeStarted = (): void => undefined;
    const authenticatedProbeStarted = new Promise<void>((resolve) => {
      markAuthenticatedProbeStarted = resolve;
    });

    const pendingManualUpdate = prepareManualLanUpdateIfCurrent(
      original,
      manualLan,
      async (_address, headers) => {
        if (!headers.Authorization) {
          return {
            status: 401,
            headers: { "www-authenticate": 'Basic realm="Zettlab WebDAV"' },
          };
        }
        markAuthenticatedProbeStarted();
        await authenticatedProbeReleased;
        return { status: 207, headers: {} };
      },
      () => currentSettings === original && revision === capturedRevision
    );

    await authenticatedProbeStarted;
    currentSettings = applyBootstrapPayload(original, {
      protocolVersion: 2,
      address: publicAddress,
      endpoints: { lan: reassociatedLan, public: publicAddress },
      username: "sync",
      password: "new-test-password",
      autoRunEveryMilliseconds: 300_000,
      syncOnSaveAfterMilliseconds: 1_000,
    });
    revision += 1;
    releaseAuthenticatedProbe();

    const manualResult = await pendingManualUpdate;
    assert.equal(manualResult.ok, false);
    if (manualResult.ok) return;
    assert.equal(manualResult.reason, "stale_configuration");
    assert.deepEqual(currentSettings.webdav.zettlabEndpoints, {
      lan: reassociatedLan,
      public: publicAddress,
    });
    assert.equal(currentSettings.webdav.password, "new-test-password");
  });

  it("keeps the reassociation as the last persisted write after a manual save starts", async () => {
    const publicAddress = "https://memo.us-drive.zettlab.com/dav/";
    const manualLan = "http://192.168.5.30:9091/dav/";
    const reassociatedLan = "http://192.168.5.31:9091/dav/";
    const original = normalizeSettings({
      webdav: {
        address: publicAddress,
        password: "old-test-password",
      },
    });
    const manual = await prepareManualLanUpdate(
      original,
      manualLan,
      reachableLan
    );
    assert.equal(manual.ok, true);
    if (!manual.ok) return;
    const reassociated = applyBootstrapPayload(original, {
      protocolVersion: 2,
      address: publicAddress,
      endpoints: { lan: reassociatedLan, public: publicAddress },
      username: "sync",
      password: "new-test-password",
      autoRunEveryMilliseconds: 300_000,
      syncOnSaveAfterMilliseconds: 1_000,
    });
    const queue = new SettingsSaveQueue();
    const firstGate = new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    let persisted = original;
    const firstWrite = queue.run(async () => {
      await firstGate;
      persisted = manual.settings;
    });
    const secondWrite = queue.run(async () => {
      persisted = reassociated;
    });
    await Promise.all([firstWrite, secondWrite]);
    assert.deepEqual(persisted.webdav.zettlabEndpoints, {
      lan: reassociatedLan,
      public: publicAddress,
    });
    assert.equal(persisted.webdav.password, "new-test-password");
  });
});
