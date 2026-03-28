import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Activity, AlertTriangle, CheckCircle2, Clock3, FileText, Search, UploadCloud, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getDashboardStats } from '../api/dashboard'
import { formatCurrency, formatDate, toStatusLabel } from '../lib/formatters'
import { PageShell } from './PageShell'

const itemVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
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
  
  // Track the previously animated value so we don't need value in dependency array
  const startValueRef = useRef(0)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion || duration <= 0) {
      const frameStartId = window.requestAnimationFrame(() => {
        setValue(targetValue)
        startValueRef.current = targetValue
      })
      return () => window.cancelAnimationFrame(frameStartId)
    }

    let frameId = 0
    const start = performance.now()
    const startValue = startValueRef.current
    const delta = targetValue - startValue
    const totalDurationMs = duration * 1000

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / totalDurationMs, 1)
      const eased = 1 - (1 - progress) * (1 - progress)
      
      const nextValue = startValue + delta * eased
      setValue(nextValue)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
      } else {
        startValueRef.current = targetValue
      }
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
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
  if (normalized === 'clean') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
  if (normalized === 'reviewed') return 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
  return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
}

function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
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
    <div className="relative min-h-[calc(100vh-theme(spacing.16))] pb-16">
      {/* Decorative background gradients (Obsidian Recon) */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#070d1f] to-[#070d1f]" />
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-900/20 blur-[100px]" />
      
      <motion.div
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.1 } } }}
        className="space-y-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8"
      >
        <motion.div variants={itemVariants} transition={{ duration: 0.4 }}>
          <PageShell
            title="Overview"
            description="Operational cockpit for extraction, reconciliation, and review."
          >
            {isFetching && !isLoading && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-(--muted) ring-1 ring-white/10">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                Refreshing data...
              </div>
            )}

            {isLoading && <DashboardLoading />}

            {isError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
                <p className="font-semibold">Could not load dashboard stats.</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition px-4 py-2 text-xs font-semibold text-white"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {hasDataIssue && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-200">
                <p className="font-semibold">Dashboard data format looks incomplete.</p>
                <p className="mt-1 opacity-80">Try refreshing. If this continues, verify backend dashboard response fields.</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition px-4 py-2 text-xs font-semibold text-white"
                >
                  Refresh Data
                </button>
              </div>
            )}

            {isEmpty && (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-10 text-center shadow-inner">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5 mb-4">
                  <FileText className="h-8 w-8 text-(--muted)" />
                </div>
                <p className="text-xl font-medium text-white">No invoices yet</p>
                <p className="mt-2 text-sm text-(--muted) max-w-sm mx-auto">
                  Upload your first invoice to start generating KPIs and audit insights for your ledger.
                </p>
                <Link
                  to="/upload"
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-(--brand) to-(--brand-ink) px-6 py-3 text-[14px] font-medium text-[#001c39] shadow-[0_0_15px_rgba(164,201,255,0.2)] hover:brightness-110 transition-all"
                >
                  <UploadCloud className="h-4 w-4" />
                  Upload First Invoice
                </Link>
              </div>
            )}

            {!isLoading && !isError && !isEmpty && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Total Invoices */}
                  <motion.div variants={itemVariants} className="group relative overflow-hidden rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 transition-colors hover:bg-white/[0.05]">
                    <div className="flex items-center justify-between text-(--muted)">
                      <span className="text-[11px] font-bold uppercase tracking-widest">Total Invoices</span>
                      <div className="p-2 bg-white/5 rounded-lg text-(--brand)">
                        <FileText className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-4 text-3xl font-light tracking-tight text-white md:text-4xl">
                      <CountUpSafe end={stats.total_invoices} duration={1.1} separator="," />
                    </p>
                  </motion.div>

                  {/* Processed Today */}
                  <motion.div variants={itemVariants} className="group relative overflow-hidden rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 transition-colors hover:bg-white/[0.05]">
                    <div className="flex items-center justify-between text-(--muted)">
                      <span className="text-[11px] font-bold uppercase tracking-widest">Processed Today</span>
                      <div className="p-2 bg-white/5 rounded-lg text-emerald-400">
                        <Activity className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-4 text-3xl font-light tracking-tight text-white md:text-4xl">
                      <CountUpSafe end={stats.invoices_today} duration={1.1} separator="," />
                    </p>
                  </motion.div>

                  {/* Needs Review - Accentuated */}
                  <motion.div variants={itemVariants} className="group relative overflow-hidden rounded-2xl bg-amber-500/10 p-5 ring-1 ring-amber-500/20 transition-colors hover:bg-amber-500/15">
                    <div className="flex items-center justify-between text-amber-300">
                      <span className="text-[11px] font-bold uppercase tracking-widest">Needs Review</span>
                      <div className="p-2 bg-amber-500/20 rounded-lg text-amber-300">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-4 text-3xl font-semibold tracking-tight text-amber-400 md:text-4xl drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                      <CountUpSafe end={stats.pending_review} duration={1.1} separator="," />
                    </p>
                    <Link to="/review" className="absolute bottom-5 right-5 opacity-0 transition-opacity group-hover:opacity-100">
                      <ChevronRight className="h-5 w-5 text-amber-300" />
                    </Link>
                  </motion.div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {/* Quality Snapshot */}
                  <motion.div variants={itemVariants} className="rounded-2xl bg-white/[0.02] p-5 ring-1 ring-white/5 shadow-inner backdrop-blur-sm">
                    <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
                      <h3 className="text-sm font-medium text-white">Quality Snapshot</h3>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <dl className="space-y-3.5 text-sm">
                      <div className="flex items-center justify-between group">
                        <dt className="text-(--muted) transition-colors group-hover:text-white">Clean</dt>
                        <dd className="font-semibold text-emerald-400">{stats.total_clean}</dd>
                      </div>
                      <div className="flex items-center justify-between group">
                        <dt className="text-(--muted) transition-colors group-hover:text-white">Flagged</dt>
                        <dd className="font-semibold text-amber-400">{stats.total_flagged}</dd>
                      </div>
                      <div className="flex items-center justify-between group">
                        <dt className="text-(--muted) transition-colors group-hover:text-white">Reviewed</dt>
                        <dd className="font-semibold text-sky-400">{stats.total_reviewed}</dd>
                      </div>
                    </dl>
                  </motion.div>

                  {/* Processing Time */}
                  <motion.div variants={itemVariants} className="rounded-2xl bg-white/[0.02] p-5 ring-1 ring-white/5 shadow-inner backdrop-blur-sm flex flex-col justify-between">
                    <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                      <h3 className="text-sm font-medium text-white">Avg. Processing Time</h3>
                      <Clock3 className="h-4 w-4 text-sky-400" />
                    </div>
                    <div>
                      <p className="text-5xl font-light tracking-tight text-white">
                        <CountUpSafe end={stats.average_processing_time_seconds} duration={1.2} decimals={1} /><span className="text-2xl text-(--muted) ml-1">s</span>
                      </p>
                      <p className="mt-2 text-xs text-(--muted) uppercase tracking-wide">Per invoice pipeline</p>
                    </div>
                  </motion.div>

                  {/* Quick Actions */}
                  <motion.div variants={itemVariants} className="rounded-2xl bg-white/[0.02] p-5 ring-1 ring-white/5 shadow-inner backdrop-blur-sm">
                    <h3 className="mb-4 text-sm font-medium text-white border-b border-white/10 pb-3">Quick Actions</h3>
                    <div className="grid gap-3 text-[13px]">
                      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={quickActionTransition}>
                        <Link to="/upload" className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 font-medium text-white transition-colors hover:bg-white/10 border border-white/5">
                          <span className="flex items-center gap-3"><UploadCloud className="h-4 w-4 text-(--brand)" /> Upload Invoice</span>
                          <ChevronRight className="h-4 w-4 text-(--muted)" />
                        </Link>
                      </motion.div>
                      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={quickActionTransition}>
                        <Link to="/invoices" className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 font-medium text-white transition-colors hover:bg-white/10 border border-white/5">
                          <span className="flex items-center gap-3"><Search className="h-4 w-4 text-indigo-400" /> Explore Ledger</span>
                          <ChevronRight className="h-4 w-4 text-(--muted)" />
                        </Link>
                      </motion.div>
                      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={quickActionTransition}>
                        <Link to="/review" className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 font-medium text-white transition-colors hover:bg-white/10 border border-white/5">
                          <span className="flex items-center gap-3"><AlertTriangle className="h-4 w-4 text-amber-400" /> Review Queue</span>
                          <ChevronRight className="h-4 w-4 text-(--muted)" />
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
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-[2rem] bg-white/[0.02] p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:p-10 ring-1 ring-white/5 relative overflow-hidden"
          >
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/[0.02] to-transparent" />
            
            <div className="relative z-10 mb-6 flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-xl font-light tracking-tight text-white">Recent Activity</h2>
              <Link to="/invoices" className="text-sm font-medium text-(--brand) hover:text-(--brand)/80 flex items-center gap-1 transition-colors">
                View all ledger entries <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {recentInvoices.length === 0 ? (
              <p className="rounded-xl bg-white/5 px-5 py-6 text-center text-sm text-(--muted) border border-white/5">
                No recent activity found in the ledger.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-[11px] font-bold uppercase tracking-[0.1em] text-(--muted) border-b border-white/10">
                    <tr>
                      <th className="px-4 py-4">Invoice #</th>
                      <th className="px-4 py-4">Vendor</th>
                      <th className="px-4 py-4">Amount</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Processed</th>
                      <th className="px-4 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {recentInvoices.map((invoice) => {
                      const normalizedStatus = toStatusLabel(invoice.status)
                      return (
                        <motion.tr
                          key={invoice.invoice_number}
                          whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
                          className="transition-colors group"
                        >
                          <td className="px-4 py-4 font-medium text-white">
                            <Link to={`/invoices/${invoice.invoice_number}`} className="hover:text-(--brand) transition-colors">
                              {invoice.invoice_number}
                            </Link>
                          </td>
                          <td className="px-4 py-4 text-(--muted) group-hover:text-white/90 transition-colors">{invoice.vendor_name}</td>
                          <td className="px-4 py-4 text-white font-mono text-[13px]">{formatCurrency(invoice.grand_total, 'INR')}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${statusClasses(normalizedStatus)}`}>
                              {normalizedStatus}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-(--muted) text-[13px]">{formatDate(invoice.processed_at)}</td>
                          <td className="px-4 py-4 text-right">
                            <div className="inline-flex items-center justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                              <Link
                                to={`/invoices/${invoice.invoice_number}`}
                                className="text-[13px] font-medium text-(--brand) hover:underline"
                              >
                                View
                              </Link>
                              {normalizedStatus === 'flagged' && (
                                <Link to="/review" className="text-[13px] font-medium text-amber-400 hover:text-amber-300">
                                  Review
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
