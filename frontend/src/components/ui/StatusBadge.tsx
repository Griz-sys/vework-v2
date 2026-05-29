import clsx from 'clsx'
import type { SubtaskStatus, EpicStatus } from '../../api/types'

const cfg: Record<string, string> = {
  not_started: 'bg-gray-200 text-gray-700',
  in_progress: 'bg-blue-500 text-white',
  paused:      'bg-amber-400 text-white',
  done:        'bg-emerald-500 text-white',
}
const labels: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  paused:      'Paused',
  done:        'Done',
}

export function StatusBadge({ status }: { status: SubtaskStatus | EpicStatus }) {
  return (
    <span className={clsx('badge', cfg[status])}>
      {labels[status] ?? status}
    </span>
  )
}
