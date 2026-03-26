import type { ReactNode } from 'react'

type PageShellProps = {
  title: string
  description: string
  children?: ReactNode
}

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <section className="relative rounded-[2rem] bg-white/[0.02] p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:p-10 ring-1 ring-white/5">
      {/* Decorative top glare */}
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/[0.04] to-transparent" />
      
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-8">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 text-[14px] text-(--muted) max-w-2xl leading-relaxed">{description}</p>
        </div>
      </div>
      
      <div className="relative z-10 mt-8">
        {children}
      </div>
    </section>
  )
}
