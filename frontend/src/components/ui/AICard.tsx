import { useQuery } from '@tanstack/react-query'
import { epicAiSummary } from '../../api'
import { Spinner } from './Spinner'
import { Sparkles } from 'lucide-react'

export function AICard({ epicId }: { epicId: string }) {
  const q = useQuery({
    queryKey: ['ai-summary', epicId],
    queryFn: () => epicAiSummary(epicId),
    staleTime: 30 * 60_000,
  })
  return (
    <div className="rounded-lg bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-blue-400" />
          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">AI Summary</span>
        </div>
        <button
          onClick={() => q.refetch()}
          disabled={q.isFetching}
          className="text-xs text-gray-500 font-semibold hover:text-white disabled:opacity-40 transition-colors"
        >
          {q.isFetching ? 'Refreshing…' : '↺ Refresh'}
        </button>
      </div>
      {q.isLoading ? (
        <div className="space-y-2">
          {[100, 80, 60].map(w => (
            <div key={w} className="h-2.5 bg-white/10 rounded-sm animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-300 leading-relaxed">{q.data?.summary ?? 'No summary yet.'}</p>
      )}
    </div>
  )
}
