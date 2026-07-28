import assert from "node:assert/strict";
import { describe, it } from "mocha";
import type { MixedEntity } from "../../src/baseTypes";
import {
  buildProtectModifyDetails,
  getProtectedChangeAction,
  shouldOfferSafetyOverride,
} from "../../src/syncSafety";

describe("sync safety preview", () => {
  it("maps protected file decisions to user-facing actions", () => {
    assert.equal(getProtectedChangeAction("local_is_modified_then_push"), "upload");
    assert.equal(getProtectedChangeAction("remote_is_modified_then_pull"), "download");
    assert.equal(
      getProtectedChangeAction("local_is_deleted_thus_also_delete_remote"),
      "delete_remote"
    );
    assert.equal(
      getProtectedChangeAction("remote_is_deleted_thus_also_delete_local"),
      "delete_local"
    );
    assert.equal(
      getProtectedChangeAction("conflict_modified_then_keep_both"),
      "conflict"
    );
    assert.equal(getProtectedChangeAction("local_is_created_then_push"), undefined);
  });

  it("sorts and bounds the preview without counting folders", () => {
    const mappings: Record<string, MixedEntity> = {
      "z.md": {
        key: "z.md",
        decision: "local_is_modified_then_push",
      },
      "a.md": {
        key: "a.md",
        decision: "remote_is_deleted_thus_also_delete_local",
      },
      "folder/": {
        key: "folder/",
        decision: "folder_to_be_deleted_on_both",
      },
    };

    assert.deepEqual(buildProtectModifyDetails(mappings, 50, 2, 3, 1), {
      threshold: 50,
      changed: 2,
      total: 3,
      items: [{ path: "a.md", action: "delete_local" }],
      hiddenItemCount: 1,
      actionCounts: {
        upload: 1,
        download: 0,
        delete_local: 1,
        delete_remote: 0,
        conflict: 0,
      },
    });
  });

  it("offers one-time continuation only for a user-started sync", () => {
    assert.equal(shouldOfferSafetyOverride("manual"), true);
    assert.equal(shouldOfferSafetyOverride("auto"), false);
    assert.equal(shouldOfferSafetyOverride("auto_once_init"), false);
    assert.equal(shouldOfferSafetyOverride("auto_sync_on_save"), false);
    assert.equal(shouldOfferSafetyOverride("dry"), false);
  });
});
