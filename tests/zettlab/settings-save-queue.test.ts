import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { SettingsSaveQueue } from "../../src/settingsSaveQueue";

const deferred = (): {
  promise: Promise<void>;
  resolve: () => void;
} => {
  let resolvePromise = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

describe("settings save queue", () => {
  it("serializes writes in invocation order and exposes monotonic revisions", async () => {
    const queue = new SettingsSaveQueue();
    const firstGate = deferred();
    const writes: string[] = [];

    const first = queue.run(async () => {
      await firstGate.promise;
      writes.push("manual");
    });
    const second = queue.run(async () => {
      writes.push("reassociated");
    });

    assert.equal(queue.revision, 2);
    firstGate.resolve();
    assert.equal(await first, 1);
    assert.equal(await second, 2);
    assert.deepEqual(writes, ["manual", "reassociated"]);
  });

  it("continues with the next save after a failed write", async () => {
    const queue = new SettingsSaveQueue();
    const writes: string[] = [];
    const failed = queue.run(async () => {
      writes.push("failed");
      throw new Error("disk full");
    });
    const recovered = queue.run(async () => {
      writes.push("recovered");
    });

    await assert.rejects(failed, /disk full/);
    assert.equal(await recovered, 2);
    assert.deepEqual(writes, ["failed", "recovered"]);
  });
});
