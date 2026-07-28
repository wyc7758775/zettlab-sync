import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { SyncRunGate } from "../../src/syncRunGate";

describe("sync run single-flight flow", () => {
  it("blocks a second sync while the first is still probing an endpoint", async () => {
    const gate = new SyncRunGate();
    let finishProbe!: () => void;
    const probe = new Promise<void>((resolve) => {
      finishProbe = resolve;
    });
    let completedRuns = 0;
    const run = async (): Promise<boolean> => {
      if (!gate.tryAcquire()) return false;
      try {
        await probe;
        completedRuns += 1;
        return true;
      } finally {
        gate.release();
      }
    };

    const first = run();
    const second = await run();

    assert.equal(second, false);
    assert.equal(completedRuns, 0);
    finishProbe();
    assert.equal(await first, true);
    assert.equal(completedRuns, 1);
    assert.equal(await run(), true);
    assert.equal(completedRuns, 2);
  });
});
