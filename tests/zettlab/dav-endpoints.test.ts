import assert from "node:assert/strict";
import { describe, it } from "mocha";
import type { DavProbeRequest } from "../../src/davEndpoints";
import {
  normalizeLanDavAddress,
  normalizePublicDavAddress,
  normalizeZettlabDavEndpoints,
  selectDavEndpoint,
} from "../../src/davEndpoints";
import { normalizeSettings } from "../../src/settingsModel";

const settingsWithEndpoints = (endpoints: { lan?: string; public?: string }) =>
  normalizeSettings({
    webdav: {
      address: endpoints.public ?? endpoints.lan ?? "",
      username: "sync",
      password: "strong-test-password",
      zettlabEndpoints: endpoints,
    },
  });

describe("Zettlab DAV endpoint validation", () => {
  it("accepts only RFC1918 IPv4 or IPv6 ULA on the fixed LAN DAV endpoint", () => {
    assert.equal(
      normalizeLanDavAddress("http://192.168.5.30:9091/dav"),
      "http://192.168.5.30:9091/dav/"
    );
    assert.equal(
      normalizeLanDavAddress("http://[fd12:3456::8]:9091/dav/"),
      "http://[fd12:3456::8]:9091/dav/"
    );
    for (const invalid of [
      "http://127.0.0.1:9091/dav/",
      "http://8.8.8.8:9091/dav/",
      "http://192.168.5.30:9090/dav/",
      "https://192.168.5.30:9091/dav/",
      "http://sync:secret@192.168.5.30:9091/dav/",
      "http://192.168.5.30:9091/dav/?token=x",
      "http://192.168.5.30:9091/dav/#notes",
    ]) {
      assert.equal(normalizeLanDavAddress(invalid), null, invalid);
    }
  });

  it("accepts only HTTPS Zettlab subdomains on port 443 and the exact DAV path", () => {
    assert.equal(
      normalizePublicDavAddress("https://memo.us-drive.zettlab.com:443/dav"),
      "https://memo.us-drive.zettlab.com/dav/"
    );
    for (const invalid of [
      "https://zettlab.com/dav/",
      "https://evil.example/dav/",
      "https://memo.us-drive.zettlab.com:8443/dav/",
      "http://memo.us-drive.zettlab.com/dav/",
      "https://sync:secret@memo.us-drive.zettlab.com/dav/",
      "https://memo.us-drive.zettlab.com/dav/?token=x",
      "https://memo.us-drive.zettlab.com/dav/#notes",
    ]) {
      assert.equal(normalizePublicDavAddress(invalid), null, invalid);
    }
  });

  it("rejects a whole endpoint set when any supplied address is malformed", () => {
    assert.equal(normalizeZettlabDavEndpoints({}), null);
    assert.equal(
      normalizeZettlabDavEndpoints({
        lan: "http://192.168.5.30:9091/dav/",
        public: "https://evil.example/dav/",
      }),
      null
    );
  });
});

