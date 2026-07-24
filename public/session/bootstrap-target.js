export function reconcileSnapshotTarget(currentTarget, snapshotTarget) {
  if (!snapshotTarget) return currentTarget;
  if (
    snapshotTarget.workspaceId !== currentTarget.workspaceId ||
    snapshotTarget.instanceId !== currentTarget.instanceId
  ) {
    throw new Error("Snapshot target does not belong to the current runtime");
  }
  return snapshotTarget;
}
