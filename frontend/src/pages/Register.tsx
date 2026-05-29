import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authRegister } from '../api'
import { useAuth } from '../store/auth'

export function Register() {
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'employee' })
  const { setAuth } = useAuth()
  const nav = useNavigate()

  const mut = useMutation({
    mutationFn: authRegister,
    onSuccess: d => { setAuth(d.user, d.access_token); nav('/') },
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }))

  const submit = (e: FormEvent) => { e.preventDefault(); mut.mutate(f) }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-blue-500 p-12 text-white">
        <div>
          <p className="text-2xl font-extrabold tracking-tight">Ve<span className="opacity-60">Work</span></p>
        </div>
        <div>
          <p className="text-4xl font-extrabold leading-snug mb-4">
            Join your<br />team today.
          </p>
          <p className="text-blue-100 text-sm leading-relaxed max-w-xs">
            Create your account and start collaborating with your team in minutes.
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

          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Create account</h1>
          <p className="text-sm text-gray-400 mb-8">Fill in your details to get started.</p>

          {mut.isError && (
            <div className="mb-5 px-4 py-3 bg-red-50 rounded-lg text-sm text-red-600 font-medium">
              Registration failed. Email may already be taken.
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input required value={f.name} onChange={set('name')} className="input" placeholder="Jane Doe" />
            </div>
            <div>
              <label className="label">Email address</label>
              <input type="email" required value={f.email} onChange={set('email')} className="input" placeholder="you@company.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" required value={f.password} onChange={set('password')} className="input" placeholder="••••••••" />
            </div>
            <div>
              <label className="label">Role</label>
              <select value={f.role} onChange={set('role')} className="input">
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <button type="submit" disabled={mut.isPending} className="btn-primary w-full py-2.5 mt-2">
              {mut.isPending ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-gray-400 mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-500 font-semibold hover:text-blue-600">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
