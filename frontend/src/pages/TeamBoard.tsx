import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { epicsGet, epicCreate, teamMembers, aiSuggestAssign, projectsGet, projectCreate, projectDelete } from '../api'
import { ProjectTag, StatusBadge, ProgressBar, AICard, EmptyState, Spinner } from '../components/ui'
import { useAuth } from '../store/auth'
import type { Epic, EpicScope, Project } from '../api/types'
import { Sparkles, ChevronDown, ChevronRight } from 'lucide-react'

const SCOPE_STYLES: Record<EpicScope, string> = {
  tech:      'bg-blue-500 text-white',
  civil:     'bg-amber-400 text-white',
  marketing: 'bg-pink-500 text-white',
  design:    'bg-violet-500 text-white',
}

function ScopeBadge({ scope }: { scope: EpicScope | null }) {
  if (!scope) return null
  return (
    <span className={`badge ${SCOPE_STYLES[scope]}`}>
      {scope.charAt(0).toUpperCase() + scope.slice(1)}
    </span>
  )
}

/* ── Create project modal ───────────────────────────────────────────────────── */
function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [tag, setTag]   = useState('')
  const [desc, setDesc] = useState('')
  const [tagTouched, setTagTouched] = useState(false)

  const handleNameChange = (v: string) => {
    setName(v)
    if (!tagTouched) setTag(v.replace(/\s+/g, '').slice(0, 20))
  }

  const mut = useMutation({
    mutationFn: () => projectCreate({ name, tag, description: desc }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-900 mb-4">New Project</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Project name *</label>
            <input
              autoFocus value={name} onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Amara Platform" className="input"
            />
          </div>
          <div>
            <label className="label">Short tag *</label>
            <input
              value={tag}
              onChange={e => { setTag(e.target.value.replace(/\s+/g, '')); setTagTouched(true) }}
              placeholder="e.g. Amara" className="input"
            />
            <p className="text-xs text-gray-400 mt-1">Shown as the badge on epics. No spaces.</p>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              rows={2} value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="What is this project about?" className="input resize-none"
            />
          </div>
        </div>
        {mut.isError && (
          <p className="text-xs text-red-500 mt-2">Tag already exists or invalid.</p>
        )}
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!name || !tag || mut.isPending} className="btn-primary">
            {mut.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── New epic slide-over ────────────────────────────────────────────────────── */
function NewEpicPanel({ defaultProjectTag, onClose }: { defaultProjectTag?: string; onClose: () => void }) {
  const qc = useQueryClient()
  const membersQ  = useQuery({ queryKey: ['team-members'], queryFn: teamMembers })
  const projectsQ = useQuery({ queryKey: ['projects'],     queryFn: projectsGet })
  const employees = (membersQ.data ?? []).filter(m => m.role === 'employee')
  const projects  = projectsQ.data ?? []

  const [f, setF] = useState({ title: '', description: '', project_tag: defaultProjectTag ?? '', scope: '', due_date: '' })
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [aiHint, setAiHint]           = useState<{ id: string; name: string; reason: string } | null>(null)
  const [suggesting, setSuggesting]   = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }))

  const toggleAssignee = (id: string) =>
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleAiSuggest = async () => {
    if (!f.title) return
    setSuggesting(true)
    try {
      const data = await aiSuggestAssign('00000000-0000-0000-0000-000000000000').catch(() => null)
      const top = data?.ranked?.[0]
      if (top) {
        setAiHint({ id: top.user_id, name: top.name, reason: top.reason })
        setAssigneeIds(prev => prev.includes(top.user_id) ? prev : [...prev, top.user_id])
      }
    } finally {
      setSuggesting(false)
    }
  }

  const mut = useMutation({
    mutationFn: () => epicCreate({
      ...f,
      due_date: f.due_date || undefined,
      scope: f.scope || undefined,
      assignee_ids: assigneeIds,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epics'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside className="w-full max-w-md bg-white flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">New Epic</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div><label className="label">Title *</label>
            <input value={f.title} onChange={set('title')} className="input" placeholder="e.g. Redesign onboarding flow" />
          </div>
          <div><label className="label">Description</label>
            <textarea rows={3} value={f.description} onChange={set('description')} className="input resize-none" placeholder="What needs to be done?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Project *</label>
              <select value={f.project_tag} onChange={set('project_tag')} className="input">
                <option value="">Select project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.tag}>{p.name}</option>
                ))}
              </select>
            </div>
            <div><label className="label">Due date</label>
              <input type="date" value={f.due_date} onChange={set('due_date')} className="input" />
            </div>
          </div>
          <div><label className="label">Scope</label>
            <select value={f.scope} onChange={set('scope')} className="input">
              <option value="">No scope</option>
              <option value="tech">Tech</option>
              <option value="civil">Civil</option>
              <option value="marketing">Marketing</option>
              <option value="design">Design</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Assign employees *</label>
              <button onClick={handleAiSuggest} disabled={suggesting || !f.title} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 disabled:opacity-40 font-semibold">
                {suggesting ? <Spinner className="h-3 w-3 text-blue-500" /> : <Sparkles size={11} />} AI suggest
              </button>
            </div>
            {aiHint && (
              <div className="mb-2 px-3 py-2 bg-gray-900 rounded-lg text-xs text-gray-300">
                <strong className="text-white">{aiHint.name}</strong> — {aiHint.reason}
              </div>
            )}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {employees.map(m => {
                const checked = assigneeIds.includes(m.id)
                return (
                  <label key={m.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] ${checked ? 'border-blue-200 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleAssignee(m.id)} className="accent-blue-500" />
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${checked ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {m.name[0].toUpperCase()}
                    </div>
                    <span className={`text-sm font-semibold ${checked ? 'text-blue-700' : 'text-gray-700'}`}>
                      {m.name}{aiHint?.id === m.id ? ' ⭐' : ''}
                    </span>
                  </label>
                )
              })}
              {employees.length === 0 && <p className="text-xs text-gray-400 py-2">No employees available</p>}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!f.title || !f.project_tag || assigneeIds.length === 0 || mut.isPending}
            className="btn-primary"
          >
            {mut.isPending ? 'Creating…' : 'Create epic'}
          </button>
        </div>
      </aside>
    </div>
  )
}

