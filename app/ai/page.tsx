'use client';

import { useState } from 'react';
import { Sparkles, Upload, FileText, AlertTriangle, CheckCircle, Info, Calendar, Lightbulb } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import FileUpload from '@/components/FileUpload';
import AIAnalysisButton from '@/components/AIAnalysisButton';
import AIResultCard from '@/components/AIResultCard';
import WarningCard from '@/components/WarningCard';
import { analyzeDocuments } from '@/lib/ai';
import type { AIAnalysisResult } from '@/lib/types';

export default function AIAssistantPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesChange = (newFiles: File[]) => {
    setFiles(newFiles);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('الرجاء رفع ملف واحد على الأقل للتحليل');
      return;
    }

    setAnalyzing(true);
    setError(null);
    
    try {
      const analysisResults = await analyzeDocuments(files);
      setResults(analysisResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء التحليل');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <main className="page-with-chrome min-h-screen px-4 pt-6">
      <div className="mx-auto max-w-md space-y-6">
        <PageHeader 
          title="مساعد الطالب AI" 
          subtitle="تحليل ذكي لمستنداتك الأكاديمية" 
          backHref="/"
          action={
            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
              Beta
            </span>
          }
        />

        {error && (
          <div className="glass-card border-2 border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
              <p className="text-sm font-bold text-red-200">{error}</p>
            </div>
          </div>
        )}

        <FileUpload files={files} onFilesChange={handleFilesChange} />
        <p className="text-center text-xs text-white/50">ارفع السيلابس أو صورة الدرجات أو إعلان الدكتور</p>

        <AIAnalysisButton 
          onClick={handleAnalyze} 
          disabled={files.length === 0 || analyzing}
          loading={analyzing}
        />
        <p className="text-center text-xs text-white/50">تحليل ذكي استرشادي لمساعدتك أكاديميًا</p>

        {analyzing && (
          <div className="glass-card p-6 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
            <p className="text-sm font-bold text-white">جاري التحليل بالذكاء الاصطناعي...</p>
            <p className="mt-2 text-xs text-white/60">قد يستغرق هذا بضع ثوانٍ</p>
          </div>
        )}

        {results && !analyzing && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="text-lg font-extrabold text-white">نتائج التحليل</h2>
            
            {results.warnings && results.warnings.length > 0 && (
              <div className="space-y-3">
                {results.warnings.map((warning: { severity: 'yellow' | 'red'; title: string; message: string }, index: number) => (
                  <WarningCard
                    key={index}
                    type={warning.severity}
                    title={warning.title}
                    message={warning.message}
                  />
                ))}
              </div>
            )}

            <div className="space-y-3">
              {results.summary && (
                <AIResultCard
                  icon={<FileText className="h-5 w-5 text-cyan-300" />}
                  title="ملخص المادة"
                  content={results.summary}
                  color="cyan"
                />
              )}

              {results.alerts && results.alerts.length > 0 && (
                <AIResultCard
                  icon={<AlertTriangle className="h-5 w-5 text-yellow-300" />}
                  title="تنبيهات مهمة"
                  content={results.alerts.join(' • ')}
                  color="yellow"
                />
              )}

              {results.violationCheck && (
                <AIResultCard
                  icon={<CheckCircle className="h-5 w-5 text-emerald-300" />}
                  title="هل يوجد مخالفة محتملة؟"
                  content={results.violationCheck}
                  color="emerald"
                />
              )}

              {results.appealSuggestion && (
                <AIResultCard
                  icon={<Info className="h-5 w-5 text-blue-300" />}
                  title="اقتراح تظلم"
                  content={results.appealSuggestion}
                  color="blue"
                />
              )}

              {results.importantDates && results.importantDates.length > 0 && (
                <AIResultCard
                  icon={<Calendar className="h-5 w-5 text-purple-300" />}
                  title="مواعيد مهمة"
                  content={results.importantDates.join(' • ')}
                  color="purple"
                />
              )}

              {results.advice && (
                <AIResultCard
                  icon={<Lightbulb className="h-5 w-5 text-amber-300" />}
                  title="نصائح أكاديمية"
                  content={results.advice}
                  color="amber"
                />
              )}
            </div>
          </div>
        )}

        {!results && !analyzing && files.length === 0 && (
          <div className="glass-card py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10">
              <Sparkles className="h-8 w-8 text-cyan-300" />
            </div>
            <h3 className="mb-2 text-lg font-extrabold text-white">ابدأ التحليل</h3>
            <p className="text-sm leading-6 text-white/60">
              ارفع مستنداتك الأكاديمية للحصول على تحليل ذكي ومساعدة فورية
            </p>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
