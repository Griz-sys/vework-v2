import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  epicsGet, subtasksGet, subtaskCreate,
  subtaskStart, subtaskPause, subtaskResume, subtaskEnd,
} from '../api'
import { useAuth } from '../store/auth'
import { StatusBadge, ProjectTag, ProgressBar, TaskActions, EmptyState, Spinner } from '../components/ui'
import { fmtSeconds } from '../hooks/useTimer'
import type { Subtask, Epic } from '../api/types'

type ColId = 'assigned' | 'in_progress' | 'done'

const COLS: { id: ColId; label: string; headerBg: string; headerText: string; ring: string }[] = [
  { id: 'assigned',    label: 'Assigned',    headerBg: 'bg-gray-900',    headerText: 'text-white',       ring: 'ring-gray-400' },
  { id: 'in_progress', label: 'In Progress', headerBg: 'bg-blue-500',    headerText: 'text-white',       ring: 'ring-blue-400' },
  { id: 'done',        label: 'Finished',    headerBg: 'bg-emerald-500', headerText: 'text-white',       ring: 'ring-emerald-400' },
]

function statusToCol(s: Subtask['status']): ColId {
  if (s === 'in_progress') return 'in_progress'
  if (s === 'done') return 'done'
  return 'assigned'
}

/* ── Add subtask modal ──────────────────────────────────────────────────────── */
function AddSubtask({ epics, defaultEpicId, onClose }: { epics: Epic[]; defaultEpicId?: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [epicId, setEpicId] = useState(defaultEpicId ?? epics[0]?.id ?? '')
  const [title, setTitle] = useState('')

  const mut = useMutation({
    mutationFn: () => subtaskCreate(epicId, { title, status: 'not_started', total_time_seconds: 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['board', user?.id] }); onClose() },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-900 mb-4">New subtask</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Epic</label>
            <select value={epicId} onChange={e => setEpicId(e.target.value)} className="input">
              {epics.map(ep => (
                <option key={ep.id} value={ep.id}>{ep.title} ({ep.project_tag})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Title</label>
            <input
              autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?" className="input"
              onKeyDown={e => e.key === 'Enter' && title && mut.mutate()}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!title || !epicId || mut.isPending} className="btn-primary">
            {mut.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Epic row (Assigned epics tab) ──────────────────────────────────────────── */
function EpicRow({ epic, onAdd }: { epic: Epic; onAdd: () => void }) {
  const [open, setOpen] = useState(false)
  const subtasksQ = useQuery({
    queryKey: ['subtasks', epic.id],
    queryFn: () => subtasksGet(epic.id),
    enabled: open,
  })

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-gray-900 text-sm truncate">{epic.title}</span>
            <ProjectTag tag={epic.project_tag} />
          </div>
          <ProgressBar pct={epic.progress.percent} className="w-56" />
          <p className="text-xs text-gray-400 mt-1">{Math.round(epic.progress.percent)}% · {epic.progress.done}/{epic.progress.total} done</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {epic.due_date && (
            <span className="text-xs text-gray-400">Due {new Date(epic.due_date).toLocaleDateString()}</span>
          )}
          <StatusBadge status={epic.status} />
          <span className="text-gray-400 text-xs font-bold">{open ? '▴' : '▾'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 space-y-2">
          {subtasksQ.isLoading && <div className="flex justify-center py-3"><Spinner className="h-4 w-4 text-gray-400" /></div>}
          {subtasksQ.data?.length === 0 && <p className="text-xs text-gray-400 py-2">No subtasks yet.</p>}
          {subtasksQ.data?.map(st => (
            <div key={st.id} className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border border-gray-100">
              <StatusBadge status={st.status} />
              <span className="flex-1 text-sm text-gray-800 truncate">{st.title}</span>
              <TaskActions subtask={st} epicId={epic.id} />
            </div>
          ))}
          <button
            onClick={e => { e.stopPropagation(); onAdd() }}
            className="text-xs text-blue-500 hover:text-blue-700 font-semibold mt-1"
          >
            + Add subtask
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────────── */
export function MyTasks() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab]         = useState<'assigned' | 'board'>('assigned')
  const [showAdd, setShowAdd] = useState(false)
  const [addEpicId, setAddEpicId] = useState<string | undefined>()

  const epicsQ = useQuery({ queryKey: ['epics', 'mine'], queryFn: () => epicsGet() })
  const epics  = epicsQ.data ?? []

  const boardQ = useQuery({
    queryKey: ['board', user?.id],
    enabled: tab === 'board' && epics.length > 0,
    queryFn: async () => {
      const all = await Promise.all(epics.map(e => subtasksGet(e.id)))
      return all.flat()
    },
  })
  const allSubtasks = boardQ.data ?? []

  const grouped: Record<ColId, Subtask[]> = {
    assigned:    allSubtasks.filter(s => s.status === 'not_started' || s.status === 'paused'),
    in_progress: allSubtasks.filter(s => s.status === 'in_progress'),
    done:        allSubtasks.filter(s => s.status === 'done'),
  }

  const moveMut = useMutation({
    mutationFn: async ({ subtask, to }: { subtask: Subtask; to: ColId }) => {
      if (to === 'in_progress') {
        if (subtask.status === 'not_started') await subtaskStart(subtask.id)
        else if (subtask.status === 'paused')  await subtaskResume(subtask.id)
      } else if (to === 'done') {
        if (subtask.status === 'in_progress')      await subtaskEnd(subtask.id)
        else if (subtask.status === 'not_started') { await subtaskStart(subtask.id); await subtaskEnd(subtask.id) }
        else if (subtask.status === 'paused')      { await subtaskResume(subtask.id); await subtaskEnd(subtask.id) }
      } else if (to === 'assigned') {
        if (subtask.status === 'in_progress') await subtaskPause(subtask.id)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board', user?.id] }),
    onError:   () => qc.invalidateQueries({ queryKey: ['board', user?.id] }),
  })

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination } = result
    if (!destination) return

    const to = destination.droppableId as ColId
    const subtask = allSubtasks.find(s => s.id === draggableId)
    if (!subtask || statusToCol(subtask.status) === to) return

    const statusMap: Record<ColId, Subtask['status']> = {
      assigned:    subtask.status === 'in_progress' ? 'paused' : 'not_started',
      in_progress: 'in_progress',
      done:        'done',
    }
    qc.setQueryData(['board', user?.id], (old: Subtask[] | undefined) =>
      old?.map(s => s.id === draggableId ? { ...s, status: statusMap[to] } : s)
    )
    moveMut.mutate({ subtask, to })
  }

  const openAdd = (epicId?: string) => { setAddEpicId(epicId); setShowAdd(true) }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">My Tasks</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track your daily work</p>
        </div>
        {tab === 'board' && (
          <button onClick={() => openAdd()} className="btn-primary">+ New subtask</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 p-1 bg-gray-200 rounded-lg w-fit mb-6">
        {([['assigned', 'Assigned Epics'], ['board', 'My Subtasks']] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              tab === t ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Assigned epics ─────────────────────────────────── */}
      {tab === 'assigned' && (
        <div className="space-y-3">
          {epicsQ.isLoading && <Spinner />}
          {!epicsQ.isLoading && epics.length === 0 && (
            <EmptyState icon="📋" title="No epics assigned" body="Your manager will assign work here." />
          )}
          {epics.map(epic => (
            <EpicRow key={epic.id} epic={epic} onAdd={() => openAdd(epic.id)} />
          ))}
        </div>
      )}

      {/* ── Kanban board ───────────────────────────────────── */}
      {tab === 'board' && (
        boardQ.isLoading
          ? <div className="flex-1 flex items-center justify-center"><Spinner /></div>
          : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex gap-4 flex-1 overflow-x-auto pb-4 min-h-0">
                {COLS.map(col => {
                  const cards = grouped[col.id]

                  return (
                    <div key={col.id} className="flex flex-col min-w-[290px] flex-1 min-h-0">
                      {/* Header */}
                      <div className={`flex items-center justify-between px-4 py-3 rounded-lg mb-3 ${col.headerBg}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${col.headerText}`}>{col.label}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/20 text-white">
                            {cards.length}
                          </span>
                        </div>
                        {col.id !== 'done' && (
                          <button onClick={() => openAdd()} className="text-white/60 hover:text-white text-xs font-bold transition-colors">
                            + Add
                          </button>
                        )}
                      </div>

                      {/* Drop zone */}
                      <Droppable droppableId={col.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex flex-col gap-2.5 flex-1 rounded-lg p-2 transition-all min-h-[160px]
                              ${snapshot.isDraggingOver ? `ring-2 ${col.ring} bg-white/80` : ''}`}
                          >
                            {cards.map((st, index) => {
                              const epic   = epics.find(e => e.id === st.epic_id)
                              const isDone = st.status === 'done'
                              return (
                                <Draggable key={st.id} draggableId={st.id} index={index} isDragDisabled={isDone}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`bg-white rounded-lg border border-gray-100 px-4 py-3.5 select-none
                                        ${isDone
                                          ? 'opacity-60 cursor-default'
                                          : 'cursor-grab hover:border-gray-300 active:cursor-grabbing hover:scale-[1.01]'}
                                        ${snapshot.isDragging ? 'rotate-1 border-gray-300 scale-[1.02]' : ''}
                                        transition-all`}
                                    >
                                      <p className="text-sm font-bold text-gray-900 leading-snug mb-2">{st.title}</p>
                                      {epic && (
                                        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                                          <span className="text-xs text-gray-400 truncate max-w-[120px]">{epic.title}</span>
                                          <ProjectTag tag={epic.project_tag} />
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-400">
                                          ⏱ {st.total_time_seconds > 0 ? fmtSeconds(st.total_time_seconds) : 'No time'}
                                        </span>
                                        {st.status === 'paused' && (
                                          <span className="badge bg-amber-400 text-white">Paused</span>
                                        )}
                                        {st.status === 'in_progress' && (
                                          <span className="badge bg-blue-500 text-white">Active</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              )
                            })}
                            {provided.placeholder}

                            {cards.length === 0 && !snapshot.isDraggingOver && (
                              <div className="rounded-lg border-2 border-dashed border-gray-200 h-20 flex items-center justify-center text-xs text-gray-300 font-medium">
                                Drop here
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )
                })}
              </div>
            </DragDropContext>
          )
      )}

      {showAdd && epics.length > 0 && (
        <AddSubtask epics={epics} defaultEpicId={addEpicId} onClose={() => setShowAdd(false)} />
      )}
    </div>
  )
}
