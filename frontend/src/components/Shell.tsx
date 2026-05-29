import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { authLogout } from '../api'
import {
  LayoutDashboard, Users, FileText, BarChart2,
  Shield, LogOut, Briefcase,
} from 'lucide-react'

const NAV = [
  { to: '/admin',     label: 'Admin',       icon: Shield,          roles: ['admin'] },
  { to: '/',          label: 'My Tasks',    icon: LayoutDashboard, roles: ['employee', 'manager', 'admin'] },
  { to: '/team',      label: 'Team Board',  icon: Briefcase,       roles: ['manager', 'admin'] },
  { to: '/docs',      label: 'Documents',   icon: FileText,        roles: ['employee', 'manager', 'admin'] },
  { to: '/analytics', label: 'Analytics',   icon: BarChart2,       roles: ['manager', 'admin'] },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, clear } = useAuth()
  const nav = useNavigate()

  const handleLogout = async () => {
    await authLogout().catch(() => null)
    clear()
    nav('/login')
  }

  const visible = NAV.filter(n => user && n.roles.includes(user.role))

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-56 shrink-0 bg-gray-900 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5">
          <span className="text-lg font-extrabold tracking-tighter text-white">
            Ve<span className="text-blue-500">Work</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {visible.map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-3 text-sm font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={16} strokeWidth={2.5} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 font-semibold hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
