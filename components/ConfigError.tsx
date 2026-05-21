export default function ConfigError({ message }: { message?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="glass-card max-w-md space-y-4 p-6">
        <h1 className="text-xl font-black text-white">إعداد النشر غير مكتمل</h1>
        <p className="text-sm leading-7 text-white/65">
          {message ??
            'أضف متغيرات Supabase في Vercel ثم أعد النشر. راجع ملف supabase/schema.sql في المشروع.'}
        </p>
        <ul className="text-start text-xs leading-6 text-cyan-100/80">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
        </ul>
      </div>
    </main>
  );
}