describe("Zettlab DAV endpoint selection flow", () => {
  it("requires the Zettlab realm and valid credentials before selecting LAN", async () => {
    const calls: Array<{
      address: string;
      headers: Record<string, string>;
      timeoutMs: number;
    }> = [];
    const request: DavProbeRequest = async (address, headers, timeoutMs) => {
      calls.push({ address, headers, timeoutMs });
      if (!headers.Authorization) {
        return {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="Zettlab WebDAV"' },
        };
      }
      return { status: 207, headers: {} };
    };
    const selected = await selectDavEndpoint(
      settingsWithEndpoints({
        lan: "http://192.168.5.30:9091/dav/",
        public: "https://memo.us-drive.zettlab.com/dav/",
      }),
      request
    );

    assert.deepEqual(selected, {
      address: "http://192.168.5.30:9091/dav/",
      transport: "lan",
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].headers, {});
    assert.match(calls[1].headers.Authorization ?? "", /^Basic /);
    assert.ok(
      calls.every((call) => call.timeoutMs > 0 && call.timeoutMs <= 1_500)
    );
  });

  it("accepts harmless whitespace around the exact Zettlab realm", async () => {
    const request: DavProbeRequest = async (_address, headers) => ({
      status: headers.Authorization ? 207 : 401,
      headers: {
        "www-authenticate": '  Basic realm = "Zettlab WebDAV"  ',
      },
    });

    assert.equal(
      (
        await selectDavEndpoint(
          settingsWithEndpoints({ lan: "http://192.168.5.30:9091/dav/" }),
          request
        )
      )?.transport,
      "lan"
    );
  });

  it("falls back to public when LAN is absent, spoofed, or rejects the app password", async () => {
    for (const lanAuthenticatedStatus of [401, 403]) {
      const addresses: string[] = [];
      const request: DavProbeRequest = async (address, headers) => {
        addresses.push(address);
        if (address.startsWith("http://") && !headers.Authorization) {
          return {
            status: 401,
            headers: { "www-authenticate": 'Basic realm="Zettlab WebDAV"' },
          };
        }
        if (address.startsWith("http://"))
          return { status: lanAuthenticatedStatus, headers: {} };
        return { status: 207, headers: {} };
      };
      const selected = await selectDavEndpoint(
        settingsWithEndpoints({
          lan: "http://192.168.5.30:9091/dav/",
          public: "https://memo.us-drive.zettlab.com/dav/",
        }),
        request
      );
      assert.deepEqual(selected, {
        address: "https://memo.us-drive.zettlab.com/dav/",
        transport: "public",
      });
      assert.equal(addresses.at(-1), "https://memo.us-drive.zettlab.com/dav/");
    }

    const spoofedRequest: DavProbeRequest = async (address, headers) => {
      if (address.startsWith("http://") && !headers.Authorization) {
        return {
          status: 401,
          headers: { "www-authenticate": 'Basic realm="Other DAV"' },
        };
      }
      return { status: 207, headers: {} };
    };
    assert.equal(
      await selectDavEndpoint(
        settingsWithEndpoints({ lan: "http://192.168.5.30:9091/dav/" }),
        spoofedRequest
      ),
      null
    );
  });

  it("rejects realm prefixes instead of sending the app password", async () => {
    for (const realm of [
      'Basic realm="Zettlab WebDAV Evil"',
      "Basic realm=Zettlab WebDAV-evil",
      'Digest realm="Other", Basic realm="Zettlab WebDAV"',
    ]) {
      let authenticated = false;
      const request: DavProbeRequest = async (_address, headers) => {
        if (headers.Authorization) authenticated = true;
        return {
          status: headers.Authorization ? 207 : 401,
          headers: { "www-authenticate": realm },
        };
      };

      assert.equal(
        await selectDavEndpoint(
          settingsWithEndpoints({ lan: "http://192.168.5.30:9091/dav/" }),
          request
        ),
        null,
        realm
      );
      assert.equal(authenticated, false, realm);
    }
  });

  it("returns failure when neither endpoint is reachable", async () => {
    const request: DavProbeRequest = async () => ({ status: 503, headers: {} });
    assert.equal(
      await selectDavEndpoint(
        settingsWithEndpoints({
          lan: "http://192.168.5.30:9091/dav/",
          public: "https://memo.us-drive.zettlab.com/dav/",
        }),
        request
      ),
      null
    );
  });

  it("reselects at the start of the next round without switching the prior result", async () => {
    let lanReachable = false;
    const request: DavProbeRequest = async (address, headers) => {
      if (address.startsWith("http://")) {
        if (!lanReachable) return { status: 503, headers: {} };
        if (!headers.Authorization) {
          return {
            status: 401,
            headers: { "www-authenticate": 'Basic realm="Zettlab WebDAV"' },
          };
        }
      }
      return { status: 207, headers: {} };
    };
    const settings = settingsWithEndpoints({
      lan: "http://192.168.5.30:9091/dav/",
      public: "https://memo.us-drive.zettlab.com/dav/",
    });

    const firstRound = await selectDavEndpoint(settings, request);
    lanReachable = true;
    const secondRound = await selectDavEndpoint(settings, request);

    assert.equal(firstRound?.transport, "public");
    assert.equal(firstRound?.address, "https://memo.us-drive.zettlab.com/dav/");
    assert.equal(secondRound?.transport, "lan");
    assert.equal(secondRound?.address, "http://192.168.5.30:9091/dav/");
  });

  it("keeps legacy single-address settings working", async () => {
    const request: DavProbeRequest = async (_address, headers) => ({
      status: headers.Authorization ? 207 : 401,
      headers: {},
    });
    const selected = await selectDavEndpoint(
      normalizeSettings({
        webdav: {
          address: "https://legacy.example.com/dav/",
          username: "sync",
          password: "strong-test-password",
        },
      }),
      request
    );
    assert.deepEqual(selected, {
      address: "https://legacy.example.com/dav/",
      transport: "manual",
    });
  });
});
