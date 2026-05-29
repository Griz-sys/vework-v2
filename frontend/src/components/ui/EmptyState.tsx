export function EmptyState({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center text-2xl mb-4">
        {icon}
      </div>
      <p className="text-sm font-bold text-gray-900 uppercase tracking-wider">{title}</p>
      {body && <p className="text-sm text-gray-500 mt-1.5 max-w-xs">{body}</p>}
    </div>
  )
}
