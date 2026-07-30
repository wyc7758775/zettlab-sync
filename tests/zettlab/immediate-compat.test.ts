import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const scheduleImmediate = require("../../src/compat/immediate.cjs") as (
  task: () => void
) => void;

describe("safe immediate scheduler", () => {
  it("runs the callback asynchronously without creating a script element", async () => {
    const events = ["before"];
    scheduleImmediate(() => events.push("scheduled"));
    events.push("after");

    await Promise.resolve();

    assert.deepEqual(events, ["before", "after", "scheduled"]);
  });
});
