import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AuthScene } from '../three/AuthScene'

type Feature = {
  label: string
  value: string
}

type AuthSplitLayoutProps = {
  eyebrow: string
  title: string
  subtitle: string
  quote: string
  quoteAuthor: string
  features: Feature[]
  formTitle: string
  formSubtitle: string
  footer: ReactNode
  children: ReactNode
}

export function AuthSplitLayout({
  eyebrow,
  title,
  subtitle,
  quote,
  quoteAuthor,
  features,
  formTitle,
  formSubtitle,
  footer,
  children,
}: AuthSplitLayoutProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="relative isolate overflow-hidden px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
      <AuthScene />
      <div className="auth-noise pointer-events-none absolute inset-0 -z-10" />

      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.9fr] lg:gap-10">
        <motion.aside
          initial={shouldReduceMotion ? false : { opacity: 0, x: -28 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-3xl border border-(--line) bg-(--surface-soft)/80 p-6 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:p-8"
        >
          <div className="mb-6 inline-flex rounded-full border border-(--line) bg-(--surface) px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-(--muted)">
            {eyebrow}
          </div>

          <h1 className="max-w-2xl text-3xl font-black leading-tight text-(--ink) sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-(--muted) sm:text-base">{subtitle}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {features.map((feature) => (
              <motion.div
                key={feature.label}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="rounded-2xl border border-(--line) bg-(--surface) p-3.5"
              >
                <div className="text-lg font-extrabold text-(--brand)">{feature.value}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-(--muted)">
                  {feature.label}
                </div>
              </motion.div>
            ))}
          </div>

          <blockquote className="mt-8 rounded-2xl border border-(--line) bg-(--surface) p-4 text-sm leading-6 text-(--ink)">
            "{quote}"
            <footer className="mt-2 text-xs font-semibold uppercase tracking-widest text-(--muted)">
              {quoteAuthor}
            </footer>
          </blockquote>
        </motion.aside>

        <motion.section
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: shouldReduceMotion ? 0 : 0.05 }}
          className="relative rounded-3xl border border-(--line) bg-(--surface) p-6 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.55)] backdrop-blur sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/15" />

          <h2 className="text-2xl font-black text-(--ink)">{formTitle}</h2>
          <p className="mt-2 text-sm text-(--muted)">{formSubtitle}</p>

          <div className="mt-6">{children}</div>

          <div className="mt-6 border-t border-(--line) pt-4 text-sm">{footer}</div>
        </motion.section>
      </div>
    </section>
  )
}
