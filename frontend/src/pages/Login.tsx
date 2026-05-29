import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authLogin } from '../api'
import { useAuth } from '../store/auth'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { setAuth } = useAuth()
  const nav = useNavigate()

  const mut = useMutation({
    mutationFn: authLogin,
    onSuccess: d => { setAuth(d.user, d.access_token); nav('/') },
  })

  const submit = (e: FormEvent) => { e.preventDefault(); mut.mutate({ email, password }) }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-blue-500 p-12 text-white">
        <div>
          <p className="text-2xl font-extrabold tracking-tight">Ve<span className="opacity-60">Work</span></p>
        </div>
        <div>
          <p className="text-4xl font-extrabold leading-snug mb-4">
            Track work.<br />Ship faster.
          </p>
          <p className="text-blue-100 text-sm leading-relaxed max-w-xs">
            Assign epics, log time, and visualise your team's velocity — all in one place.
          </p>
        </div>
        <p className="text-blue-200 text-xs">&copy; {new Date().getFullYear()} VeCube</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-white flex items-center justify-center px-8">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <p className="text-2xl font-extrabold text-gray-900">Ve<span className="text-blue-500">Work</span></p>
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Sign in</h1>
          <p className="text-sm text-gray-400 mb-8">Welcome back — enter your details below.</p>

          {mut.isError && (
            <div className="mb-5 px-4 py-3 bg-red-50 rounded-lg text-sm text-red-600 font-medium">
              Incorrect email or password.
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email" required autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password" required
                value={password} onChange={e => setPassword(e.target.value)}
                className="input" placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={mut.isPending} className="btn-primary w-full py-2.5 mt-2">
              {mut.isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-gray-400 mt-8">
            No account?{' '}
            <Link to="/register" className="text-blue-500 font-semibold hover:text-blue-600">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
