import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCcw,
  SearchCheck,
  FolderOpen
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getReconciliationItems,
  getReconciliationReport,
  listReconciliationSessions,
  uploadReconciliationListing,
} from '../api/reconciliation'
import { ReconciliationScene } from '../components/three/ReconciliationScene'
import { formatCurrency, formatDate } from '../lib/formatters'
import type {
  ReconciliationFilterStatus,
  ReconciliationSessionListItem,
} from '../types/reconciliation'
import { PageShell } from './PageShell'

const FILTERS: Array<{ label: string; value: ReconciliationFilterStatus }> = [
  { label: 'All Operations', value: 'all' },
  { label: 'Clean Matched', value: 'matched' },
  { label: 'Missing Entities', value: 'missing' },
  { label: 'Value Deviation', value: 'amount_mismatch' },
  { label: 'Target Deviation', value: 'vendor_mismatch' },
  { label: 'Temporal Deviation', value: 'date_mismatch' },
  { label: 'Tax Deviation', value: 'tax_mismatch' },
  { label: 'Complex Deviation', value: 'multiple_mismatch' },
  { label: 'Neural Matched', value: 'ai_match' },
  { label: 'Neural + Deviation', value: 'ai_matched_with_discrepancies' },
]

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
}

const pageTransition = { duration: 0.28 }

function normalizeStatus(status: string) {
  return status.toLowerCase()
}

function statusClasses(status: string) {
  const normalized = normalizeStatus(status)
  if (normalized === 'matched' || normalized === 'ai_match') {
    return 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
  }
  if (normalized === 'missing') {
    return 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
  }
  if (normalized === 'pending') {
    return 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/30'
  }
  if (normalized === 'complete') {
    return 'bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20 shadow-[0_0_10px_rgba(14,165,233,0.1)]'
  }
  if (normalized === 'failed') {
    return 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
  }
  return 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
}

