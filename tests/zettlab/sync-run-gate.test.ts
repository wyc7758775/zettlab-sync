import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { SyncRunGate } from "../../src/syncRunGate";

describe("sync run gate", () => {
  it("allows one holder and can be acquired again after release", () => {
    const gate = new SyncRunGate();

    assert.equal(gate.tryAcquire(), true);
    assert.equal(gate.isActive(), true);
    assert.equal(gate.tryAcquire(), false);

    gate.release();

    assert.equal(gate.isActive(), false);
    assert.equal(gate.tryAcquire(), true);
  });
});
