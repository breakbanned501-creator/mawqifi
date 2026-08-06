import { Sparkles, Loader2 } from 'lucide-react';

interface AIAnalysisButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}

export default function AIAnalysisButton({ onClick, disabled, loading }: AIAnalysisButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn-primary relative overflow-hidden w-full py-5 text-lg font-extrabold shadow-lg shadow-cyan-500/30 transition-all ${
        loading ? 'opacity-70' : 'hover:shadow-cyan-500/50 hover:scale-[1.02]'
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-cyan-600/20 animate-pulse" />
      <div className="relative flex items-center justify-center gap-3">
        {loading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin" />
            جاري التحليل...
          </>
        ) : (
          <>
            <Sparkles className="h-6 w-6" />
            حلل بالذكاء الاصطناعي
          </>
        )}
      </div>
    </button>
  );
}
