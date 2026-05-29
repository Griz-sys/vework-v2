import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsGet, projectCreate, projectDelete } from '../api'
import { Spinner, EmptyState } from '../components/ui'
import { useAuth } from '../store/auth'
import type { Project } from '../api/types'

const TAG_COLORS = [
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-pink-50 text-pink-700 border-pink-200',
]

function tagColor(tag: string) {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % TAG_COLORS.length
  return TAG_COLORS[h]
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
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">New Project</h3>
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
            <p className="text-xs text-gray-400 mt-1">Used as the badge label on epics. No spaces.</p>
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
          <p className="text-xs text-red-500 mt-2">
            {(mut.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Something went wrong'}
          </p>
        )}
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={() => mut.mutate()}
            disabled={!name || !tag || mut.isPending}
            className="btn-primary"
          >
            {mut.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Project card ───────────────────────────────────────────────────────────── */
function ProjectCard({ project, canDelete }: { project: Project; canDelete: boolean }) {
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const del = useMutation({
    mutationFn: () => projectDelete(project.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  return (
    <div className="card px-6 py-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-semibold border ${tagColor(project.tag)}`}>
            {project.tag}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{project.name}</p>
            <p className="text-xs text-gray-400">Created by {project.created_by?.name ?? '—'}</p>
          </div>
        </div>
        {canDelete && (
          confirming ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500">Delete?</span>
              <button
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="text-xs text-red-600 font-medium hover:text-red-800"
              >
                Yes
              </button>
              <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:text-gray-600">No</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-gray-300 hover:text-red-400 transition-colors shrink-0"
            >
              ✕
            </button>
          )
        )}
      </div>
      {project.description && (
        <p className="text-sm text-gray-500 leading-relaxed">{project.description}</p>
      )}
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export function Projects() {
  const { user } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const isManager = user?.role === 'manager' || user?.role === 'admin'

  const projectsQ = useQuery({ queryKey: ['projects'], queryFn: projectsGet })
  const projects = projectsQ.data ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">All projects your team works under</p>
        </div>
        {isManager && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ New Project</button>
        )}
      </div>

      {projectsQ.isLoading && <Spinner />}
      {!projectsQ.isLoading && projects.length === 0 && (
        <EmptyState icon="📁" title="No projects yet" body="Create a project to start organising epics." />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} canDelete={isManager} />
        ))}
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
