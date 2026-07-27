import assert from "node:assert/strict";
import { describe, it } from "mocha";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  SYNC_ON_SAVE_DELAY_MILLISECONDS,
} from "../../src/settingsModel";

describe("settings normalization", () => {
  it("keeps only WebDAV-compatible settings when reading legacy data", () => {
    const legacy = {
      serviceType: "s3",
      password: "old-encryption-password",
      s3: { s3BucketName: "should-not-survive" },
      webdav: { address: "https://nas.example.test/dav", username: "wyc" },
      ignorePaths: ["^tmp/"],
    };

    const normalized = normalizeSettings(legacy);

    assert.equal(normalized.serviceType, "webdav");
    assert.equal(normalized.password, "");
    assert.equal(normalized.webdav.address, "https://nas.example.test/dav");
    assert.equal(normalized.webdav.username, "sync");
    assert.equal(normalized.webdav.authType, "basic");
    assert.deepEqual(normalized.ignorePaths, ["^tmp/"]);
    assert.equal("s3" in (normalized as unknown as Record<string, unknown>), false);
  });

  it("uses conservative WebDAV defaults for a new install", () => {
    assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
    assert.equal(SYNC_ON_SAVE_DELAY_MILLISECONDS, 1000);
  });

  it("keeps valid managed endpoints and drops a malformed persisted set", () => {
    const valid = normalizeSettings({
      webdav: {
        address: "https://memo.us-drive.zettlab.com/dav/",
        zettlabEndpoints: {
          lan: "http://192.168.5.30:9091/dav/",
          public: "https://memo.us-drive.zettlab.com/dav/",
        },
      },
    });
    assert.deepEqual(valid.webdav.zettlabEndpoints, {
      lan: "http://192.168.5.30:9091/dav/",
      public: "https://memo.us-drive.zettlab.com/dav/",
    });

    const malformed = normalizeSettings({
      webdav: {
        address: "https://legacy.example.com/dav/",
        zettlabEndpoints: { public: "https://evil.example/dav/" },
      },
    });
    assert.equal(malformed.webdav.zettlabEndpoints, undefined);
    assert.equal(malformed.webdav.address, "https://legacy.example.com/dav/");
  });
});
