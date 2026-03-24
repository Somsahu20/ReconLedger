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
  { label: 'All', value: 'all' },
  { label: 'Matched', value: 'matched' },
  { label: 'Missing', value: 'missing' },
  { label: 'Amount Mismatch', value: 'amount_mismatch' },
  { label: 'Vendor Mismatch', value: 'vendor_mismatch' },
  { label: 'Date Mismatch', value: 'date_mismatch' },
  { label: 'Tax Mismatch', value: 'tax_mismatch' },
  { label: 'Multiple Mismatch', value: 'multiple_mismatch' },
  { label: 'AI Match', value: 'ai_match' },
  { label: 'AI + Discrepancies', value: 'ai_matched_with_discrepancies' },
]

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

const pageTransition = { duration: 0.3 }

function normalizeStatus(status: string) {
  return status.toLowerCase()
}

function statusClasses(status: string) {
  const normalized = normalizeStatus(status)
  if (normalized === 'matched' || normalized === 'ai_match') {
    return 'bg-green-100 text-green-800'
  }
  if (normalized === 'missing') {
    return 'bg-amber-100 text-amber-800'
  }
  if (normalized === 'pending') {
    return 'bg-slate-100 text-slate-700'
  }
  if (normalized === 'complete') {
    return 'bg-blue-100 text-blue-800'
  }
  if (normalized === 'failed') {
    return 'bg-red-100 text-red-800'
  }
  return 'bg-red-100 text-red-800'
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

      toast.success(`Reconciliation complete: ${response.summary.match_rate}% match rate`)
      setSelectedFile(null)
      setListingName('')
      navigate(`/reconciliation/${response.session_id}`)
    },
    onError: () => {
      toast.error('Could not process listing. Verify file format and retry.')
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
      toast.error('Please choose a CSV or Excel listing file.')
      return
    }

    if (!listingName.trim()) {
      toast.error('Please enter a session name.')
      return
    }

    uploadMutation.mutate({
      name: listingName.trim(),
      file: selectedFile,
      useAi,
    })
  }

  const drilldownItems = filteredItems?.items ?? report?.items ?? []

  return (
    <div className="relative">
      <ReconciliationScene />
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="space-y-6"
      >
        <PageShell
          title="Reconciliation"
          description="Upload auditor listings, run cross-check sessions, and drill into discrepancy views by mismatch type."
        >
          <div className="space-y-6">
            <form onSubmit={submitUpload} className="grid gap-3 rounded-2xl border border-(--line) bg-white p-4 lg:grid-cols-[1fr_1fr_auto]">
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-(--muted)">
                  Session Name
                </span>
                <input
                  value={listingName}
                  onChange={(event) => setListingName(event.target.value)}
                  placeholder="e.g. Q1 2026 Vendor Audit"
                  className="w-full rounded-xl border border-(--line) px-3 py-2 text-sm text-(--ink) outline-none ring-(--brand)/25 transition focus:ring"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-(--muted)">
                  Listing File (.csv, .xlsx, .xls)
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full rounded-xl border border-(--line) bg-white px-3 py-2 text-sm text-(--ink)"
                />
                {selectedFile && (
                  <p className="mt-1 text-xs text-(--muted)">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </label>

              <div className="flex flex-col justify-end gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-(--muted)">
                  <input
                    type="checkbox"
                    checked={useAi}
                    onChange={(event) => setUseAi(event.target.checked)}
                    className="h-4 w-4 rounded border-(--line)"
                  />
                  Use AI matching & summary
                </label>

                <motion.button
                  type="submit"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  disabled={uploadMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4" />
                      Upload & Reconcile
                    </>
                  )}
                </motion.button>
              </div>
            </form>

            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <section className="rounded-2xl border border-(--line) bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-(--ink)">Reconciliation Sessions</h2>
                  <button
                    type="button"
                    onClick={() => {
                      void refetchSessions()
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-(--line) px-2 py-1 text-xs text-(--muted) hover:bg-slate-50"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" /> Refresh
                  </button>
                </div>

                {isSessionsLoading && (
                  <div className="space-y-2">
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="h-18 animate-pulse rounded-xl border border-(--line) bg-slate-50" />
                    ))}
                  </div>
                )}

                {isSessionsError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    Could not load sessions.
                  </div>
                )}

                {!isSessionsLoading && !isSessionsError && (sessions?.length ?? 0) === 0 && (
                  <div className="rounded-xl border border-(--line) bg-slate-50 p-3 text-xs text-(--muted)">
                    No sessions yet. Upload your first listing to begin reconciliation.
                  </div>
                )}

                <div className="space-y-2">
                  {sessions?.map((session) => {
                    const isActive = session.id === sessionId
                    return (
                      <motion.button
                        key={session.id}
                        type="button"
                        whileHover={{ y: -1.5 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => selectSession(session)}
                        className={`w-full rounded-xl border p-3 text-left ${
                          isActive
                            ? 'border-indigo-200 bg-indigo-50'
                            : 'border-(--line) bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-(--ink)">{session.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClasses(session.status)}`}>
                            {normalizeStatus(session.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-(--muted)">{formatDate(session.created_at)}</p>
                      </motion.button>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-(--line) bg-white p-4">
                {!sessionId && (
                  <div className="rounded-xl border border-(--line) bg-slate-50 p-6 text-center">
                    <SearchCheck className="mx-auto h-8 w-8 text-(--brand-ink)" />
                    <p className="mt-2 text-lg font-semibold text-(--ink)">Select a Session</p>
                    <p className="mt-1 text-sm text-(--muted)">
                      Choose a session from the left panel to view report and discrepancy drill-down.
                    </p>
                  </div>
                )}

                {sessionId && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-semibold text-(--ink)">{selectedSession?.name ?? 'Session Report'}</h2>
                        <p className="text-xs text-(--muted)">Session ID: {sessionId}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void refetchReport()
                            void refetchItems()
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-(--line) px-2.5 py-1 text-xs font-semibold text-(--ink) hover:bg-slate-50"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" /> Refresh Report
                        </button>
                      </div>
                    </div>

                    {isReportLoading && (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((index) => (
                          <div key={index} className="h-24 animate-pulse rounded-xl border border-(--line) bg-slate-50" />
                        ))}
                      </div>
                    )}

                    {isReportError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        Could not load report for this session.
                      </div>
                    )}

                    {report && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-xl border border-(--line) bg-slate-50 p-3">
                            <p className="text-xs text-(--muted)">Total Records</p>
                            <p className="mt-1 text-xl font-bold text-(--ink)">{report.summary.total}</p>
                          </div>
                          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                            <p className="text-xs text-green-700">Matched</p>
                            <p className="mt-1 text-xl font-bold text-green-900">{report.summary.matched}</p>
                          </div>
                          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                            <p className="text-xs text-red-700">Mismatched</p>
                            <p className="mt-1 text-xl font-bold text-red-900">{report.summary.mismatched}</p>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs text-amber-700">Missing</p>
                            <p className="mt-1 text-xl font-bold text-amber-900">{report.summary.missing}</p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-(--line) bg-slate-50 px-3 py-2 text-sm">
                          <p className="font-semibold text-(--ink)">Match Rate: {report.summary.match_rate}%</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {FILTERS.map((filter) => (
                            <motion.button
                              key={filter.value}
                              type="button"
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setActiveFilter(filter.value)}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                activeFilter === filter.value
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                  : 'border-(--line) bg-white text-(--muted) hover:bg-slate-50'
                              }`}
                            >
                              {filter.label}
                            </motion.button>
                          ))}
                        </div>

                        {(isItemsLoading || isReportLoading) && (
                          <div className="rounded-xl border border-(--line) bg-white p-4 text-sm text-(--muted)">
                            Loading discrepancy items...
                          </div>
                        )}

                        {isItemsError && (
                          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            Could not load filtered items.
                          </div>
                        )}

                        {!isItemsLoading && !isItemsError && drilldownItems.length === 0 && (
                          <div className="rounded-xl border border-(--line) bg-slate-50 p-4 text-sm text-(--muted)">
                            No records found for the selected filter.
                          </div>
                        )}

                        {!isItemsLoading && !isItemsError && drilldownItems.length > 0 && (
                          <div className="overflow-hidden rounded-xl border border-(--line)">
                            <table className="min-w-full text-left text-sm">
                              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-(--muted)">
                                <tr>
                                  <th className="px-4 py-3">Invoice #</th>
                                  <th className="px-4 py-3">Vendor</th>
                                  <th className="px-4 py-3">Amount</th>
                                  <th className="px-4 py-3">Status</th>
                                  <th className="px-4 py-3">Discrepancies</th>
                                </tr>
                              </thead>
                              <tbody>
                                {drilldownItems.map((item) => (
                                  <motion.tr
                                    key={`${item.invoice_number}-${item.vendor}-${item.status}`}
                                    whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.95)' }}
                                    className="border-t border-(--line)"
                                  >
                                    <td className="px-4 py-3 font-semibold text-(--ink)">
                                      <Link to={`/invoices/${item.invoice_number}`} className="hover:underline">
                                        {item.invoice_number}
                                      </Link>
                                    </td>
                                    <td className="px-4 py-3 text-(--ink)">{item.vendor}</td>
                                    <td className="px-4 py-3 text-(--ink)">{formatCurrency(item.listing_amount, item.currency ?? 'INR')}</td>
                                    <td className="px-4 py-3">
                                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${statusClasses(item.status)}`}>
                                        {normalizeStatus(item.status)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-(--muted)">
                                      {item.discrepancies.length > 0 ? (
                                        <ul className="space-y-1">
                                          {item.discrepancies.slice(0, 2).map((discrepancy, index) => (
                                            <li key={index} className="line-clamp-2 inline-flex items-start gap-1.5">
                                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
                                              <span>{discrepancy}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 text-green-700">
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          No discrepancies
                                        </span>
                                      )}
                                    </td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
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
