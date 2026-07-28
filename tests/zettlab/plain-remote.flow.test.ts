import assert from "node:assert/strict";
import { describe, it } from "mocha";
import type { Entity } from "../../src/baseTypes";
import { FakeFs } from "../../src/fsAll";
import { PlainRemoteFs } from "../../src/fsPlain";
import type { InternalDBs } from "../../src/localdb";
import { normalizeSettings } from "../../src/settingsModel";
import { syncer } from "../../src/sync";
import { ProtectModifyError, type ProtectModifyDetails } from "../../src/syncSafety";

class MemoryFs extends FakeFs {
  kind = "memory";
  private files = new Map<string, ArrayBuffer>();
  private mtimes = new Map<string, number>();

  async walk(): Promise<Entity[]> {
    return [...this.files.entries()].map(([key, content]) => ({
      key,
      keyRaw: key,
      size: content.byteLength,
      sizeRaw: content.byteLength,
      mtimeCli: this.mtimes.get(key) ?? 1,
      mtimeSvr: this.mtimes.get(key) ?? 1,
    }));
  }
  async walkPartial(): Promise<Entity[]> { return this.walk(); }
  async stat(key: string): Promise<Entity> {
    const content = this.files.get(key);
    if (content === undefined) throw new Error("missing file");
    const mtime = this.mtimes.get(key) ?? 1;
    return { key, keyRaw: key, size: content.byteLength, sizeRaw: content.byteLength, mtimeCli: mtime, mtimeSvr: mtime };
  }
  async mkdir(key: string): Promise<Entity> { return { key, keyRaw: key, size: 0, sizeRaw: 0 }; }
  async writeFile(key: string, content: ArrayBuffer, mtime = 1): Promise<Entity> {
    this.files.set(key, content);
    this.mtimes.set(key, mtime);
    return this.stat(key);
  }
  async readFile(key: string): Promise<ArrayBuffer> {
    return this.files.get(key)?.slice(0) ?? new ArrayBuffer(0);
  }
  async rename(key1: string, key2: string): Promise<void> {
    this.files.set(key2, await this.readFile(key1));
    this.mtimes.set(key2, this.mtimes.get(key1) ?? 1);
    this.files.delete(key1);
    this.mtimes.delete(key1);
  }
  async rm(key: string): Promise<void> { this.files.delete(key); this.mtimes.delete(key); }
  async checkConnect(): Promise<boolean> { return true; }
  async getUserDisplayName(): Promise<string> { return "memory"; }
  async revokeAuth(): Promise<void> {}
  allowEmptyFile(): boolean { return true; }
}

class MemoryTable {
  private readonly records = new Map<string, unknown>();
  async setItem(key: string, value: unknown): Promise<unknown> { this.records.set(key, value); return value; }
  async getItems(): Promise<Record<string, Entity | null>> { return Object.fromEntries(this.records) as Record<string, Entity | null>; }
  size(): number { return this.records.size; }
}

describe("plain remote sync boundary", () => {
  it("keeps paths and content plaintext through the transform layer", async () => {
    const remote = new PlainRemoteFs(new MemoryFs());
    const content = new TextEncoder().encode("# Readable Markdown").buffer;
    await remote.writeFile("note.md", content, 1, 1);

    const entries = await remote.walk();
    assert.equal(entries[0].key, "note.md");
    assert.equal(entries[0].keyEnc, "note.md");
    assert.equal(entries[0].sizeEnc, content.byteLength);
    assert.equal(new TextDecoder().decode(await remote.readFile("note.md")), "# Readable Markdown");
    assert.deepEqual(await remote.isPasswordOk(), { ok: true, reason: "plain_remote" });
  });

  it("uploads a newly created local note through the sync engine", async () => {
    Object.assign(globalThis, {
      window: {
        moment: () => ({
          format: () => "1970-01-01T00:00:00Z",
          toISOString: () => "1970-01-01T00:00:00.000Z",
        }),
      },
    });
    const local = new MemoryFs();
    const remote = new MemoryFs();
    const plainRemote = new PlainRemoteFs(remote);
    const content = new TextEncoder().encode("# First sync").buffer;
    await local.writeFile("first.md", content, 1, 1);
    const syncPlans = new MemoryTable();
    const previousRecords = new MemoryTable();
    const database = {
      syncPlansTbl: syncPlans,
      prevSyncRecordsTbl: previousRecords,
    } as unknown as InternalDBs;
    let syncError = "";

    await syncer(
      local,
      remote,
      plainRemote,
      undefined,
      database,
      "manual",
      "default",
      "test-vault",
      ".obsidian",
      normalizeSettings(undefined),
      () => "safety limit reached",
      () => undefined,
      undefined,
      async (_trigger, error) => {
        syncError = error.message;
      }
    );

    assert.equal(syncError, "");
    assert.equal(new TextDecoder().decode(await remote.readFile("first.md")), "# First sync");
    assert.equal(syncPlans.size(), 1);
    assert.equal(previousRecords.size(), 1);
  });

  it("continues a protected small-vault sync only after one-time confirmation", async () => {
    Object.assign(globalThis, {
      window: {
        moment: () => ({
          format: () => "1970-01-01T00:00:00Z",
          toISOString: () => "1970-01-01T00:00:00.000Z",
        }),
      },
    });
    const local = new MemoryFs();
    const remote = new MemoryFs();
    const plainRemote = new PlainRemoteFs(remote);
    const firstVersion = new TextEncoder().encode("first").buffer;
    const secondVersion = new TextEncoder().encode("second").buffer;
    const thirdVersion = new TextEncoder().encode("third").buffer;
    await local.writeFile("one.md", firstVersion, 1, 1);
    await local.writeFile("two.md", firstVersion, 1, 1);
    const database = {
      syncPlansTbl: new MemoryTable(),
      prevSyncRecordsTbl: new MemoryTable(),
    } as unknown as InternalDBs;
    let syncError: Error | undefined;
    const runSync = async (
      confirmProtectedChanges?: (details: ProtectModifyDetails) => Promise<boolean>
    ) => {
      syncError = undefined;
      await syncer(
        local,
        remote,
        plainRemote,
        undefined,
        database,
        "manual",
        "default",
        "test-vault",
        ".obsidian",
        normalizeSettings({ protectModifyPercentage: 50 }),
        () => "safety limit reached",
        () => undefined,
        undefined,
        async (_trigger, error) => {
          syncError = error;
        },
        undefined,
        undefined,
        undefined,
        confirmProtectedChanges
      );
    };

    await runSync();
    assert.equal(syncError, undefined);
    await local.writeFile("one.md", secondVersion, 2, 1);

    await runSync();
    assert.ok(syncError instanceof ProtectModifyError);
    assert.deepEqual(syncError.details.items, [
      { path: "one.md", action: "upload" },
    ]);
    assert.equal(new TextDecoder().decode(await remote.readFile("one.md")), "first");

    let confirmationCount = 0;
    await runSync(async (details) => {
      confirmationCount += 1;
      assert.equal(details.changed, 1);
      assert.equal(details.total, 2);
      return true;
    });
    assert.equal(syncError, undefined);
    assert.equal(confirmationCount, 1);
    assert.equal(new TextDecoder().decode(await remote.readFile("one.md")), "second");

    await local.writeFile("one.md", thirdVersion, 3, 1);
    await runSync();
    assert.ok(syncError instanceof ProtectModifyError);
    assert.equal(new TextDecoder().decode(await remote.readFile("one.md")), "second");
  });
});
