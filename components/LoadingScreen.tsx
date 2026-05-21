export default function LoadingScreen({ message = 'جاري التحميل...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
      <p className="text-sm font-bold text-white/70">{message}</p>
    </div>
  );
}
