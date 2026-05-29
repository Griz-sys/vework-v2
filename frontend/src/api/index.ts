import api from './client'
import type { AuthResponse, User, Epic, Subtask, Document, Comment, AdminOverview, Project } from './types'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authRegister = (d: { email: string; name: string; password: string; role: string }) =>
  api.post<AuthResponse>('/auth/register', d).then(r => r.data)
export const authLogin = (d: { email: string; password: string }) =>
  api.post<AuthResponse>('/auth/login', d).then(r => r.data)
export const authLogout = () => api.post('/auth/logout')
export const authMe = () => api.get<User>('/auth/me').then(r => r.data)

// ── Epics ─────────────────────────────────────────────────────────────────────
export const epicsGet = (params?: Record<string, string>) =>
  api.get<Epic[]>('/epics', { params }).then(r => r.data)
export const epicGet = (id: string) => api.get<Epic>(`/epics/${id}`).then(r => r.data)
export const epicCreate = (d: object) => api.post<Epic>('/epics', d).then(r => r.data)
export const epicUpdate = (id: string, d: object) => api.patch<Epic>(`/epics/${id}`, d).then(r => r.data)
export const epicDelete = (id: string) => api.delete(`/epics/${id}`)
export const epicAiSummary = (id: string) =>
  api.get<{ summary: string; cached: boolean }>(`/epics/${id}/ai-summary`).then(r => r.data)

// ── Subtasks ──────────────────────────────────────────────────────────────────
export const subtasksGet = (epicId: string) =>
  api.get<Subtask[]>(`/epics/${epicId}/subtasks`).then(r => r.data)
export const subtaskCreate = (epicId: string, d: object) =>
  api.post<Subtask>(`/epics/${epicId}/subtasks`, d).then(r => r.data)
export const subtaskGet = (id: string) => api.get<Subtask>(`/subtasks/${id}`).then(r => r.data)
export const subtaskUpdate = (id: string, d: object) =>
  api.patch<Subtask>(`/subtasks/${id}`, d).then(r => r.data)
export const subtaskDelete = (id: string) => api.delete(`/subtasks/${id}`)
export const subtaskStart = (id: string) => api.post<Subtask>(`/subtasks/${id}/start`).then(r => r.data)
export const subtaskPause = (id: string) => api.post<Subtask>(`/subtasks/${id}/pause`).then(r => r.data)
export const subtaskResume = (id: string) => api.post<Subtask>(`/subtasks/${id}/resume`).then(r => r.data)
export const subtaskEnd = (id: string) => api.post<Subtask>(`/subtasks/${id}/end`).then(r => r.data)

// ── Comments ──────────────────────────────────────────────────────────────────
export const commentsGet = (subtaskId: string) =>
  api.get<Comment[]>(`/subtasks/${subtaskId}/comments`).then(r => r.data)
export const commentAdd = (subtaskId: string, body: string) =>
  api.post<Comment>(`/subtasks/${subtaskId}/comments`, { body }).then(r => r.data)

// ── Documents ─────────────────────────────────────────────────────────────────
export const docsGet = (params?: Record<string, string>) =>
  api.get<Document[]>('/documents', { params }).then(r => r.data)
export const docUpload = (file: File, epicId?: string, subtaskId?: string) => {
  const fd = new FormData()
  fd.append('file', file)
  if (epicId) fd.append('epic_id', epicId)
  if (subtaskId) fd.append('subtask_id', subtaskId)
  return api.post<Document>('/documents/upload', fd).then(r => r.data)
}
export const docDelete = (id: string) => api.delete(`/documents/${id}`)
export const docSyncDrive = (id: string) => api.post(`/documents/${id}/sync-drive`).then(r => r.data)

// ── Team ──────────────────────────────────────────────────────────────────────
export const teamMembers = () => api.get<User[]>('/team/members').then(r => r.data)
export const teamWorkload = () =>
  api.get<(User & { active_epics: number; subtask_count: number; hours_this_week: number })[]>('/team/workload').then(r => r.data)
export const teamUpdateSkills = (userId: string, skill_profile: object) =>
  api.patch<User>(`/team/members/${userId}/skills`, { skill_profile }).then(r => r.data)

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiSummarise = (epicId: string) =>
  api.post<{ summary: string; cached: boolean }>('/ai/summarise-epic', { epic_id: epicId }).then(r => r.data)
export const aiSuggestAssign = (epicId: string) =>
  api.post<{ ranked: { user_id: string; name: string; reason: string; fit_score: number }[] }>(
    '/ai/suggest-assignment', { epic_id: epicId }).then(r => r.data)
export const aiDailyRecap = (userId: string, date: string) =>
  api.post<{ summary: string; tomorrow_priorities: string[] }>('/ai/daily-recap', { user_id: userId, date }).then(r => r.data)
export const aiPrioritise = (userId: string) =>
  api.post<{ ranked: { subtask_id: string; title: string; reason: string }[] }>(
    '/ai/prioritise-tasks', { user_id: userId }).then(r => r.data)
export const aiAnalyticsInsight = () =>
  api.get<{ insight: string }>('/ai/analytics-insight').then(r => r.data)

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsGet = () => api.get<Project[]>('/projects').then(r => r.data)
export const projectCreate = (d: { name: string; tag: string; description?: string }) =>
  api.post<Project>('/projects', d).then(r => r.data)
export const projectDelete = (id: string) => api.delete(`/projects/${id}`)

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminOverview = () => api.get<AdminOverview>('/admin/overview').then(r => r.data)
export const adminUsers = () => api.get<User[]>('/admin/users').then(r => r.data)
export const adminAssignEmployee = (managerId: string, employeeId: string) =>
  api.post(`/admin/managers/${managerId}/employees/${employeeId}`).then(r => r.data)
export const adminUnassignEmployee = (managerId: string, employeeId: string) =>
  api.delete(`/admin/managers/${managerId}/employees/${employeeId}`).then(r => r.data)

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsOverview = () =>
  api.get<{ epics_total: number; done: number; in_progress: number; completion_rate: number }>('/analytics/overview').then(r => r.data)
export const analyticsTimeByProject = () =>
  api.get<{ project: string; hours: number }[]>('/analytics/time-by-project').then(r => r.data)
export const analyticsTeamVelocity = () =>
  api.get<{ user_id: string; week: string; tasks_completed: number }[]>('/analytics/team-velocity').then(r => r.data)
export const analyticsProductivity = () =>
  api.get<{ user_id: string; name: string; tasks_done_this_week: number; total_hours: number; avg_hours_per_task: number }[]>('/analytics/productivity').then(r => r.data)
