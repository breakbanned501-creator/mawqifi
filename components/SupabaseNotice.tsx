import { isSupabaseConfigured } from '@/lib/supabase';

export default function SupabaseNotice() {
  if (isSupabaseConfigured) return null;

  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
      <p className="font-bold">وضع العرض المحلي</p>
      <p className="mt-1 text-cyan-50/70">
        أضف مفاتيح Supabase في ملف البيئة لتفعيل المصادقة والرسائل والتحديثات الحية الحقيقية.
      </p>
    </div>
  );
}
