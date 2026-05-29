import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { analyticsOverview, analyticsTimeByProject, analyticsTeamVelocity, analyticsProductivity, aiAnalyticsInsight } from '../api'
import { Spinner } from '../components/ui'
import { Sparkles } from 'lucide-react'

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card px-6 py-5">
      <p className="label mb-1">{label}</p>
      <p className="text-3xl font-extrabold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function Analytics() {
  const overviewQ = useQuery({ queryKey: ['analytics-overview'], queryFn: analyticsOverview })
  const timeQ    = useQuery({ queryKey: ['analytics-time'],     queryFn: analyticsTimeByProject })
  const velQ     = useQuery({ queryKey: ['analytics-velocity'], queryFn: analyticsTeamVelocity })
  const prodQ    = useQuery({ queryKey: ['analytics-prod'],     queryFn: analyticsProductivity })
  const insightQ = useQuery({ queryKey: ['analytics-insight'],  queryFn: aiAnalyticsInsight, staleTime: 30 * 60_000 })

  const overview = overviewQ.data
  const velByWeek = Object.entries(
    (velQ.data ?? []).reduce<Record<string, number>>((a, v) => ({ ...a, [v.week]: (a[v.week] ?? 0) + v.tasks_completed }), {})
  ).map(([week, tasks]) => ({ week, tasks })).slice(-8)

  const tooltipStyle = { borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: 12, boxShadow: 'none' }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-400 mt-0.5">Team performance overview</p>
      </div>

      {overviewQ.isLoading ? <Spinner /> : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Metric label="Total epics" value={overview?.epics_total ?? 0} />
            <Metric label="Completion rate" value={`${overview?.completion_rate ?? 0}%`} sub={`${overview?.done} completed`} />
            <Metric label="In progress" value={overview?.in_progress ?? 0} />
            <Metric label="Done" value={overview?.done ?? 0} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            <div className="card px-5 py-5">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Hours by project · this week</h3>
              {timeQ.isLoading ? <Spinner /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={timeQ.data ?? []} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="project" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card px-5 py-5">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Team velocity · tasks / week</h3>
              {velQ.isLoading ? <Spinner /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={velByWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="tasks" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Per-user productivity */}
          <div className="card px-5 py-5 mb-5">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Productivity · this week</h3>
            {prodQ.isLoading ? <Spinner /> : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Name','Tasks done','Total hours','Avg h/task'].map(h => (
                      <th key={h} className="pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider text-left first:text-left last:text-right [&:not(:first-child)]:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(prodQ.data ?? []).map(row => (
                    <tr key={row.user_id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 font-semibold text-gray-900">{row.name}</td>
                      <td className="py-3 text-right text-gray-600">{row.tasks_done_this_week}</td>
                      <td className="py-3 text-right text-gray-600">{row.total_hours}h</td>
                      <td className="py-3 text-right text-gray-600">{row.avg_hours_per_task}h</td>
                    </tr>
                  ))}
                  {prodQ.data?.length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-gray-400 text-xs">No data for this week.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* AI insight */}
          <div className="rounded-lg bg-gray-900 px-6 py-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={13} className="text-blue-400" />
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">AI Insight</span>
              {insightQ.isFetching && <Spinner className="h-3 w-3 text-blue-400" />}
            </div>
            {insightQ.isLoading ? (
              <div className="space-y-2">
                {[100, 75, 50].map(w => (
                  <div key={w} className="h-2.5 bg-white/10 rounded-sm animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-300 leading-relaxed">{insightQ.data?.insight ?? 'No insight available.'}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
