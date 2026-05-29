import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { epicGet, subtasksGet, subtaskCreate, commentsGet, commentAdd, docsGet, docUpload } from '../api'
import { AICard, ProgressBar, StatusBadge, ProjectTag, TaskActions, Spinner, EmptyState } from '../components/ui'
import { fmtSeconds } from '../hooks/useTimer'

function bytesHuman(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

export function TaskDetail() {
  const { epicId } = useParams<{ epicId: string }>()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'comments' | 'docs'>('comments')
  const [selectedSt, setSelectedSt] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newComment, setNewComment] = useState('')

  const epicQ = useQuery({ queryKey: ['epics', epicId], queryFn: () => epicGet(epicId!), enabled: !!epicId })
  const subtasksQ = useQuery({ queryKey: ['subtasks', epicId], queryFn: () => subtasksGet(epicId!), enabled: !!epicId })
  const commentsQ = useQuery({ queryKey: ['comments', selectedSt], queryFn: () => commentsGet(selectedSt!), enabled: !!selectedSt })
  const docsQ = useQuery({ queryKey: ['docs', epicId], queryFn: () => docsGet({ epic_id: epicId! }), enabled: !!epicId && tab === 'docs' })

  const addSubtask = useMutation({
    mutationFn: () => subtaskCreate(epicId!, { title: newTitle }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subtasks', epicId] }); setNewTitle('') },
  })
  const addComment = useMutation({
    mutationFn: () => commentAdd(selectedSt!, newComment),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments', selectedSt] }); setNewComment('') },
  })

  const epic = epicQ.data
  const subtasks = subtasksQ.data ?? []

  if (epicQ.isLoading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!epic) return <p className="text-gray-400 text-sm">Epic not found.</p>

  return (
    <div>
      <button onClick={() => nav(-1)} className="text-sm text-gray-400 hover:text-gray-700 mb-5 flex items-center gap-1">
        ← Back
      </button>

      <div className="flex gap-6 items-start">
        {/* Left: main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{epic.title}</h1>
              <ProjectTag tag={epic.project_tag} />
              <StatusBadge status={epic.status} />
            </div>
            <p className="text-sm text-gray-500">
              Assigned to <strong>{epic.assignee?.name ?? '—'}</strong>
              {epic.due_date && <> · Due {new Date(epic.due_date).toLocaleDateString()}</>}
            </p>
          </div>

          {/* AI summary */}
          <AICard epicId={epic.id} />

          {/* Progress */}
          <div className="card px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-bold text-gray-900">{Math.round(epic.progress.percent)}%</span>
            </div>
            <ProgressBar pct={epic.progress.percent} />
            <div className="flex gap-5 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>Done: {epic.progress.done}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>In progress: {epic.progress.in_progress}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block"/>Not started: {epic.progress.not_started}</span>
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Subtasks</h3>
            <div className="space-y-2">
              {subtasks.map(st => (
                <div
                  key={st.id}
                  onClick={() => setSelectedSt(selectedSt === st.id ? null : st.id)}
                  className={`card flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-all ${
                    selectedSt === st.id ? 'ring-2 ring-indigo-400 border-transparent' : 'hover:shadow-card-md'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{st.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{fmtSeconds(st.total_time_seconds)}</span>
                      {st.comment_count > 0 && <span>💬 {st.comment_count}</span>}
                      {st.document_count > 0 && <span>📎 {st.document_count}</span>}
                    </div>
                  </div>
                  <StatusBadge status={st.status} />
                  <TaskActions subtask={st} epicId={epicId} />
                </div>
              ))}
            </div>

            {/* Add subtask */}
            <div className="flex gap-2 mt-3">
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && newTitle && addSubtask.mutate()}
                placeholder="+ Add a subtask…"
                className="flex-1 px-4 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-solid bg-transparent"
              />
              <button
                onClick={() => addSubtask.mutate()}
                disabled={!newTitle || addSubtask.isPending}
                className="btn-primary"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Right: comments / docs */}
        <div className="w-80 shrink-0">
          <div className="card overflow-hidden">
            <div className="flex border-b border-gray-100">
              {(['comments', 'docs'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    tab === t ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-25' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'comments' ? 'Comments' : 'Documents'}
                </button>
              ))}
            </div>

            <div className="p-4">
              {tab === 'comments' && (
                !selectedSt
                  ? <EmptyState icon="💬" title="Select a subtask" body="Click any subtask to view its comments." />
                  : <>
                    <div className="space-y-3 max-h-80 overflow-y-auto mb-3">
                      {commentsQ.isLoading && <Spinner className="h-4 w-4 text-gray-400 mx-auto" />}
                      {(commentsQ.data ?? []).map(c => (
                        <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-700 mb-0.5">{c.user?.name}</p>
                          <p className="text-sm text-gray-700">{c.body}</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleTimeString()}</p>
                        </div>
                      ))}
                      {commentsQ.data?.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No comments yet.</p>}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && newComment && addComment.mutate()}
                        placeholder="Write a comment…"
                        className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button onClick={() => addComment.mutate()} disabled={!newComment} className="btn-primary text-xs px-3">Send</button>
                    </div>
                  </>
              )}

              {tab === 'docs' && (
                <div className="space-y-2">
                  {docsQ.isLoading && <Spinner className="h-4 w-4 text-gray-400 mx-auto" />}
                  {(docsQ.data ?? []).map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="flex-1 text-xs text-gray-700 truncate">{doc.title}</span>
                      <span className={`badge text-xs ${doc.drive_sync_status === 'synced' ? 'bg-green-50 text-green-700' : doc.drive_sync_status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                        {doc.drive_sync_status}
                      </span>
                    </div>
                  ))}
                  {docsQ.data?.length === 0 && <EmptyState icon="📎" title="No documents" />}
                  <label className="mt-2 flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-indigo-300 hover:bg-indigo-25 transition-colors text-xs text-gray-400 hover:text-indigo-600">
                    <span>Upload document</span>
                    <input type="file" className="hidden" onChange={async e => {
                      const f = e.target.files?.[0]
                      if (f) { await docUpload(f, epicId); qc.invalidateQueries({ queryKey: ['docs', epicId] }) }
                    }} />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
