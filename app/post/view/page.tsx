import { Suspense } from 'react';
import LoadingScreen from '@/components/LoadingScreen';
import PostChatRoute from '@/components/PostChatRoute';

/**
 * A single static route that resolves live post and conversation IDs client-side.
 * This keeps the Capacitor release bundle local without pre-generating campus data.
 */
export default function PostViewPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PostChatRoute />
    </Suspense>
  );
}
