import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Activity, AlertTriangle, CheckCircle2, Clock3, FileText, Search, Sparkles, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getDashboardStats } from '../api/dashboard'
import { DashboardScene } from '../components/three/DashboardScene'
import { formatCurrency, formatDate, toStatusLabel } from '../lib/formatters'
import { PageShell } from './PageShell'

const itemVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
}

const quickActionTransition = { type: 'spring' as const, stiffness: 320, damping: 24 }

type CountUpSafeProps = {
  end: number | string
  duration?: number
  decimals?: number
  separator?: string
}

function CountUpSafe({ end, duration = 1.1, decimals = 0, separator = ',' }: CountUpSafeProps) {
  const parsedEnd = Number(end)
  const targetValue = Number.isFinite(parsedEnd) ? parsedEnd : 0
  const [value, setValue] = useState(0)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion || duration <= 0) {
      setValue(targetValue)
      return
    }

    let frameId = 0
    const start = performance.now()
    const startValue = value
    const delta = targetValue - startValue
    const totalDurationMs = duration * 1000

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / totalDurationMs, 1)
      // Ease-out curve for smooth number settling.
      const eased = 1 - (1 - progress) * (1 - progress)
      setValue(startValue + delta * eased)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
      }
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [duration, targetValue])

  const formatted = useMemo(() => {
    const formatter = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: Boolean(separator),
    })
    const base = formatter.format(value)
    return separator === ',' ? base : base.replaceAll(',', separator)
  }, [decimals, separator, value])

  return <span>{formatted}</span>
}

function statusClasses(status: unknown) {
  const normalized = typeof status === 'string' ? status.toLowerCase() : 'unknown'
  if (normalized === 'clean') return 'bg-green-100 text-green-800'
  if (normalized === 'reviewed') return 'bg-sky-100 text-sky-800'
  return 'bg-amber-100 text-amber-800'
}

