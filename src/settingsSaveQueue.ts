export class SettingsSaveQueue {
  private tail: Promise<void> = Promise.resolve();
  private currentRevision = 0;

  get revision(): number {
    return this.currentRevision;
  }

  async run(write: () => Promise<void>): Promise<number> {
    const revision = ++this.currentRevision;
    const completion = this.tail.catch(() => undefined).then(write);
    this.tail = completion;
    await completion;
    return revision;
  }
}
