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
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-(--muted)">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-white outline-none transition-all placeholder:text-(--muted)/60 focus:border-(--brand) focus:bg-white/10 focus:ring-4 focus:ring-(--brand)/10"
          />
        </label>

        <label className="block mt-5">
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.1em] text-(--muted)">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-white outline-none transition-all placeholder:text-(--muted)/60 focus:border-(--brand) focus:bg-white/10 focus:ring-4 focus:ring-(--brand)/10"
          />
        </label>

        <motion.button
          whileHover={shouldReduceMotion ? undefined : { scale: 1.01, filter: 'brightness(1.1)' }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
          disabled={isSubmitting}
          type="submit"
          className="mt-8 w-full rounded-lg bg-gradient-to-r from-(--brand) to-(--brand-ink) px-4 py-3.5 text-[14px] font-medium tracking-wide text-[#001c39] shadow-[0_0_20px_rgba(164,201,255,0.15)] transition-all disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </motion.button>
      </form>
    </AuthSplitLayout>
  )
}
