import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  type SyncAttemptResult,
  getVerifiedBootstrapEndpoint,
  retryBootstrapFirstSync,
  runBootstrapFirstSyncExclusive,
} from "../../src/bootstrapFirstSync";
import { normalizeSettings } from "../../src/settingsModel";
import { SyncRunGate } from "../../src/syncRunGate";

describe("bootstrap first sync retry", () => {
  it("reuses the exact managed endpoint that the connection probe verified", () => {
    const settings = normalizeSettings({
      webdav: {
        address: "https://memo.us-drive.zettlab.com/dav/",
        password: "strong-test-password",
        zettlabEndpoints: {
          lan: "http://192.168.5.30:9091/dav/",
          public: "https://memo.us-drive.zettlab.com/dav/",
        },
      },
    });

    assert.deepEqual(getVerifiedBootstrapEndpoint(settings, "lan"), {
      address: "http://192.168.5.30:9091/dav/",
      transport: "lan",
    });
    assert.deepEqual(getVerifiedBootstrapEndpoint(settings, "public"), {
      address: "https://memo.us-drive.zettlab.com/dav/",
      transport: "public",
    });
    assert.equal(getVerifiedBootstrapEndpoint(settings), undefined);
  });

  it("returns immediately after a successful verified-endpoint attempt", async () => {
    const endpointReuse: boolean[] = [];
    const waits: number[] = [];

    const result = await retryBootstrapFirstSync(
      async (reuseVerifiedEndpoint) => {
        endpointReuse.push(reuseVerifiedEndpoint);
        return { ok: true };
      },
      async (delay) => {
        waits.push(delay);
      }
    );

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(endpointReuse, [true]);
    assert.deepEqual(waits, []);
  });

  it("does not retry a safety confirmation result", async () => {
    let attempts = 0;
    const safety: SyncAttemptResult = {
      ok: false,
      kind: "safety",
      error: new Error("confirmation required"),
    };

    const result = await retryBootstrapFirstSync(
      async () => {
        attempts += 1;
        return safety;
      },
      async () => undefined
    );

    assert.equal(result, safety);
    assert.equal(attempts, 1);
  });

  it("does not replay a sync-engine failure after writes may have started", async () => {
    let attempts = 0;
    const syncFailure: SyncAttemptResult = {
      ok: false,
      kind: "sync",
      error: new Error("partial DAV write"),
    };

    const result = await retryBootstrapFirstSync(
      async () => {
        attempts += 1;
        return syncFailure;
      },
      async () => undefined
    );

    assert.equal(result, syncFailure);
    assert.equal(attempts, 1);
  });

  it("retries a sync preflight failure before any write can start", async () => {
    let attempts = 0;

    const result = await retryBootstrapFirstSync(
      async () => {
        attempts += 1;
        return attempts === 1
          ? {
              ok: false,
              kind: "preflight",
              error: new Error("remote listing unavailable"),
            }
          : { ok: true };
      },
      async () => undefined
    );

    assert.deepEqual(result, { ok: true });
    assert.equal(attempts, 2);
  });

  it("does not release a gate owned by another sync", async () => {
    const gate = new SyncRunGate();
    assert.equal(gate.tryAcquire(), true);
    let attempted = false;

    const result = await runBootstrapFirstSyncExclusive(
      gate,
      async () => {
        attempted = true;
        return { ok: true };
      },
      async (syncResult) => syncResult.ok
    );

    assert.equal(result, false);
    assert.equal(attempted, false);
    assert.equal(gate.isActive(), true);
    gate.release();
  });
});
