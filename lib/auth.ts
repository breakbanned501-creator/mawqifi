import { getSupabase, isSupabaseConfigured } from './supabase';
import type { Profile } from './types';

export async function ensureSession(): Promise<{ userId: string; isGuest: boolean }> {
  const supabase = getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  if (sessionData.session?.user) {
    const isGuest = sessionData.session.user.is_anonymous ?? false;
    await ensureUserProfile(sessionData.session.user.id, isGuest);
    return { userId: sessionData.session.user.id, isGuest };
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error('تعذر إنشاء جلسة ضيف');

  await ensureUserProfile(data.user.id, true);
  return { userId: data.user.id, isGuest: true };
}

export async function ensureUserProfile(userId: string, isGuest: boolean): Promise<Profile> {
  const supabase = getSupabase();
  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('id, username, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) {
    return {
      id: existing.id,
      username: existing.username,
      avatar_url: existing.avatar_url,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert({ id: userId, username: 'طالب', is_guest: isGuest })
    .select('id, username, avatar_url')
    .single();

  if (insertError) throw insertError;
  return {
    id: inserted.id,
    username: inserted.username,
    avatar_url: inserted.avatar_url,
  };
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('id, username, avatar_url')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    username: data.username,
    avatar_url: data.avatar_url,
  };
}

export async function updateUsername(userId: string, username: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('users').update({ username }).eq('id', userId);
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function assertSupabaseReady(): void {
  if (!isSupabaseConfigured) {
    throw new Error('خدمة قاعدة البيانات غير متوفرة. تحقق من إعدادات النشر على Vercel.');
  }
}
