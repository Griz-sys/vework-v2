import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from './store/auth'
import { Shell } from './components/Shell'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { MyTasks } from './pages/MyTasks'
import { TeamBoard } from './pages/TeamBoard'
import { TaskDetail } from './pages/TaskDetail'
import { Documents } from './pages/Documents'
import { Analytics } from './pages/Analytics'
import { Admin } from './pages/Admin'
import { Projects } from './pages/Projects'

function Guard({
  children,
  managerOnly = false,
  adminOnly = false,
}: {
  children: React.ReactNode
  managerOnly?: boolean
  adminOnly?: boolean
}) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />
  if (managerOnly && !['manager', 'admin'].includes(user.role)) return <Navigate to="/" replace />
  return <Shell>{children}</Shell>
}

export const router = createBrowserRouter([
  { path: '/login',    element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/',         element: <Guard><MyTasks /></Guard> },
  { path: '/team',     element: <Guard managerOnly><TeamBoard /></Guard> },
  { path: '/epics/:epicId', element: <Guard><TaskDetail /></Guard> },
  { path: '/projects', element: <Guard><Projects /></Guard> },
  { path: '/docs',     element: <Guard><Documents /></Guard> },
  { path: '/analytics',element: <Guard managerOnly><Analytics /></Guard> },
  { path: '/admin',    element: <Guard adminOnly><Admin /></Guard> },
  { path: '*',         element: <Navigate to="/" replace /> },
])
