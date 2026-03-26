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
    <section className="relative isolate overflow-hidden px-4 py-10 sm:px-6 sm:py-14 lg:py-16 min-h-screen flex items-center">
      <AuthScene />
      <div className="auth-noise pointer-events-none absolute inset-0 -z-10 opacity-60" />

      {/* Tonal Architecture without 1px borders for dark mode */}
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.9fr] lg:gap-14">
        
        {/* Left Side: Brand & Context */}
        <motion.aside
          initial={shouldReduceMotion ? false : { opacity: 0, x: -28, y: 10 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col justify-center py-6 sm:p-8"
        >
          <div className="mb-8 inline-flex rounded-full bg-(--surface-high) px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-(--brand)">
            {eyebrow}
          </div>

          <h1 className="max-w-2xl text-[2.75rem] font-light tracking-tight leading-[1.15] text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-(--muted) sm:text-lg">
            {subtitle}
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 15 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.1 + 0.2 }}
                className="rounded-2xl bg-(--surface-soft) p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]"
              >
                <div className="text-2xl font-semibold tracking-tight text-(--brand)">{feature.value}</div>
                <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-(--muted)">
                  {feature.label}
                </div>
              </motion.div>
            ))}
          </div>

          <blockquote className="mt-12 rounded-2xl bg-(--surface-soft) p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] border-l-2 border-(--brand-ink)">
            <p className="text-[15px] leading-relaxed italic text-(--ink) font-serif">"{quote}"</p>
            <footer className="mt-4 text-[11px] font-bold uppercase tracking-[0.15em] text-(--muted)">
              {quoteAuthor}
            </footer>
          </blockquote>
        </motion.aside>

        {/* Right Side: Form Card */}
        <motion.section
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 20 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: shouldReduceMotion ? 0 : 0.1 }}
          className="relative mt-8 lg:mt-0 flex w-full flex-col justify-center rounded-[2rem] bg-[#111827]/40 p-8 shadow-[0_32px_64px_-24px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:p-12 ring-1 ring-white/5"
        >
          {/* Subtle top glare */}
          <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/[0.04] to-transparent" />

          <div className="relative z-10 w-full">
            <h2 className="text-[1.75rem] font-medium tracking-tight text-white mb-2">{formTitle}</h2>
            <p className="text-[13px] text-(--muted) mb-8">{formSubtitle}</p>

            <div className="w-full">{children}</div>

            <div className="mt-8 border-t border-white/5 pt-6 text-[13px]">
              {footer}
            </div>
          </div>
        </motion.section>
      </div>
    </section>
  )
}
