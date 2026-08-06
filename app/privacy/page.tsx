import Link from 'next/link';
import { Shield, MapPin, MessageCircle, Eye, Lock } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';

export default function PrivacyPage() {
  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <div className="mx-auto max-w-md space-y-6">
        <PageHeader title="سياسة الخصوصية" subtitle="كيف نحمي بياناتك" backHref="/" />

        <div className="space-y-4">
          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Shield className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">التزامنا بالخصوصية</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">
              نحن في موقفي نلتزم بحماية خصوصيتك وبياناتك الشخصية. هذه السياسة توضح كيف نستخدم معلوماتك وما هي حقوقك.
            </p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <MapPin className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">استخدام الموقع الجغرافي</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">
              نستخدم موقعك الجغرافي فقط عندما تختار مشاركته في المحادثات لمساعدة الطلاب الآخرين في الوصول إليك. لا نتابع موقعك بشكل مستمر ولا نشاركه مع أطراف خارجية.
            </p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <MessageCircle className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">المحادثات والرسائل</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">
              جميع المحادثات بين الطلاب خاصة ومشفرة. لا نقرأ رسائلكم ولا نشاركها مع أي طرف. الرسائل محفوظة فقط لضمان عمل التطبيق بشكل صحيح.
            </p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Eye className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">منشورات المواقف</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">
              منشورات المواقف مؤقتة وتُحذف تلقائياً بعد انتهاء المدة المحددة. لا نحتفظ ببيانات المواقف بعد انتهائها. المعلومات التي تشاركها (الكلية، البوابة، المنطقة) مرئية فقط للطلاب المسجلين.
            </p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Lock className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">عدم بيع البيانات</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">
              نؤكد أننا لا نبيع بياناتك لأي طرف ثالث. لا نستخدم معلوماتك للإعلانات المستهدفة. بياناتك تستخدم فقط لتحسين تجربتك في التطبيق.
            </p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Shield className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">التحليلات الأساسية</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">
              نستخدم تحليلات مجهولة الهوية لفهم كيفية استخدام التطبيق وتحسينه. هذه البيانات لا تحتوي على أي معلومات شخصية عنك.
            </p>
          </section>

          <section className="glass-card p-5">
            <h2 className="mb-3 text-lg font-extrabold text-white">حقوقك</h2>
            <ul className="space-y-2 text-sm leading-7 text-white/70">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>حق الوصول إلى بياناتك الشخصية</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>حق طلب حذف بياناتك</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>حق تعديل معلوماتك</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>حق سحب موافقتك في أي وقت</span>
              </li>
            </ul>
          </section>

          <section className="glass-card p-5">
            <h2 className="mb-3 text-lg font-extrabold text-white">تواصل معنا</h2>
            <p className="text-sm leading-7 text-white/70">
              إذا كان لديك أي أسئلة أو استفسارات حول سياسة الخصوصية، يمكنك التواصل معنا عبر صفحة{' '}
              <Link href="/feedback" className="text-cyan-300 underline">
                تواصل معنا
              </Link>
            </p>
          </section>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
