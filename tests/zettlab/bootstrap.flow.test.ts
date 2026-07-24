import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  applyBootstrapPayload,
  buildBootstrapClaimRequest,
  buildBootstrapClaimUrl,
  buildBootstrapCompletionRequest,
  buildBootstrapCompletionUrl,
  normalizeBootstrapPayload,
  normalizeDirectBootstrapPayload,
  retryBootstrapConnection,
} from "../../src/bootstrap";
import { DEFAULT_SETTINGS } from "../../src/settingsModel";

const payload = {
  address: "https://device.example.com/dav/",
  username: "sync" as const,
  password: "strong-test-password",
  autoRunEveryMilliseconds: 300_000,
  syncOnSaveAfterMilliseconds: 1_000,
};

describe("PC bootstrap flow", () => {
  it("accepts only a loopback token claim and writes the fixed WebDAV defaults", () => {
    const claim = buildBootstrapClaimUrl({
      token: "a".repeat(43),
      port: "43123",
    });
    assert.equal(claim, `http://127.0.0.1:43123/claim?token=${"a".repeat(43)}`);
    assert.equal(
      buildBootstrapClaimUrl({ token: "short", port: "43123" }),
      null
    );
    assert.equal(
      buildBootstrapClaimUrl({ token: "a".repeat(43), port: "0" }),
      null
    );
    assert.equal(
      buildBootstrapCompletionUrl(
        { token: "a".repeat(43), port: "43123" },
        "ok"
      ),
      `http://127.0.0.1:43123/complete?token=${"a".repeat(43)}&status=ok`
    );

    const normalized = normalizeBootstrapPayload(payload);
    assert.deepEqual(normalized, payload);
    assert.equal(
      normalizeBootstrapPayload({ ...payload, address: "file:///tmp/vault" }),
      null
    );
    assert.equal(
      normalizeBootstrapPayload({ ...payload, username: "admin" }),
      null
    );

    const settings = applyBootstrapPayload(DEFAULT_SETTINGS, payload);
    assert.equal(settings.webdav.address, payload.address);
    assert.equal(settings.webdav.username, "sync");
    assert.equal(settings.webdav.password, payload.password);
    assert.equal(settings.webdav.authType, "basic");
    assert.equal(settings.autoRunEveryMilliseconds, 300_000);
    assert.equal(settings.syncOnSaveAfterMilliseconds, 1_000);

    // Reinstalling Obsidian or asking the client to rewrite the configuration
    // reuses the same credential. Applying that payload again must be a true
    // no-op from the plugin's point of view.
    assert.deepEqual(applyBootstrapPayload(settings, payload), settings);
  });

  it("retries transient tunnel startup failures with bounded backoff", async () => {
    let attempts = 0;
    const waits: number[] = [];
    const connected = await retryBootstrapConnection(
      async () => ++attempts === 3,
      async (milliseconds) => {
        waits.push(milliseconds);
      }
    );

    assert.equal(connected, true);
    assert.equal(attempts, 3);
    assert.deepEqual(waits, [500, 1_000]);
  });
});

describe("mobile bootstrap flow", () => {
  const token = "m".repeat(43);

  it("claims a one-time payload without putting the password in the URI", () => {
    const params = {
      mode: "remote",
      token,
      endpoint: "https://swift-clover.cn-drive.zettlab.com/.zettlab/bootstrap",
    };
    assert.equal(
      buildBootstrapClaimUrl(params),
      `https://swift-clover.cn-drive.zettlab.com/.zettlab/bootstrap/claim?token=${token}`
    );
    assert.equal(
      buildBootstrapCompletionUrl(params, "ok"),
      `https://swift-clover.cn-drive.zettlab.com/.zettlab/bootstrap/complete?token=${token}&status=ok`
    );
    assert.equal(
      buildBootstrapClaimUrl({
        ...params,
        endpoint: "https://evil.example/.zettlab/bootstrap",
      }),
      null
    );
    assert.equal(
      buildBootstrapClaimUrl({
        ...params,
        endpoint: "http://swift-clover.cn-drive.zettlab.com/.zettlab/bootstrap",
      }),
      null
    );
  });

  it("keeps the legacy direct owned-HTTPS hand-off compatible", () => {
    const direct = normalizeDirectBootstrapPayload({
      mode: "direct",
      webdav_addr: "https://swift-clover.cn-drive.zettlab.com/dav/",
      webdav_username: "sync",
      webdav_password: "strong-mobile-password",
      auto_run_every_milliseconds: "300000",
      sync_on_save_after_milliseconds: "1000",
    });
    assert.deepEqual(direct, {
      address: "https://swift-clover.cn-drive.zettlab.com/dav/",
      username: "sync",
      password: "strong-mobile-password",
      autoRunEveryMilliseconds: 300_000,
      syncOnSaveAfterMilliseconds: 1_000,
    });
    assert.equal(
      buildBootstrapClaimRequest({ mode: "direct", token, port: "43123" }),
      null
    );
    assert.equal(
      normalizeDirectBootstrapPayload({
        mode: "direct",
        webdav_addr: "https://evil.example/dav/",
        webdav_username: "sync",
        webdav_password: "strong-mobile-password",
        auto_run_every_milliseconds: "300000",
        sync_on_save_after_milliseconds: "1000",
      }),
      null
    );
    assert.equal(
      normalizeDirectBootstrapPayload({
        mode: "direct",
        webdav_addr: "http://swift-clover.cn-drive.zettlab.com/dav/",
        webdav_username: "sync",
        webdav_password: "strong-mobile-password",
        auto_run_every_milliseconds: "300000",
        sync_on_save_after_milliseconds: "1000",
      }),
      null
    );
  });
});
