import { mockMessages } from './mock';
import type { ChatMessage } from './types';

const STORAGE_PREFIX = 'mawqifi_chat_';

function storageKey(conversationId: string) {
  return `${STORAGE_PREFIX}${conversationId}`;
}

export function getLocalMessages(conversationId: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(conversationId));
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {
    /* ignore */
  }
  return mockMessages.filter((message) => message.conversation_id === conversationId);
}

export function saveLocalMessages(conversationId: string, messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(conversationId), JSON.stringify(messages));
}

export function appendLocalMessage(conversationId: string, message: ChatMessage): ChatMessage[] {
  const next = [...getLocalMessages(conversationId), message];
  saveLocalMessages(conversationId, next);
  return next;
}
