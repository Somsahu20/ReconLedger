import type { ReactNode } from 'react'

type PageShellProps = {
  title: string
  description: string
  children?: ReactNode
}

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <section className="rounded-2xl border border-(--line) bg-(--surface) p-6 shadow-sm sm:p-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-(--ink)">{title}</h1>
      <p className="mt-2 text-sm text-(--muted)">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  )
}
