import { useTimer, fmtSeconds } from '../../hooks/useTimer'

export function Timer({ id, base, running }: { id: string; base: number; running: boolean }) {
  const secs = useTimer(id, base, running)
  return (
    <span className={`font-mono text-sm tabular-nums ${running ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
      {fmtSeconds(secs)}
    </span>
  )
}
