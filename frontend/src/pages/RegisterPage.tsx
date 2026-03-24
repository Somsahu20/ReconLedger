import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthSplitLayout } from '../components/auth/AuthSplitLayout'
import { useAuth } from '../hooks/useAuth'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const shouldReduceMotion = useReducedMotion()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = useMemo(() => {
    return fullName.trim().length > 1 && email.trim().length > 3 && password.length >= 8
  }, [email, fullName, password])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    setIsSubmitting(true)

    try {
      await register({
        email,
        full_name: fullName,
        password,
      })

      toast.success('Account created successfully')
      navigate('/dashboard', { replace: true })
    } catch {
      toast.error('Could not create account. Try another email.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthSplitLayout
      eyebrow="New Workspace"
      title="Build an audit-first command center for your AP team"
      subtitle="Create your account to ingest invoices, detect mismatches, and drive review queues with accountable evidence trails."
      quote="Our review backlog dropped by 64% in the first month with ReconLedger."
      quoteAuthor="Controller"
      features={[
        { label: 'Entity ready', value: 'Multi-org' },
        { label: 'Risk signals', value: 'Real-time' },
        { label: 'Review queues', value: 'Smart' },
      ]}
      formTitle="Create account"
      formSubtitle="Set up your workspace in under a minute."
      footer={
        <div className="flex justify-between gap-3">
          <span className="text-(--muted)">Already registered?</span>
          <Link className="font-semibold text-(--brand-ink) hover:underline" to="/login">
            Back to sign in
          </Link>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.2em] text-(--muted)">
            Full Name
          </span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Priya Sharma"
            className="w-full rounded-xl border border-(--line) bg-(--surface-soft)/70 px-3 py-3 text-sm text-(--ink) outline-none transition focus:border-(--brand) focus:ring-2 focus:ring-teal-100"
          />
        </label>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.2em] text-(--muted)">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="w-full rounded-xl border border-(--line) bg-(--surface-soft)/70 px-3 py-3 text-sm text-(--ink) outline-none transition focus:border-(--brand) focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.2em] text-(--muted)">
              Confirm
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-(--line) bg-(--surface-soft)/70 px-3 py-3 text-sm text-(--ink) outline-none transition focus:border-(--brand) focus:ring-2 focus:ring-teal-100"
            />
          </label>
        </div>

        <motion.button
          whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
          disabled={!canSubmit || isSubmitting}
          type="submit"
          className="w-full rounded-xl bg-(--brand) px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </motion.button>
      </form>
    </AuthSplitLayout>
  )
}
