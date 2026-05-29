import { useState, useEffect } from 'react'
import { useTimerStore } from '../store/timer'

export function useTimer(id: string, base: number, running: boolean) {
  const { start, stop, elapsed } = useTimerStore()
  const [secs, setSecs] = useState(base)

  useEffect(() => {
    if (running) start(id)
    else stop(id)
  }, [running, id, start, stop])

  useEffect(() => {
    if (!running) { setSecs(base); return }
    setSecs(elapsed(id, base))
    const iv = setInterval(() => setSecs(elapsed(id, base)), 1000)
    return () => clearInterval(iv)
  }, [running, id, base, elapsed])

  return secs
}

export function fmtSeconds(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}h ${m}m ${String(sec).padStart(2, '0')}s`
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}
