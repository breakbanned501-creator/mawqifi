'use client';

import { useState } from 'react';
import { Send, Mail, User, MessageSquare } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import Toast from '@/components/Toast';
import { sanitizeInput } from '@/lib/security';
import { getSupabase } from '@/lib/supabase';
import { useLocale } from '@/components/LocaleProvider';

export default function FeedbackPage() {
  const { formatNumber, t } = useLocale();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!name.trim()) {
      setError(t('feedback.nameRequired'));
      return;
    }
    if (name.trim().length < 2) {
      setError(t('feedback.nameShort'));
      return;
    }
    if (name.trim().length > 50) {
      setError(t('feedback.nameLong'));
      return;
    }
    if (!message.trim()) {
      setError(t('feedback.messageRequired'));
      return;
    }
    if (message.trim().length < 10) {
      setError(t('feedback.messageShort'));
      return;
    }
    if (message.trim().length > 500) {
      setError(t('feedback.messageLong'));
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('feedback.invalidEmail'));
      return;
    }

    setSubmitting(true);
    
    try {
      // Sanitize inputs
      const sanitizedData = {
        name: sanitizeInput(name.trim()),
        email: email ? sanitizeInput(email.trim()) : '',
        message: sanitizeInput(message.trim()),
      };

      // Insert into Supabase feedback table
      const supabase = getSupabase();
      const { error: insertError } = await supabase
        .from('feedback')
        .insert({
          name: sanitizedData.name,
          email: sanitizedData.email || null,
          message: sanitizedData.message,
        });

      if (insertError) {
        throw insertError;
      }
      
      setToast(t('feedback.success'));
      setName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      console.error('Feedback submission error:', err);
      setError(t('feedback.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <Toast message={toast} visible={Boolean(toast)} onHide={() => setToast('')} />
      
      <div className="mx-auto max-w-md space-y-6">
        <PageHeader title={t('feedback.title')} subtitle={t('feedback.subtitle')} backHref="/" />

        <div className="space-y-4">
          <div className="glass-card p-5">
            <p className="text-sm leading-7 text-white/70">
              {t('feedback.intro')}
            </p>
          </div>

          {error && (
            <div className="glass-card border-2 border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-bold text-red-200">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="glass-card p-5 space-y-4">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-bold text-white">
                  {t('feedback.name')} <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('feedback.namePlaceholder')}
                    maxLength={50}
                    className="w-full rounded-2xl border border-white/10 bg-navy-950 px-4 py-3 pe-12 text-sm text-white outline-none placeholder:text-white/40 focus:border-cyan-500"
                    dir="auto"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-bold text-white">
                  {t('feedback.email')} <span className="text-white/40">({t('common.optional')})</span>
                </label>
                <div className="relative">
                  <Mail className="absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@ku.edu.kw"
                    maxLength={100}
                    className="w-full rounded-2xl border border-white/10 bg-navy-950 px-4 py-3 pe-12 text-sm text-white outline-none placeholder:text-white/40 focus:border-cyan-500"
                    dir="ltr"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="message" className="mb-2 block text-sm font-bold text-white">
                  {t('feedback.message')} <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <MessageSquare className="absolute end-3 top-3 h-5 w-5 text-white/40" />
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('feedback.messagePlaceholder')}
                    maxLength={500}
                    rows={5}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-navy-950 px-4 py-3 pe-12 text-sm text-white outline-none placeholder:text-white/40 focus:border-cyan-500"
                    dir="auto"
                    disabled={submitting}
                  />
                </div>
                <p className="mt-1 text-xs text-white/40">
                  {t('feedback.characterCount', { count: formatNumber(message.length) })}
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary flex w-full items-center justify-center gap-2 py-4 text-base"
              >
                <Send className="h-5 w-5" />
                {submitting ? t('common.sending') : t('feedback.submit')}
              </button>
            </div>
          </form>

          <div className="glass-card p-5">
            <h3 className="mb-3 text-sm font-extrabold text-white">{t('feedback.quickLinks')}</h3>
            <div className="space-y-2 text-sm">
              <a href="/privacy" className="block text-cyan-300 hover:underline">
                {t('footer.privacy')}
              </a>
              <a href="/terms" className="block text-cyan-300 hover:underline">
                {t('footer.terms')}
              </a>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
