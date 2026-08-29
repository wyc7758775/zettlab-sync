import type {
  DecisionTypeForMixedEntity,
  MixedEntity,
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
): boolean => source === "manual" || source === "auto_once_init";

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

export class ProtectModifyError extends Error {
  constructor(
    message: string,
    readonly details: ProtectModifyDetails
  ) {
    super(message);
    this.name = "ProtectModifyError";
  }
}
