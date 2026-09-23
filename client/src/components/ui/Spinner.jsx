export function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 p-8 ${className}`}>
      <span className="size-6 animate-spin rounded-full border-3 border-brand-100 border-t-brand-600" />
      <span className="text-slate-500">{label}</span>
    </div>
  );
}
