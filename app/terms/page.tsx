import Link from 'next/link';
import { FileText, AlertTriangle, Users, Shield, Ban } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';

export default function TermsPage() {
  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <div className="mx-auto max-w-md space-y-6">
        <PageHeader title="الشروط والأحكام" subtitle="قواعد استخدام موقفي" backHref="/" />

        <div className="space-y-4">
          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Users className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">أداة مجتمعية للطلاب</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">
              موقفي هو تطبيق مجتمعي مخصص لطلاب جامعة الكويت في حرم الشدادية. الهدف هو تسهيل مشاركة المواقف المتاحة بين الطلاب بأسلوب تعاوني.
            </p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Shield className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">مسؤولية المستخدم</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">
              أنت مسؤول بالكامل عن جميع المعلومات التي تنشرها أو ترسلها عبر التطبيق. يجب التأكد من صحة المعلومات قبل نشرها.
            </p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <Ban className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">المحظورات</h2>
            </div>
            <ul className="space-y-3 text-sm leading-7 text-white/70">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                <span><strong className="text-white">نشر مواقف وهمية:</strong> لا يجوز نشر معلومات كاذبة عن مواقف غير متاحة</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                <span><strong className="text-white">الإساءة والتحرش:</strong> يمنع استخدام لغة مسيئة أو تهديدية في المحادثات</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                <span><strong className="text-white">الرسائل غير المرغوبة:</strong> يمنع إرسال رسائل ترويجية أو غير ذات صلة</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                <span><strong className="text-white">الاستخدام غير القانوني:</strong> يمنع استخدام التطبيق لأي أغراض غير قانونية</span>
              </li>
            </ul>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <AlertTriangle className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">الإبلاغ عن الانتهاكات</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">
              إذا واجهت أي سلوك مخالف للشروط، يمكنك استخدام زر "الإبلاغ" المتاح في المنشورات والمحادثات. سنقوم بمراجعة البلاغات واتخاذ الإجراءات اللازمة.
            </p>
          </section>

          <section className="glass-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15">
                <FileText className="h-5 w-5 text-cyan-300" />
              </div>
              <h2 className="text-lg font-extrabold text-white">التعديلات على الشروط</h2>
            </div>
            <p className="text-sm leading-7 text-white/70">
              نحتفظ بالحق في تعديل هذه الشروط والأحكام في أي وقت. سيتم إشعارك بأي تغييرات جوهرية عبر التطبيق.
            </p>
          </section>

          <section className="glass-card p-5">
            <h2 className="mb-3 text-lg font-extrabold text-white">الالتزام بالقوانين</h2>
            <p className="text-sm leading-7 text-white/70">
              يجب على جميع المستخدمين الالتزام بالقوانين والأنظمة المعمول بها في دولة الكويت، بما في ذلك قوانين جامعة الكويت.
            </p>
          </section>

          <section className="glass-card p-5">
            <h2 className="mb-3 text-lg font-extrabold text-white">إيقاف الحساب</h2>
            <p className="text-sm leading-7 text-white/70">
              نحتفظ بالحق في إيقاف أو حظر أي حساب يخالف هذه الشروط والأحكام دون سابق إنذار.
            </p>
          </section>

          <section className="glass-card p-5">
            <h2 className="mb-3 text-lg font-extrabold text-white">تواصل معنا</h2>
            <p className="text-sm leading-7 text-white/70">
              إذا كان لديك أي أسئلة حول هذه الشروط، يمكنك التواصل معنا عبر صفحة{' '}
              <Link href="/feedback" className="text-cyan-300 underline">
                تواصل معنا
              </Link>
            </p>
          </section>

          <section className="glass-card p-5 border-2 border-cyan-500/30">
            <p className="text-center text-sm font-bold text-cyan-200">
              باستخدامك لتطبيق موقفي، أنت توافق على هذه الشروط والأحكام
            </p>
          </section>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
