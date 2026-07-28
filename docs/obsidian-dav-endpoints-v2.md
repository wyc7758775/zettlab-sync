# Obsidian DAV endpoints protocol v2

Protocol v2 adds optional managed LAN and public WebDAV addresses while preserving the v1 single `address` field.

## Bootstrap contract

Desktop loopback JSON adds:

```json
{
  "protocolVersion": 2,
  "address": "https://memo.us-drive.zettlab.com/dav/",
  "endpoints": {
    "lan": "http://192.168.5.30:9091/dav/",
    "public": "https://memo.us-drive.zettlab.com/dav/"
  }
}
```

Mobile direct URIs add `protocol_version=2`, `webdav_lan_addr`, and `webdav_public_addr`. Existing `address` and `webdav_addr` remain populated. Producers normally prefer a reachable public address, but may preserve the working LAN address when public is known but unavailable so the legacy single-address path does not point at a failed endpoint.

## Selection and recovery

At the start of every connection test or sync round, the plugin probes LAN first. LAN must return the existing `Zettlab WebDAV` Basic challenge without credentials, then accept the application password in a read-only `PROPFIND Depth: 0`. If LAN fails, the plugin probes the stored public address. Selection is bounded to about three seconds and remains fixed for the current sync round; the next round reselects and can recover automatically.

Managed LAN addresses are limited to RFC1918 IPv4 or IPv6 ULA on `http://<host>:9091/dav/`. Managed public addresses are limited to `https://*.zettlab.com:443/dav/`. User information, query parameters, fragments, loopback/public LAN hosts, and other ports are rejected.

Editing the traditional WebDAV address clears managed endpoints and restores legacy single-address mode.

## Hard Rules

- HR1: two optional strings and bounded request state only; no resident service or unbounded cache.
- HR2: every selection is time-bounded, falls back from LAN to public, and retries selection on the next sync round.
- HR3: only the dedicated revocable Obsidian application password is used; no IAM token, shell, SQL, or Agent scope is added.
- HR4: all v2 fields are optional additions and v1 payloads/settings remain supported.
- HR5: synchronization stays on one endpoint per round to protect consistency; availability recovery happens on the next round.