/* ── Epic detail panel ──────────────────────────────────────────────────────── */
function EpicDetailPanel({ epic, onClose }: { epic: Epic; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <aside className="w-full max-w-lg bg-white flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="font-bold text-gray-900">{epic.title}</h2>
              <ProjectTag tag={epic.project_tag} />
              <ScopeBadge scope={epic.scope} />
            </div>
            <p className="text-xs text-gray-400">
              {epic.assignees.length === 0 ? 'Unassigned' : epic.assignees.map(a => a.name).join(', ')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none font-light mt-0.5">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <AICard epicId={epic.id} />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-gray-700">Progress</span>
              <span className="text-sm font-bold text-gray-900">{Math.round(epic.progress.percent)}%</span>
            </div>
            <ProgressBar pct={epic.progress.percent} />
            <div className="flex gap-4 mt-2 text-xs text-gray-400">
              <span>{epic.progress.done} done</span>
              <span>{epic.progress.in_progress} in progress</span>
              <span>{epic.progress.not_started} not started</span>
            </div>
          </div>
          {epic.description && <p className="text-sm text-gray-600 leading-relaxed">{epic.description}</p>}
        </div>
      </aside>
    </div>
  )
}

/* ── Project section ────────────────────────────────────────────────────────── */
function ProjectSection({
  project, epics, isManager, filterStatus,
  onNewEpic, onSelectEpic, onDeleteProject,
}: {
  project: Project
  epics: Epic[]
  isManager: boolean
  filterStatus: string
  onNewEpic: (tag: string) => void
  onSelectEpic: (epic: Epic) => void
  onDeleteProject: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const filtered = filterStatus ? epics.filter(e => e.status === filterStatus) : epics

  return (
    <div className="card overflow-hidden">
      {/* Project header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-3 flex-1 text-left min-w-0">
          {open
            ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
            : <ChevronRight size={14} className="text-gray-400 shrink-0" />
          }
          <ProjectTag tag={project.tag} />
          <span className="font-bold text-gray-900 text-sm truncate">{project.name}</span>
          <span className="text-xs text-gray-400 shrink-0">{epics.length} epic{epics.length !== 1 ? 's' : ''}</span>
        </button>
        <div className="flex items-center gap-3 shrink-0">
          {isManager && (
            <button
              onClick={() => onNewEpic(project.tag)}
              className="text-xs text-blue-500 hover:text-blue-700 font-semibold"
            >
              + New Epic
            </button>
          )}
          {isManager && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Delete?</span>
                <button onClick={() => onDeleteProject(project.id)} className="text-xs text-red-500 font-semibold hover:text-red-700">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-600">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-gray-300 hover:text-red-400 transition-colors font-bold">✕</button>
            )
          )}
        </div>
      </div>

      {/* Epics list */}
      {open && (
        <div className="divide-y divide-gray-50">
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 px-5 py-4">No epics{filterStatus ? ' matching filter' : ' yet'}.</p>
          )}
          {filtered.map(epic => (
            <button
              key={epic.id}
              onClick={() => onSelectEpic(epic)}
              className="w-full flex items-center gap-5 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="text-sm font-bold text-gray-900 truncate group-hover:text-blue-500 transition-colors">{epic.title}</p>
                  <ScopeBadge scope={epic.scope} />
                </div>
                <p className="text-xs text-gray-400">
                  {epic.assignees.length === 0 ? 'Unassigned' : epic.assignees.map(a => a.name).join(', ')}
                </p>
              </div>
              <div className="w-28 shrink-0">
                <ProgressBar pct={epic.progress.percent} />
                <p className="text-xs text-gray-400 mt-0.5 text-right">{Math.round(epic.progress.percent)}%</p>
              </div>
              <StatusBadge status={epic.status} />
              {epic.due_date && (
                <span className="text-xs text-gray-400 shrink-0 w-20 text-right">
                  {new Date(epic.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export function TeamBoard() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isManager = user?.role === 'manager' || user?.role === 'admin'

  const [showNewProject, setShowNewProject] = useState(false)
  const [newEpicTag, setNewEpicTag]         = useState<string | undefined>()
  const [selected, setSelected]             = useState<Epic | null>(null)
  const [filterStatus, setFilterStatus]     = useState('')

  const projectsQ = useQuery({ queryKey: ['projects'],         queryFn: projectsGet })
  const epicsQ    = useQuery({ queryKey: ['epics', 'team', '', filterStatus], queryFn: () => epicsGet({ ...(filterStatus && { status: filterStatus }) }) })

  const projects = projectsQ.data ?? []
  const epics    = epicsQ.data ?? []

  const delProject = useMutation({
    mutationFn: (id: string) => projectDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  const knownTags = new Set(projects.map(p => p.tag))
  const orphanEpics = epics.filter(e => !knownTags.has(e.project_tag))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Team Board</h1>
          <p className="text-sm text-gray-400 mt-0.5">All projects and their epics</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input w-auto">
            <option value="">All statuses</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
          {isManager && (
            <button onClick={() => setShowNewProject(true)} className="btn-primary">+ New Project</button>
          )}
        </div>
      </div>

      {(projectsQ.isLoading || epicsQ.isLoading) && <Spinner />}

      {!projectsQ.isLoading && projects.length === 0 && (
        <EmptyState icon="📁" title="No projects yet" body="Create a project to start organising epics." />
      )}

      <div className="space-y-4">
        {projects.map(project => (
          <ProjectSection
            key={project.id}
            project={project}
            epics={epics.filter(e => e.project_tag === project.tag)}
            isManager={isManager}
            filterStatus={filterStatus}
            onNewEpic={tag => setNewEpicTag(tag)}
            onSelectEpic={setSelected}
            onDeleteProject={id => delProject.mutate(id)}
          />
        ))}

        {/* Orphaned epics */}
        {orphanEpics.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="text-sm font-bold text-gray-500">Other</span>
              <span className="text-xs text-gray-400">{orphanEpics.length} epic{orphanEpics.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {orphanEpics.map(epic => (
                <button
                  key={epic.id}
                  onClick={() => setSelected(epic)}
                  className="w-full flex items-center gap-5 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-gray-900 truncate group-hover:text-blue-500 transition-colors">{epic.title}</p>
                      <ProjectTag tag={epic.project_tag} />
                    </div>
                    <p className="text-xs text-gray-400">
                      {epic.assignees.length === 0 ? 'Unassigned' : epic.assignees.map(a => a.name).join(', ')}
                    </p>
                  </div>
                  <StatusBadge status={epic.status} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showNewProject && <CreateProjectModal onClose={() => setShowNewProject(false)} />}
      {newEpicTag !== undefined && <NewEpicPanel defaultProjectTag={newEpicTag} onClose={() => setNewEpicTag(undefined)} />}
      {selected && <EpicDetailPanel epic={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
