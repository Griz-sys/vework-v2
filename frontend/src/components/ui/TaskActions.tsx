import { useTaskActions } from '../../hooks/useTaskActions'
import { Timer } from './Timer'
import { fmtSeconds } from '../../hooks/useTimer'
import type { Subtask } from '../../api/types'

export function TaskActions({ subtask, epicId }: { subtask: Subtask; epicId?: string }) {
  const { start, pause, resume, end } = useTaskActions(epicId)
  const busy = start.isPending || pause.isPending || resume.isPending || end.isPending

  if (subtask.status === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
        <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500 inline-block" />
        {fmtSeconds(subtask.total_time_seconds)}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {subtask.status === 'in_progress' && (
        <Timer id={subtask.id} base={subtask.total_time_seconds} running />
      )}
      {subtask.status === 'paused' && (
        <Timer id={subtask.id} base={subtask.total_time_seconds} running={false} />
      )}

      {subtask.status === 'not_started' && (
        <button
          onClick={e => { e.stopPropagation(); start.mutate(subtask.id) }}
          disabled={busy}
          className="px-3 py-1 rounded-md bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-40 transition-all hover:scale-105"
        >
          Start
        </button>
      )}

      {subtask.status === 'in_progress' && (
        <>
          <button
            onClick={e => { e.stopPropagation(); pause.mutate(subtask.id) }}
            disabled={busy}
            className="px-3 py-1 rounded-md bg-amber-400 text-white text-xs font-bold hover:bg-amber-500 disabled:opacity-40 transition-all hover:scale-105"
          >
            Pause
          </button>
          <button
            onClick={e => { e.stopPropagation(); end.mutate(subtask.id) }}
            disabled={busy}
            className="px-3 py-1 rounded-md bg-gray-900 text-white text-xs font-bold hover:bg-gray-700 disabled:opacity-40 transition-all hover:scale-105"
          >
            End
          </button>
        </>
      )}

      {subtask.status === 'paused' && (
        <>
          <button
            onClick={e => { e.stopPropagation(); resume.mutate(subtask.id) }}
            disabled={busy}
            className="px-3 py-1 rounded-md bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-40 transition-all hover:scale-105"
          >
            Resume
          </button>
          <button
            onClick={e => { e.stopPropagation(); end.mutate(subtask.id) }}
            disabled={busy}
            className="px-3 py-1 rounded-md bg-gray-900 text-white text-xs font-bold hover:bg-gray-700 disabled:opacity-40 transition-all hover:scale-105"
          >
            End
          </button>
        </>
      )}
    </div>
  )
}
