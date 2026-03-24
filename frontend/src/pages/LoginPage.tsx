import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthSplitLayout } from '../components/auth/AuthSplitLayout'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const shouldReduceMotion = useReducedMotion()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email || !password) {
      toast.error('Please enter both email and password')
      return
    }

    setIsSubmitting(true)

    try {
      await login({ email, password })
      toast.success('Welcome back')
      navigate('/dashboard', { replace: true })
    } catch {
      toast.error('Invalid email or password')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthSplitLayout
      eyebrow="Secure Access"
      title="Close your monthly books with zero invoice blind spots"
      subtitle="ReconLedger gives finance teams an operational cockpit for extraction, reconciliation, and review. Log in to continue where your controls left off."
      quote="We cut reconciliation turnaround from days to under two hours across 8 entities."
      quoteAuthor="Finance Ops Lead"
      features={[
        { label: 'Invoices validated', value: '30k+' },
        { label: 'Average accuracy', value: '99.2%' },
        { label: 'Audit ready', value: '24/7' },
      ]}
      formTitle="Sign in"
      formSubtitle="Use your workspace credentials to continue auditing invoices."
      footer={
        <div className="flex justify-between gap-3">
          <span className="text-(--muted)">Need a workspace?</span>
          <Link className="font-semibold text-(--brand-ink) hover:underline" to="/register">
            Create account
          </Link>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.2em] text-(--muted)">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            className="w-full rounded-xl border border-(--line) bg-(--surface-soft)/70 px-3 py-3 text-sm text-(--ink) outline-none transition focus:border-(--brand) focus:ring-2 focus:ring-teal-100"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.2em] text-(--muted)">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-xl border border-(--line) bg-(--surface-soft)/70 px-3 py-3 text-sm text-(--ink) outline-none transition focus:border-(--brand) focus:ring-2 focus:ring-teal-100"
          />
        </label>

        <motion.button
          whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
          disabled={isSubmitting}
          type="submit"
          className="w-full rounded-xl bg-(--brand) px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </motion.button>
      </form>
    </AuthSplitLayout>
  )
}
