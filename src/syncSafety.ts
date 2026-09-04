import type {
  DecisionTypeForMixedEntity,
  MixedEntity,
  SyncDirectionType,
  SyncTriggerSourceType,
} from "./baseTypes";

export type ProtectedChangeAction =
  | "upload"
  | "download"
  | "delete_local"
  | "delete_remote"
  | "conflict";

export interface ProtectedChangePreviewItem {
  path: string;
  action: ProtectedChangeAction;
}

export interface ProtectModifyDetails {
  threshold: number;
  changed: number;
  total: number;
  items: ProtectedChangePreviewItem[];
  hiddenItemCount: number;
  actionCounts: Record<ProtectedChangeAction, number>;
  /** A side unexpectedly became empty and would otherwise cause a wipe. */
  reason?: "empty_local" | "empty_remote";
}

export const MAX_PROTECTED_CHANGE_PREVIEW_ITEMS = 100;

const PROTECTED_ACTIONS: Partial<
  Record<DecisionTypeForMixedEntity, ProtectedChangeAction>
> = {
  local_is_modified_then_push: "upload",
  remote_is_modified_then_pull: "download",
  local_is_deleted_thus_also_delete_remote: "delete_remote",
  remote_is_deleted_thus_also_delete_local: "delete_local",
  conflict_created_then_keep_local: "conflict",
  conflict_created_then_keep_remote: "conflict",
  conflict_created_then_keep_both: "conflict",
  conflict_modified_then_keep_local: "conflict",
  conflict_modified_then_keep_remote: "conflict",
  conflict_modified_then_keep_both: "conflict",
};

export const getProtectedChangeAction = (
  decision: DecisionTypeForMixedEntity | undefined
): ProtectedChangeAction | undefined =>
  decision === undefined ? undefined : PROTECTED_ACTIONS[decision];

export const shouldOfferSafetyOverride = (
  source: SyncTriggerSourceType
): boolean => source === "manual";

export const buildProtectModifyDetails = (
  mixedEntityMappings: Record<string, MixedEntity>,
  threshold: number,
  changed: number,
  total: number,
  previewLimit = MAX_PROTECTED_CHANGE_PREVIEW_ITEMS
): ProtectModifyDetails => {
  const protectedItems = Object.values(mixedEntityMappings)
    .flatMap((entry): ProtectedChangePreviewItem[] => {
      if (entry.key.endsWith("/")) return [];
      const action = getProtectedChangeAction(entry.decision);
      return action ? [{ path: entry.key, action }] : [];
    })
    .sort((left, right) => left.path.localeCompare(right.path));
  const actionCounts: Record<ProtectedChangeAction, number> = {
    upload: 0,
    download: 0,
    delete_local: 0,
    delete_remote: 0,
    conflict: 0,
  };
  for (const item of protectedItems) actionCounts[item.action] += 1;
  const limit = Math.max(0, previewLimit);
  return {
    threshold,
    changed,
    total,
    items: protectedItems.slice(0, limit),
    hiddenItemCount: Math.max(0, protectedItems.length - limit),
    actionCounts,
  };
};

export interface EmptySideDeletionRisk {
  side: "local" | "remote";
  affected: number;
  tracked: number;
}

export const buildEmptySideProtectionDetails = (
  risk: EmptySideDeletionRisk
): ProtectModifyDetails => ({
  threshold: 100,
  changed: risk.affected,
  total: risk.tracked,
  items: [],
  hiddenItemCount: risk.affected,
  actionCounts: {
    upload: 0,
    download: 0,
    delete_local: risk.side === "remote" ? risk.affected : 0,
    delete_remote: risk.side === "local" ? risk.affected : 0,
    conflict: 0,
  },
  reason: risk.side === "remote" ? "empty_remote" : "empty_local",
});

/** Detect a full-side disappearance from a previously synchronised vault. */
export const detectEmptySideDeletionRisk = (
  mixedEntityMappings: Record<string, MixedEntity>,
  syncDirection: SyncDirectionType = "bidirectional"
): EmptySideDeletionRisk | undefined => {
  const fileEntries = Object.values(mixedEntityMappings).filter(
    (entry) => !entry.key.endsWith("/")
  );
  const tracked = fileEntries.filter((entry) => entry.prevSync !== undefined);
  if (tracked.length === 0) return undefined;

  const localTracked = tracked.filter((entry) => entry.local !== undefined).length;
  const remoteTracked = tracked.filter((entry) => entry.remote !== undefined).length;
  const missingRemoteTracked = tracked.filter(
    (entry) => entry.remote === undefined
  ).length;
  const missingLocalTracked = tracked.filter(
    (entry) => entry.local === undefined
  ).length;

  if (
    missingRemoteTracked === tracked.length &&
    localTracked > 0 &&
    syncDirection !== "incremental_push_only"
  ) {
    return { side: "remote", affected: tracked.length, tracked: tracked.length };
  }
  if (
    missingLocalTracked === tracked.length &&
    remoteTracked > 0 &&
    syncDirection !== "incremental_pull_only"
  ) {
    return { side: "local", affected: tracked.length, tracked: tracked.length };
  }
  return undefined;
};

export class ProtectModifyError extends Error {
  constructor(
    message: string,
    readonly details: ProtectModifyDetails
  ) {
    super(message);
    this.name = "ProtectModifyError";
  }
}

export class EmptySideProtectionError extends ProtectModifyError {
  constructor(message: string, details: ProtectModifyDetails) {
    super(message, details);
    this.name = "EmptySideProtectionError";
  }
}
