import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  retryBootstrapFirstSync,
  runBootstrapFirstSyncExclusive,
} from "../../src/bootstrapFirstSync";
import { SyncRunGate } from "../../src/syncRunGate";

describe("bootstrap first sync recovery flow", () => {
  it("reselects LAN/public after a transient first failure and succeeds silently", async () => {
    const endpointReuse: boolean[] = [];
    const waits: number[] = [];
    let attempt = 0;

    const result = await retryBootstrapFirstSync(
      async (reuseVerifiedEndpoint) => {
        endpointReuse.push(reuseVerifiedEndpoint);
        attempt += 1;
        if (attempt === 1) {
          return {
            ok: false,
            kind: "preflight",
            error: new Error("DAV warming up before writes"),
          };
        }
        if (attempt === 2) return { ok: false, kind: "unreachable" };
        return { ok: true };
      },
      async (delay) => {
        waits.push(delay);
      }
    );

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(endpointReuse, [true, false, false]);
    assert.deepEqual(waits, [500, 1_000]);
  });

  it("holds one sync gate across retry backoff and result publication", async () => {
    const gate = new SyncRunGate();
    let attempts = 0;
    let published = false;

    const result = await runBootstrapFirstSyncExclusive(
      gate,
      async () => {
        attempts += 1;
        return attempts === 1
          ? { ok: false, kind: "unreachable" }
          : { ok: true };
      },
      async (syncResult) => {
        assert.equal(gate.tryAcquire(), false);
        published = true;
        return syncResult.ok;
      },
      async () => {
        assert.equal(gate.tryAcquire(), false);
      }
    );

    assert.equal(result, true);
    assert.equal(attempts, 2);
    assert.equal(published, true);
    assert.equal(gate.isActive(), false);
    assert.equal(gate.tryAcquire(), true);
    gate.release();
  });

  it("releases the sync gate when an exclusive bootstrap attempt throws", async () => {
    const gate = new SyncRunGate();

    await assert.rejects(
      runBootstrapFirstSyncExclusive(
        gate,
        async () => {
          throw new Error("unexpected bootstrap failure");
        },
        async (syncResult) => syncResult.ok,
        async () => undefined
      ),
      /unexpected bootstrap failure/
    );

    assert.equal(gate.isActive(), false);
  });

  it("stops after the bounded retry budget and returns the final failure", async () => {
    const waits: number[] = [];
    let attempts = 0;

    const result = await retryBootstrapFirstSync(
      async () => {
        attempts += 1;
        return { ok: false, kind: "unreachable" };
      },
      async (delay) => {
        waits.push(delay);
      }
    );

    assert.deepEqual(result, { ok: false, kind: "unreachable" });
    assert.equal(attempts, 3);
    assert.deepEqual(waits, [500, 1_000]);
  });
});
