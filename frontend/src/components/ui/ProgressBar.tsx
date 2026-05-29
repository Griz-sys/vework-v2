export function ProgressBar({ pct, className = '' }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 bg-gray-200 rounded-sm overflow-hidden ${className}`}>
      <div
        className="h-full bg-blue-500 transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}
