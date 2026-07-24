export function selectStartupConversationId(
  flaggedConversationId: unknown,
  persistedConversationId: string | undefined,
  configuredConversationIds: string[],
): string | undefined {
  if (typeof flaggedConversationId === "string" && flaggedConversationId.trim()) {
    return flaggedConversationId.trim();
  }
  if (persistedConversationId) return persistedConversationId;
  if (configuredConversationIds.length === 1) return configuredConversationIds[0];
  return undefined;
}
