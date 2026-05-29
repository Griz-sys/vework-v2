export type Role = 'admin' | 'manager' | 'employee'
export type EpicStatus = 'not_started' | 'in_progress' | 'done'
export type EpicScope = 'tech' | 'civil' | 'marketing' | 'design'
export type SubtaskStatus = 'not_started' | 'in_progress' | 'paused' | 'done'
export type SyncStatus = 'pending' | 'synced' | 'failed'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  skill_profile: Record<string, unknown>
  created_at: string
}

export interface EpicProgress {
  total: number
  done: number
  in_progress: number
  not_started: number
  paused: number
  percent: number
}

export interface Epic {
  id: string
  title: string
  description: string
  project_tag: string
  scope: EpicScope | null
  status: EpicStatus
  assigned_by_id: string
  due_date: string | null
  created_at: string
  updated_at: string
  assignees: Pick<User, 'id' | 'name' | 'email' | 'role'>[]
  assigner: Pick<User, 'id' | 'name'> | null
  progress: EpicProgress
}

export interface Subtask {
  id: string
  epic_id: string
  created_by_id: string
  title: string
  description: string
  status: SubtaskStatus
  started_at: string | null
  paused_at: string | null
  ended_at: string | null
  total_time_seconds: number
  created_at: string
  updated_at: string
  created_by: Pick<User, 'id' | 'name'> | null
  comment_count: number
  document_count: number
}

export interface Document {
  id: string
  title: string
  file_size: number
  mime_type: string
  uploaded_by_id: string
  epic_id: string | null
  subtask_id: string | null
  project_folder: string | null
  drive_file_id: string | null
  drive_sync_status: SyncStatus
  created_at: string
}

export interface Comment {
  id: string
  body: string
  created_at: string
  user: Pick<User, 'id' | 'name'> | null
}

export interface Project {
  id: string
  name: string
  tag: string
  description: string
  created_by_id: string
  created_by: Pick<User, 'id' | 'name'> | null
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface ManagerWithTeam {
  id: string
  name: string
  email: string
  role: Role
  created_at: string
  employees: Pick<User, 'id' | 'name' | 'email'>[]
  epic_count: number
}

export interface AdminOverview {
  stats: {
    admins: number
    managers: number
    employees: number
    total_epics: number
    active_epics: number
  }
  managers: ManagerWithTeam[]
  unassigned_employees: Pick<User, 'id' | 'name' | 'email'>[]
  all_employees: Pick<User, 'id' | 'name' | 'email'>[]
}
