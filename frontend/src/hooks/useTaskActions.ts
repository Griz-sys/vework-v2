import { useMutation, useQueryClient } from '@tanstack/react-query'
import { subtaskStart, subtaskPause, subtaskResume, subtaskEnd } from '../api'

export function useTaskActions(epicId?: string) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['subtasks'] })
    if (epicId) qc.invalidateQueries({ queryKey: ['epics', epicId] })
  }
  return {
    start:  useMutation({ mutationFn: subtaskStart,  onSuccess: refresh }),
    pause:  useMutation({ mutationFn: subtaskPause,  onSuccess: refresh }),
    resume: useMutation({ mutationFn: subtaskResume, onSuccess: refresh }),
    end:    useMutation({ mutationFn: subtaskEnd,    onSuccess: refresh }),
  }
}
