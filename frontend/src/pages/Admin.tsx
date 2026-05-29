import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminOverview, adminAssignEmployee, adminUnassignEmployee } from '../api'
import { Spinner } from '../components/ui'
import type { ManagerWithTeam, AdminOverview } from '../api/types'

/* ── Stat card ──────────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card px-6 py-5">
      <p className="label mb-1">{label}</p>
      <p className="text-3xl font-extrabold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

/* ── Manage team panel ──────────────────────────────────────────────────────── */
function ManageTeamPanel({
  manager, overview, onClose,
}: {
  manager: ManagerWithTeam
  overview: AdminOverview
  onClose: () => void
}) {
  const qc = useQueryClient()
  const assignedIds = new Set(manager.employees.map(e => e.id))

  const assign = useMutation({
    mutationFn: (empId: string) => adminAssignEmployee(manager.id, empId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  })
  const unassign = useMutation({
    mutationFn: (empId: string) => adminUnassignEmployee(manager.id, empId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  })

  const isPending = assign.isPending || unassign.isPending

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside className="w-full max-w-md bg-white flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Manage Team</h2>
            <p className="text-xs text-gray-400 mt-0.5">{manager.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2">
          {overview.all_employees.map(emp => {
            const isAssigned = assignedIds.has(emp.id)
            return (
              <div key={emp.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold shrink-0 ${isAssigned ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {emp.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{emp.name}</p>
                  <p className="text-xs text-gray-400 truncate">{emp.email}</p>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => isAssigned ? unassign.mutate(emp.id) : assign.mutate(emp.id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-all hover:scale-105 disabled:opacity-50 ${
                    isAssigned
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {isAssigned ? 'Remove' : 'Add'}
                </button>
              </div>
            )
          })}
          {overview.all_employees.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No employees yet</p>
          )}
        </div>
      </aside>
    </div>
  )
}

/* ── Manager card ───────────────────────────────────────────────────────────── */
function ManagerCard({ manager, onManage }: { manager: ManagerWithTeam; onManage: () => void }) {
  return (
    <div className="card px-6 py-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-blue-500 flex items-center justify-center text-base font-bold text-white shrink-0">
            {manager.name[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{manager.name}</p>
            <p className="text-xs text-gray-400">{manager.email}</p>
          </div>
        </div>
        <span className="badge bg-gray-100 text-gray-600">
          {manager.epic_count} epic{manager.epic_count !== 1 ? 's' : ''}
        </span>
      </div>

      <div>
        <p className="label mb-2">
          Team · {manager.employees.length} member{manager.employees.length !== 1 ? 's' : ''}
        </p>
        {manager.employees.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {manager.employees.map(e => (
              <div key={e.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-md">
                <div className="w-4 h-4 rounded-sm bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                  {e.name[0].toUpperCase()}
                </div>
                <span className="text-xs font-medium text-gray-700">{e.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No employees assigned</p>
        )}
      </div>

      <button onClick={onManage} className="btn-ghost text-sm w-full justify-center">
        Manage Team →
      </button>
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export function Admin() {
  const [managing, setManaging] = useState<ManagerWithTeam | null>(null)

  const overviewQ = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: adminOverview,
  })

  if (overviewQ.isLoading) return <div className="flex justify-center pt-20"><Spinner /></div>
  if (!overviewQ.data) return null

  const { stats, managers } = overviewQ.data

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage the org — assign employees to managers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <StatCard label="Admins"    value={stats.admins} />
        <StatCard label="Managers"  value={stats.managers} />
        <StatCard label="Employees" value={stats.employees} />
        <StatCard label="Total epics"  value={stats.total_epics} />
        <StatCard label="Active epics" value={stats.active_epics} sub="in progress" />
      </div>

      {/* Managers grid */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">Managers & Teams</h2>
        {overviewQ.data.unassigned_employees.length > 0 && (
          <span className="badge bg-amber-400 text-white">
            {overviewQ.data.unassigned_employees.length} unassigned
          </span>
        )}
      </div>

      {managers.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">No managers yet. Register a user with the manager role.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {managers.map(m => (
            <ManagerCard key={m.id} manager={m} onManage={() => setManaging(m)} />
          ))}
        </div>
      )}

      {managing && (
        <ManageTeamPanel
          manager={managing}
          overview={overviewQ.data}
          onClose={() => setManaging(null)}
        />
      )}
    </div>
  )
}
