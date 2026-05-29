function hue(tag: string) {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (tag.charCodeAt(i) + ((h << 5) - h)) | 0
  return Math.abs(h) % 360
}

export function ProjectTag({ tag, className = '' }: { tag: string; className?: string }) {
  const h = hue(tag)
  return (
    <span
      className={`badge font-bold uppercase tracking-wider text-[10px] ${className}`}
      style={{
        background: `hsl(${h}, 65%, 90%)`,
        color: `hsl(${h}, 55%, 32%)`,
      }}
    >
      {tag}
    </span>
  )
}
