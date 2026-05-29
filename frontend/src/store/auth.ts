import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../api/types'

interface AuthStore {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  clear: () => void
}

export const useAuth = create<AuthStore>()(
  persist(
    set => ({
      user: null, token: null,
      setAuth: (user, token) => set({ user, token }),
      clear: () => set({ user: null, token: null }),
    }),
    { name: 'vw-auth' },
  ),
)
