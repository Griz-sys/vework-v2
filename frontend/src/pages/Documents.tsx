import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { docsGet, docUpload, docDelete, docSyncDrive, epicsGet } from '../api'
import { EmptyState, Spinner } from '../components/ui'

function bytesHuman(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [epicId, setEpicId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const epicsQ = useQuery({ queryKey: ['epics'], queryFn: () => epicsGet() })

  const onDrop = useCallback((files: File[]) => { if (files[0]) setFile(files[0]) }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxFiles: 1 })

  const mut = useMutation({
    mutationFn: () => docUpload(file!, epicId || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['docs'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <h3 className="font-bold text-gray-900 mb-5">Upload document</h3>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-4 cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <input {...getInputProps()} />
          {file ? (
            <div>
              <p className="text-sm font-semibold text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{bytesHuman(file.size)}</p>
            </div>
          ) : (
            <div>
              <p className="text-2xl mb-2">📁</p>
              <p className="text-sm text-gray-500">Drop a file here or <span className="text-blue-500 font-semibold">browse</span></p>
            </div>
          )}
        </div>

        <div className="mb-5">
          <label className="label">Link to epic (optional)</label>
          <select value={epicId} onChange={e => setEpicId(e.target.value)} className="input">
            <option value="">No epic</option>
            {(epicsQ.data ?? []).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={!file || mut.isPending} className="btn-primary">
            {mut.isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Documents() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const qc = useQueryClient()

  const docsQ = useQuery({ queryKey: ['docs'], queryFn: () => docsGet() })
  const docs = docsQ.data ?? []
  const projects = [...new Set(docs.map(d => d.project_folder).filter(Boolean))] as string[]
  const filtered = selectedProject ? docs.filter(d => d.project_folder === selectedProject) : docs

  const del  = useMutation({ mutationFn: docDelete,   onSuccess: () => qc.invalidateQueries({ queryKey: ['docs'] }) })
  const sync = useMutation({ mutationFn: docSyncDrive })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-400 mt-0.5">Files attached to your projects</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary">Upload</button>
      </div>

      <div className="flex gap-6">
        {/* Folder tree */}
        <div className="w-44 shrink-0">
          <p className="label mb-3">Folders</p>
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedProject(null)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                !selectedProject ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              All files <span className={`text-xs ml-1 ${!selectedProject ? 'text-white/70' : 'text-gray-400'}`}>({docs.length})</span>
            </button>
            {projects.map(p => (
              <button
                key={p}
                onClick={() => setSelectedProject(p)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedProject === p ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p} <span className={`text-xs ml-1 ${selectedProject === p ? 'text-white/70' : 'text-gray-400'}`}>({docs.filter(d => d.project_folder === p).length})</span>
              </button>
            ))}
          </div>
        </div>

        {/* File list */}
        <div className="flex-1">
          {docsQ.isLoading && <Spinner />}
          {!docsQ.isLoading && filtered.length === 0 && (
            <EmptyState icon="📄" title="No documents yet" body="Upload files to get started." />
          )}
          <div className="space-y-2">
            {filtered.map(doc => (
              <div key={doc.id} className="card flex items-center gap-4 px-5 py-3.5">
                <div className="text-xl shrink-0">📄</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {bytesHuman(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`badge ${
                  doc.drive_sync_status === 'synced'
                    ? 'bg-emerald-500 text-white'
                    : doc.drive_sync_status === 'failed'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {doc.drive_sync_status}
                </span>
                <button onClick={() => sync.mutate(doc.id)} className="text-xs text-blue-500 hover:text-blue-700 font-semibold">Sync</button>
                <button onClick={() => del.mutate(doc.id)} className="text-xs text-red-400 hover:text-red-600 font-semibold">Delete</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  )
}
