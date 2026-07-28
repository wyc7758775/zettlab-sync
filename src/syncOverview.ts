export type SyncOverview = {
  state: "not-configured" | "needs-attention" | "ready" | "synced";
  title: string;
  description: string;
  lastSyncAt?: number;
};

export const getSyncOverview = (input: {
  configured: boolean;
  lastSuccessfulSyncAt?: number;
  lastFailedSyncAt?: number;
}): SyncOverview => {
  if (!input.configured) {
    return {
      state: "not-configured",
      title: "尚未关联 Memo",
      description: "请从 Zettlab App 或桌面端完成关联，连接信息会自动写入。",
    };
  }

  const lastFailureIsNewer =
    input.lastFailedSyncAt !== undefined &&
    (input.lastSuccessfulSyncAt === undefined ||
      input.lastFailedSyncAt > input.lastSuccessfulSyncAt);
  if (lastFailureIsNewer) {
    return {
      state: "needs-attention",
      title: "需要检查连接",
      description: "最近一次同步未完成，请检测连接后重试。",
      lastSyncAt: input.lastFailedSyncAt,
    };
  }

  if (input.lastSuccessfulSyncAt !== undefined) {
    return {
      state: "synced",
      title: "同步正常",
      description: "当前 Obsidian 仓库已与 Memo 保持同步。",
      lastSyncAt: input.lastSuccessfulSyncAt,
    };
  }

  return {
    state: "ready",
    title: "已配置，等待首次同步",
    description: "关联已经完成，可以立即开始首次同步。",
  };
};

export const getSyncScheduleSummary = (milliseconds: number): string => {
  if (milliseconds <= 0) return "仅手动同步";
  const minutes = milliseconds / 60_000;
  return Number.isInteger(minutes)
    ? `每 ${minutes} 分钟自动同步`
    : "按自定义间隔自动同步";
};
