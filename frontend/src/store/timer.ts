import { create } from 'zustand'

interface TimerStore {
  running: Record<string, number>  // subtaskId → startedAt epoch ms
  start: (id: string) => void
  stop: (id: string) => void
  elapsed: (id: string, base: number) => number
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  running: {},
  start: id => set(s => ({ running: { ...s.running, [id]: Date.now() } })),
  stop: id => set(s => { const r = { ...s.running }; delete r[id]; return { running: r } }),
  elapsed: (id, base) => {
    const t = get().running[id]
    return t ? base + Math.floor((Date.now() - t) / 1000) : base
  },
}))
