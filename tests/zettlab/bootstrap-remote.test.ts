import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  buildBootstrapClaimRequest,
  buildBootstrapCompletionRequest,
} from "../../src/bootstrap";

describe("remote bootstrap request validation", () => {
  it("accepts only owned HTTPS endpoints and never adds credentials to the request", () => {
    const params = {
      mode: "remote",
      token: "r".repeat(43),
      endpoint: "https://memo.us-drive.zettlab.com/.zettlab/bootstrap",
    };

    assert.deepEqual(buildBootstrapClaimRequest(params), {
      mode: "remote",
      url: `https://memo.us-drive.zettlab.com/.zettlab/bootstrap/claim?token=${params.token}`,
      method: "GET",
      headers: { "Cache-Control": "no-store" },
    });
    assert.equal(
      buildBootstrapCompletionRequest(params, "ok")?.url.includes("password"),
      false
    );
    assert.equal(
      buildBootstrapClaimRequest({
        ...params,
        endpoint: "https://zettlab.com.evil.example/.zettlab/bootstrap",
      }),
      null
    );
    assert.equal(
      buildBootstrapClaimRequest({ ...params, token: "short" }),
      null
    );
  });
});
