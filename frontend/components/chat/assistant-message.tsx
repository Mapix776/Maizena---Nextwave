import type { ReactNode } from 'react'

export function AssistantMessage({
  text,
  children,
}: {
  text: string
  children?: ReactNode
}) {
  return (
    <div className="rendered-assistant-message">
      <p>{text}</p>
      {children && <div className="rendered-assistant-demo">{children}</div>}
    </div>
  )
}