export function ReconciliationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { sessionId } = useParams<{ sessionId?: string }>()

  const [listingName, setListingName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [useAi, setUseAi] = useState(true)
  const [activeFilter, setActiveFilter] = useState<ReconciliationFilterStatus>('all')

  const {
    data: sessions,
    isLoading: isSessionsLoading,
    isError: isSessionsError,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['reconciliation', 'sessions'],
    queryFn: listReconciliationSessions,
  })

  const selectedSession = useMemo(() => {
    if (!sessionId) return null
    return (sessions ?? []).find((session) => session.id === sessionId) ?? null
  }, [sessionId, sessions])

  useEffect(() => {
    if (!sessionId || !sessions || sessions.length === 0) return
    const exists = sessions.some((session) => session.id === sessionId)
    if (!exists) {
      navigate('/reconciliation', { replace: true })
    }
  }, [navigate, sessionId, sessions])

  const {
    data: report,
    isLoading: isReportLoading,
    isError: isReportError,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ['reconciliation', 'report', sessionId],
    queryFn: () => getReconciliationReport(sessionId ?? ''),
    enabled: Boolean(sessionId),
  })

  const {
    data: filteredItems,
    isLoading: isItemsLoading,
    isError: isItemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['reconciliation', 'items', sessionId, activeFilter],
    queryFn: () => getReconciliationItems(sessionId ?? '', activeFilter),
    enabled: Boolean(sessionId),
  })

  const uploadMutation = useMutation({
    mutationFn: uploadReconciliationListing,
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reconciliation', 'sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
      ])
      toast.success(`Reconciliation complete: ${response.summary.match_rate}% match vector`)
      setSelectedFile(null)
      setListingName('')
      navigate(`/reconciliation/${response.session_id}`)
    },
    onError: () => {
      toast.error('Could not process ledger subset. Verify schema format and retry.')
    },
  })

  function selectSession(session: ReconciliationSessionListItem) {
    navigate(`/reconciliation/${session.id}`)
    setActiveFilter('all')
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedFile) {
      toast.error('Please inject a CSV or Excel artifact.')
      return
    }
    if (!listingName.trim()) {
      toast.error('Please assign a session identifier.')
      return
    }
    uploadMutation.mutate({
      name: listingName.trim(),
      file: selectedFile,
      useAi,
    })
  }

  const drilldownItems = filteredItems?.items ?? report?.items ?? []
  const inputClass = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-transparent transition-all focus:bg-white/10 focus:ring-(--brand)/50 backdrop-blur-md"

  return (
    <div className="relative min-h-[calc(100vh-(--spacing(16)))] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-900/10 via-[#070d1f] to-[#070d1f]" />
      <div className="pointer-events-none absolute top-40 -left-40 h-96 w-96 rounded-full bg-emerald-900/10 blur-[120px]" />
      <ReconciliationScene />

      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="space-y-6 mx-auto max-w-[1400px] px-4 sm:px-6 mt-8"
      >
        <PageShell
          title="Consensus Reconciliation"
          description="Cross-examine external auditor listings against the verified central ledger using neural pattern matching."
        >
          <div className="space-y-8">
            <form onSubmit={submitUpload} className="grid gap-4 rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl lg:grid-cols-[1.5fr_1.5fr_auto] items-end relative overflow-hidden">
              <div className="pointer-events-none absolute top-0 -left-20 w-40 h-full bg-gradient-to-r from-(--brand)/5 to-transparent blur-2xl transform -skew-x-12" />
              
              <label className="relative z-10 block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-(--muted)">
                  Operation Identifier
                </span>
                <input
                  value={listingName}
                  onChange={(event) => setListingName(event.target.value)}
                  placeholder="e.g. Q1 2026 Audit Subset"
                  className={inputClass}
                />
              </label>

              <label className="relative z-10 block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-(--muted)">
                  Listing Artifact (.csv, .xlsx)
                </span>
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className={`${inputClass} flex items-center justify-between pointer-events-none font-mono ${selectedFile ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5' : 'text-white/40 border-dashed border-white/20'}`}>
                    <span className="truncate pr-4">{selectedFile ? selectedFile.name : 'Select or drop target file...'}</span>
                    <FolderOpen className={`h-4 w-4 shrink-0 ${selectedFile ? 'text-emerald-400' : 'text-(--muted)'}`} />
                  </div>
                </div>
              </label>

              <div className="flex flex-col justify-end gap-3 relative z-10 min-w-[220px]">
                <label className="inline-flex items-center gap-2.5 text-[11px] font-semibold text-white/70 uppercase tracking-widest cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={useAi}
                      onChange={(event) => setUseAi(event.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-4 w-4 rounded bg-white/10 ring-1 ring-white/20 peer-checked:bg-(--brand) peer-checked:ring-transparent transition-all" />
                    {useAi && <CheckCircle2 className="h-3 w-3 absolute text-white pointer-events-none" />}
                  </div>
                  System Neural Matching
                </label>

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.985 }}
                  disabled={uploadMutation.isPending}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 text-sm font-semibold text-white disabled:opacity-50 disabled:grayscale transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:brightness-110"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Cross-Checking...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4" />
                      Initialize Consensus
                    </>
                  )}
                </motion.button>
              </div>
            </form>

            <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
              <section className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl h-fit max-h-[80vh] flex flex-col">
                <div className="mb-5 flex items-center justify-between gap-2 border-b border-white/5 pb-4">
                  <h2 className="text-[12px] font-bold uppercase tracking-widest text-white/80">Active Sessions</h2>
                  <button
                    type="button"
                    onClick={() => void refetchSessions()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-colors ring-1 ring-white/10"
                  >
                    <RefreshCcw className="h-3 w-3" /> Sync
                  </button>
                </div>

                <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
                  {isSessionsLoading && (
                    [0, 1, 2].map((index) => (
                      <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
                    ))
                  )}

                  {isSessionsError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300">
                      Datastream failure. Could not load session context.
                    </div>
                  )}

                  {!isSessionsLoading && !isSessionsError && (sessions?.length ?? 0) === 0 && (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-(--muted) italic py-8">
                      No consensus vectors exist. Initialize a new session.
                    </div>
                  )}

                  {sessions?.map((session) => {
                    const isActive = session.id === sessionId
                    return (
                      <motion.button
                        key={session.id}
                        type="button"
                        whileHover={{ y: -1, backgroundColor: isActive ? '' : 'rgba(255,255,255,0.04)' }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => selectSession(session)}
                        className={`w-full rounded-2xl p-4 text-left transition-all duration-300 ring-1 backdrop-blur-md ${
                          isActive
                            ? 'ring-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                            : 'ring-white/10 bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className={`text-[13px] font-semibold tracking-wide truncate ${isActive ? 'text-indigo-200' : 'text-white'}`}>{session.name}</p>
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest rounded flex-shrink-0 ${statusClasses(session.status)}`}>
                            {normalizeStatus(session.status)}
                          </span>
                        </div>
                        <p className="font-mono text-[10px] text-(--muted)">{formatDate(session.created_at)}</p>
                      </motion.button>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/5 bg-white/[0.01] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl flex flex-col">
                {!sessionId && (
                  <div className="rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-12 text-center shadow-inner h-full flex flex-col items-center justify-center min-h-[400px]">
                    <div className="flex bg-white/5 h-20 w-20 rounded-[2rem] items-center justify-center mb-6 ring-1 ring-white/10">
                      <SearchCheck className="mx-auto h-10 w-10 text-(--muted)" />
                    </div>
                    <p className="mt-2 text-xl font-light tracking-tight text-white mb-2">Await Target Lock</p>
                    <p className="mt-1 text-[13px] text-(--muted) max-w-sm">
                      Select a consensus session from the operational log to review structural discrepancies and compliance rates.
                    </p>
                  </div>
                )}

                {sessionId && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/5 pb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-white tracking-tight">{selectedSession?.name ?? 'Session Report'}</h2>
                        <p className="text-[11px] text-(--muted) font-mono mt-1 bg-white/5 px-2 py-0.5 rounded-sm inline-block">ID: {sessionId}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void refetchReport()
                          void refetchItems()
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-[11px] font-semibold tracking-widest uppercase text-white hover:bg-white/10 transition-colors ring-1 ring-white/10"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" /> Force Sync
                      </button>
                    </div>

                    {isReportLoading && (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((index) => (
                          <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                        ))}
                      </div>
                    )}

                    {isReportError && (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
                        Datastream error. Diagnostic summary unavailable.
                      </div>
                    )}

                    {report && (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 relative overflow-hidden backdrop-blur-md">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted) mb-2">Total Vectors</p>
                            <p className="text-3xl font-light text-white">{report.summary.total}</p>
                          </div>
                          <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/5 p-5 relative overflow-hidden backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">Clean Match</p>
                            <p className="text-3xl font-light text-emerald-400">{report.summary.matched}</p>
                          </div>
                          <div className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/5 p-5 relative overflow-hidden backdrop-blur-md shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2">Deviant Vectors</p>
                            <p className="text-3xl font-light text-amber-400">{report.summary.mismatched}</p>
                          </div>
                          <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/5 p-5 relative overflow-hidden backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.05)]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-2">Null Entities</p>
                            <p className="text-3xl font-light text-red-400">{report.summary.missing}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-5 py-4 flex items-center justify-between backdrop-blur-md shadow-inner">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-semibold text-indigo-100 uppercase tracking-widest">Consensus Rate</span>
                          </div>
                          <span className="text-2xl font-light tracking-tight text-indigo-400">{report.summary.match_rate}%</span>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                          {FILTERS.map((filter) => (
                            <motion.button
                              key={filter.value}
                              type="button"
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setActiveFilter(filter.value)}
                              className={`rounded-full border px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase transition-colors ${
                                activeFilter === filter.value
                                  ? 'border-white/30 bg-white/10 text-white shadow-sm'
                                  : 'border-white/5 bg-transparent text-(--muted) hover:bg-white/[0.02] hover:text-white/80'
                              }`}
                            >
                              {filter.label}
                            </motion.button>
                          ))}
                        </div>

                        {(isItemsLoading || isReportLoading) && (
                          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-[13px] text-(--muted)">
                            <LoaderCircle className="h-5 w-5 animate-spin mx-auto mb-3" />
                            Fetching structural schema view...
                          </div>
                        )}

                        {isItemsError && (
                          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
                            Failure isolating subset vectors.
                          </div>
                        )}

                        {!isItemsLoading && !isItemsError && drilldownItems.length === 0 && (
                          <div className="rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-12 text-center shadow-inner backdrop-blur-xl">
                            <p className="text-sm font-medium text-white/50">Anomaly matrix empty for current parameters.</p>
                          </div>
                        )}

                        {!isItemsLoading && !isItemsError && drilldownItems.length > 0 && (
                          <div className="overflow-hidden rounded-[1.5rem] border border-white/5 bg-white/[0.02] ring-1 ring-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-2xl">
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-white/[0.02] text-[10px] font-bold uppercase tracking-widest text-(--muted) border-b border-white/10">
                                  <tr>
                                    <th className="px-5 py-4">Structure ID</th>
                                    <th className="px-5 py-4">Source Origin</th>
                                    <th className="px-5 py-4">Asserted Value</th>
                                    <th className="px-5 py-4">Outcome</th>
                                    <th className="px-5 py-4 w-1/3">Diagnostic Notes</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {drilldownItems.map((item) => (
                                    <motion.tr
                                      key={`${item.invoice_number}-${item.vendor}-${item.status}`}
                                      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                                      className="transition-colors group"
                                    >
                                      <td className="px-5 py-4 font-semibold text-white">
                                        <Link to={`/invoices/${item.invoice_number}`} className="hover:text-(--brand) transition-colors">
                                          {item.invoice_number}
                                        </Link>
                                      </td>
                                      <td className="px-5 py-4 text-white/80 group-hover:text-white transition-colors">
                                        {item.vendor}
                                      </td>
                                      <td className="px-5 py-4 text-white/90 font-mono text-[13px]">
                                        {formatCurrency(item.listing_amount, item.currency ?? 'INR')}
                                      </td>
                                      <td className="px-5 py-4">
                                        <span className={`inline-flex rounded-sm px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${statusClasses(item.status)}`}>
                                          {normalizeStatus(item.status)}
                                        </span>
                                      </td>
                                      <td className="px-5 py-4 text-xs">
                                        {item.discrepancies.length > 0 ? (
                                          <div className="space-y-1.5 max-w-[300px]">
                                            {item.discrepancies.slice(0, 2).map((discrepancy, index) => (
                                              <div key={index} className="flex items-start gap-2 bg-amber-500/5 ring-1 ring-amber-500/20 p-2 rounded-lg backdrop-blur-sm">
                                                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 translate-y-0.5" />
                                                <span className="text-[11px] text-amber-200/90 whitespace-normal leading-relaxed">{discrepancy}</span>
                                              </div>
                                            ))}
                                            {item.discrepancies.length > 2 && (
                                              <p className="text-[10px] text-(--muted) font-semibold ml-2">+ {item.discrepancies.length - 2} more flags</p>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-lg ring-1 ring-emerald-500/20 text-[11px] uppercase tracking-wide">
                                            <CheckCircle2 className="h-3 w-3" /> System Verified
                                          </span>
                                        )}
                                      </td>
                                    </motion.tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </PageShell>
      </motion.div>
    </div>
  )
}
