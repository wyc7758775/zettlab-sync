import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { retryBootstrapFirstSync } from "../../src/bootstrapFirstSync";

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
            kind: "sync",
            error: new Error("DAV warming up"),
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
