'use client';

import { useSearchParams } from 'next/navigation';
import ErrorBanner from '@/components/ErrorBanner';
import PostChatScreen from '@/components/PostChatScreen';
import { useLocale } from '@/components/LocaleProvider';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getValidUuid(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Static-export-safe entry point for live post and conversation identifiers.
 * The page itself is bundled once; the data is loaded from Supabase at runtime.
 */
export default function PostChatRoute() {
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const postId = getValidUuid(searchParams.get('id'));
  const conversationId = getValidUuid(searchParams.get('chat'));

  if (!postId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <ErrorBanner message={t('parking.notFound')} />
      </main>
    );
  }

  return (
    <PostChatScreen
      key={`${postId}:${conversationId ?? ''}`}
      postId={postId}
      requestedConversationId={conversationId}
    />
  );
}
