import type { ReactNode } from 'react'

export function AssistantMessage({
  text,
  children,
}: {
  text: string
  children?: ReactNode
}) {
  return (
    <div className="w-full text-foreground">
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
      {children && <div className="mt-4 w-full">{children}</div>}
    </div>
  )
}
