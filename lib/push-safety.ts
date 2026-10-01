/** Both directions affect delivery, without changing non-blocked subscriptions. */
export function blockedRecipientIds(actorId: string, blocks: { blocker_id: string; blocked_id: string }[]): Set<string> {
  const recipients = new Set<string>();
  for (const block of blocks) {
    if (block.blocker_id === actorId) recipients.add(block.blocked_id);
    if (block.blocked_id === actorId) recipients.add(block.blocker_id);
  }
  return recipients;
}
