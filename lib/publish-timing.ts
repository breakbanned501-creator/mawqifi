// Opt-in staging diagnostics: Performance marks only, never coordinates/tokens or UI logs.
export type PublishStage = 'tap' | 'permission-resolved' | 'gps-ready' | 'rpc-start' | 'rpc-success' | 'success-ui' | 'feed-ready';
const enabled = process.env.NODE_ENV === 'development' ||
  (process.env.NEXT_PUBLIC_PUBLISH_TIMING === '1' && process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://jrmiwmsgnztqwbigumlw.supabase.co');
export function publishTiming(stage: PublishStage): void {
  if (!enabled || typeof performance === 'undefined') return;
  if (stage === 'tap') {
    for (const name of ['tap','permission-resolved','gps-ready','rpc-start','rpc-success','success-ui','feed-ready']) performance.clearMarks('mawqifi-publish:' + name);
  }
  const name = 'mawqifi-publish:' + stage;
  if (stage === 'feed-ready' && !performance.getEntriesByName('mawqifi-publish:rpc-success').length) return;
  if ((stage === 'success-ui' || stage === 'feed-ready') && performance.getEntriesByName(name).length) return;
  if (stage !== 'success-ui' && stage !== 'feed-ready') performance.clearMarks(name);
  performance.mark(name);
}
