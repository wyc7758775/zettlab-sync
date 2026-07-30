import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  deserializeMetadataOnRemote,
  serializeMetadataOnRemote,
  type MetadataOnRemote,
} from "../../src/metadataOnRemote";

describe("remote sync metadata", () => {
  it("writes the default metadata version and preserves Unicode paths", () => {
    const metadata: MetadataOnRemote = {
      deletions: [{ key: "笔记/示例.md", actionWhen: 123 }],
    };

    const decoded = deserializeMetadataOnRemote(
      serializeMetadataOnRemote(metadata)
    );

    assert.equal(decoded.version, "20220220");
    assert.deepEqual(decoded.deletions, metadata.deletions);
  });
});
