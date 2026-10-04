import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function requirePublicConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase public environment variables are not configured.');
  }
}

export function getSupabaseServiceRole() {
  requirePublicConfig();
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type RequestAuthenticationState =
  | 'authenticated'
  | 'missing_authorization'
  | 'malformed_authorization'
  | 'rejected_bearer';

export type RequestAuthentication = {
  user: User | null;
  state: RequestAuthenticationState;
  errorCode?: string;
};

function authenticationErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

/**
 * Verifies the browser Supabase bearer token without ever accepting a client
 * user id. The state is deliberately safe to log for subscription diagnostics:
 * it never contains a token, cookie value, or user identifier.
 */
export async function getRequestAuthentication(request: Request): Promise<RequestAuthentication> {
  requirePublicConfig();
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return { user: null, state: 'missing_authorization' };
  }

  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
  if (!token) {
    return { user: null, state: 'malformed_authorization' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      user: null,
      state: 'rejected_bearer',
      errorCode: authenticationErrorCode(error),
    };
  }

  // Auth deletion does not invalidate every outstanding JWT. Also reject a
  // disabled profile while server-side Storage/Auth cleanup is being retried.
  const { data: profile, error: profileError } = await supabase.from('users')
    .select('id, deleted_at').eq('id', data.user.id).maybeSingle();
  if (profileError || !profile || profile.deleted_at) {
    return { user: null, state: 'rejected_bearer', errorCode: 'ACCOUNT_UNAVAILABLE' };
  }
  return { user: data.user, state: 'authenticated' };
}

export async function getRequestUser(request: Request): Promise<User | null> {
  return (await getRequestAuthentication(request)).user;
}
