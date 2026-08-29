import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  type SyncAttemptResult,
  getVerifiedBootstrapEndpoint,
  retryBootstrapFirstSync,
} from "../../src/bootstrapFirstSync";
import { normalizeSettings } from "../../src/settingsModel";

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
});