function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl border border-(--line) bg-white/70" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-(--line) bg-white/70" />
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
  })

  const stats = data?.stats
  const recentInvoices = data?.recent_invoices ?? []
  const hasStats = Boolean(stats)

  const isEmpty = !isLoading && !isError && hasStats && (stats?.total_invoices ?? 0) === 0
  const hasDataIssue = !isLoading && !isError && !hasStats

  return (
    <div className="relative">
      <DashboardScene />
      <motion.div
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.08 } } }}
        className="space-y-6"
      >
        <motion.div variants={itemVariants} transition={{ duration: 0.28 }}>
          <PageShell
            title="Dashboard"
            description="Track processing health, flagged backlog, and recent invoice activity in one place."
          >
            {isFetching && !isLoading && (
              <div className="mb-3 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-(--muted)">
                Refreshing dashboard data...
              </div>
            )}

            {isLoading && <DashboardLoading />}

            {isError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                <p className="font-semibold">Could not load dashboard stats.</p>
                <button
                  type="button"
                  onClick={() => {
                    void refetch()
                  }}
                  className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Retry
                </button>
              </div>
            )}

            {hasDataIssue && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                <p className="font-semibold">Dashboard data format looks incomplete.</p>
                <p className="mt-1">Try refreshing. If this continues, verify backend dashboard response fields.</p>
                <button
                  type="button"
                  onClick={() => {
                    void refetch()
                  }}
                  className="mt-3 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Refresh
                </button>
              </div>
            )}

            {isEmpty && (
              <div className="rounded-2xl border border-(--line) bg-white p-6 text-center">
                <p className="text-lg font-semibold text-(--ink)">No invoices yet</p>
                <p className="mt-1 text-sm text-(--muted)">
                  Upload your first invoice to start generating KPIs and audit insights.
                </p>
                <Link
                  to="/upload"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-(--brand) px-4 py-2 text-sm font-semibold text-white"
                >
                  <UploadCloud className="h-4 w-4" />
                  Upload First Invoice
                </Link>
              </div>
            )}

            {!isLoading && !isError && !isEmpty && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
                  <motion.div variants={itemVariants} className="rounded-2xl border border-(--line) bg-white p-3.5 shadow-sm md:p-4">
                    <div className="flex items-center justify-between text-(--muted)">
                      <span className="text-[10px] font-semibold uppercase tracking-wide md:text-xs">Total Invoices</span>
                      <FileText className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-(--ink) md:mt-3 md:text-3xl">
                      <CountUpSafe end={stats.total_invoices} duration={1.1} separator="," />
                    </p>
                    <p className="mt-1 hidden text-xs text-(--muted) md:block">All processed records</p>
                  </motion.div>

                  <motion.div variants={itemVariants} className="rounded-2xl border border-(--line) bg-white p-3.5 shadow-sm md:p-4">
                    <div className="flex items-center justify-between text-(--muted)">
                      <span className="text-[10px] font-semibold uppercase tracking-wide md:text-xs">Processed Today</span>
                      <Activity className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-(--ink) md:mt-3 md:text-3xl">
                      <CountUpSafe end={stats.invoices_today} duration={1.1} separator="," />
                    </p>
                    <p className="mt-1 hidden text-xs text-(--muted) md:block">Fresh throughput</p>
                  </motion.div>

                  <motion.div variants={itemVariants} className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 shadow-sm md:p-4">
                    <div className="flex items-center justify-between text-amber-700">
                      <span className="text-[10px] font-semibold uppercase tracking-wide md:text-xs">Needs Review</span>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-amber-900 md:mt-3 md:text-3xl">
                      <CountUpSafe end={stats.pending_review} duration={1.1} separator="," />
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="hidden text-xs text-amber-700 md:block">Flagged backlog</p>
                      <Link to="/review" className="text-xs font-semibold text-amber-900 hover:underline">
                        Open queue
                      </Link>
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants} className="col-span-2 rounded-2xl border border-(--line) bg-white p-3.5 shadow-sm md:col-span-1 md:p-4">
                    <div className="flex items-center justify-between text-(--muted)">
                      <span className="text-[10px] font-semibold uppercase tracking-wide md:text-xs">Total Value</span>
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-xl font-extrabold text-(--ink) md:mt-3 md:text-2xl">
                      {formatCurrency(stats.total_value_processed, 'INR')}
                    </p>
                    <p className="mt-1 hidden text-xs text-(--muted) md:block">Cumulative processed amount</p>
                  </motion.div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <motion.div variants={itemVariants} className="rounded-2xl border border-(--line) bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-(--ink)">Quality Snapshot</h3>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <dl className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <dt className="text-(--muted)">Clean</dt>
                        <dd className="font-semibold text-(--ink)">{stats.total_clean}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-(--muted)">Flagged</dt>
                        <dd className="font-semibold text-(--ink)">{stats.total_flagged}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-(--muted)">Reviewed</dt>
                        <dd className="font-semibold text-(--ink)">{stats.total_reviewed}</dd>
                      </div>
                    </dl>
                  </motion.div>

                  <motion.div variants={itemVariants} className="rounded-2xl border border-(--line) bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-(--ink)">Average Processing Time</h3>
                      <Clock3 className="h-4 w-4 text-sky-600" />
                    </div>
                    <p className="text-3xl font-extrabold text-(--ink)">
                      <CountUpSafe end={stats.average_processing_time_seconds} duration={1.2} decimals={1} />s
                    </p>
                    <p className="mt-1 text-xs text-(--muted)">Per invoice pipeline completion</p>
                  </motion.div>

                  <motion.div variants={itemVariants} className="rounded-2xl border border-(--line) bg-white p-4 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold text-(--ink)">Quick Actions</h3>
                    <div className="grid gap-2 text-sm">
                      <motion.div whileHover={{ y: -1.5, scale: 1.01 }} whileTap={{ scale: 0.985 }} transition={quickActionTransition}>
                        <Link to="/upload" className="block rounded-xl border border-(--line) px-3 py-2 font-medium text-(--ink) transition hover:bg-slate-50">
                          <span className="inline-flex items-center gap-2"><UploadCloud className="h-4 w-4" /> Upload Invoice</span>
                        </Link>
                      </motion.div>
                      <motion.div whileHover={{ y: -1.5, scale: 1.01 }} whileTap={{ scale: 0.985 }} transition={quickActionTransition}>
                        <Link to="/invoices" className="block rounded-xl border border-(--line) px-3 py-2 font-medium text-(--ink) transition hover:bg-slate-50">
                        <span className="inline-flex items-center gap-2"><Search className="h-4 w-4" /> Explore Invoices</span>
                        </Link>
                      </motion.div>
                      <motion.div whileHover={{ y: -1.5, scale: 1.01 }} whileTap={{ scale: 0.985 }} transition={quickActionTransition}>
                        <Link to="/review" className="block rounded-xl border border-(--line) px-3 py-2 font-medium text-(--ink) transition hover:bg-slate-50">
                          <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Review Queue</span>
                        </Link>
                      </motion.div>
                    </div>
                  </motion.div>
                </div>
              </div>
            )}
          </PageShell>
        </motion.div>

        {!isLoading && !isError && stats && (
          <motion.section
            variants={itemVariants}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border border-(--line) bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-(--ink)">Recent Invoices</h2>
              <Link to="/invoices" className="text-sm font-semibold text-(--brand-ink)">
                View all
              </Link>
            </div>

            {recentInvoices.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-(--muted)">
                No recent invoices found.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-(--line)">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-(--muted)">
                    <tr>
                      <th className="px-4 py-3">Invoice #</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Processed</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((invoice) => {
                      const normalizedStatus = toStatusLabel(invoice.status)
                      return (
                        <motion.tr
                          key={invoice.invoice_number}
                          className="border-t border-(--line)"
                          whileHover={{ backgroundColor: 'var(--surface-soft)' }}
                          whileTap={{ backgroundColor: 'var(--surface)' }}
                          transition={{ duration: 0.16 }}
                        >
                          <td className="px-4 py-3 font-semibold text-(--ink)">
                            <motion.div whileHover={{ x: 2 }} transition={{ type: 'spring', stiffness: 340, damping: 26 }}>
                              <Link to={`/invoices/${invoice.invoice_number}`} className="hover:underline">
                              {invoice.invoice_number}
                              </Link>
                            </motion.div>
                          </td>
                          <td className="px-4 py-3 text-(--ink)">{invoice.vendor_name}</td>
                          <td className="px-4 py-3 text-(--ink)">{formatCurrency(invoice.grand_total, 'INR')}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(normalizedStatus)}`}>
                              {normalizedStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-(--muted)">{formatDate(invoice.processed_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-3">
                              <Link
                                to={`/invoices/${invoice.invoice_number}`}
                                className="text-xs font-semibold text-(--brand-ink) hover:underline"
                              >
                                Open details
                              </Link>
                              {normalizedStatus === 'flagged' && (
                                <Link to="/review" className="text-xs font-semibold text-amber-800 hover:underline">
                                  Review now
                                </Link>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.section>
        )}
      </motion.div>
    </div>
  )
}
