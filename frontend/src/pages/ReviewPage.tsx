import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  CircleCheckBig,
  FileClock,
  LoaderCircle,
  X,
  ShieldAlert,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import {
  getFlaggedInvoices,
  getReviewHistory,
  getReviewedInvoices,
  resolveFlaggedInvoice,
} from '../api/reviews'
import { formatCurrency, formatDate } from '../lib/formatters'
import type { InvoiceListItem } from '../types/invoice'
import type { FlaggedInvoiceItem, ReviewHistoryItem } from '../types/review'
import { PageShell } from './PageShell'

type ActiveTab = 'pending' | 'reviewed'

type ReviewedDetailModalData = {
  invoice_number: string
  vendor_name: string
  grand_total: number | string
  currency: string
  reviewed_at: string | null
  reviewed_by: string
  review_note: string | null
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
}

const pageTransition = { duration: 0.28 }

function reviewerName(review: ReviewHistoryItem) {
  return typeof review.reviewed_by === 'string' ? review.reviewed_by : review.reviewed_by.full_name
}

function getResolveErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const statusCode = error.response?.status
    const detail = error.response?.data?.detail
    if (statusCode === 400) {
      if (typeof detail === 'string') return detail
      return 'Invoice cannot be reviewed in its current state.'
    }
    if (statusCode === 404) return 'Invoice was not found. Refresh queue and try again.'
    if (typeof statusCode === 'number' && statusCode >= 500) return 'Server error while resolving invoice. Please retry.'
    if (typeof detail === 'string') return detail
  }
  return 'Could not update invoice status. Please try again.'
}

export function ReviewPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending')
  const [selectedInvoice, setSelectedInvoice] = useState<FlaggedInvoiceItem | null>(null)
  const [selectedReviewedDetail, setSelectedReviewedDetail] = useState<ReviewedDetailModalData | null>(null)
  const [reviewNote, setReviewNote] = useState('')

  const {
    data: flaggedInvoices,
    isLoading: isFlaggedLoading,
    isError: isFlaggedError,
    refetch: refetchFlagged,
  } = useQuery({
    queryKey: ['review', 'flagged-list'],
    queryFn: getFlaggedInvoices,
  })

  const {
    data: reviewedData,
    isLoading: isReviewedLoading,
    isError: isReviewedError,
    refetch: refetchReviewed,
  } = useQuery({
    queryKey: ['review', 'reviewed-list'],
    queryFn: () => getReviewedInvoices(1, 15),
  })

  const {
    data: reviewHistory,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['review', 'history'],
    queryFn: getReviewHistory,
  })

  const resolveMutation = useMutation({
    mutationFn: ({ invoiceId, note }: { invoiceId: string; note: string | null }) =>
      resolveFlaggedInvoice(invoiceId, { note }),
    onSuccess: async (result) => {
      setActiveTab('reviewed')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['review', 'flagged-list'] }),
        queryClient.invalidateQueries({ queryKey: ['review', 'reviewed-list'] }),
        queryClient.invalidateQueries({ queryKey: ['review', 'history'] }),
        queryClient.invalidateQueries({ queryKey: ['invoices', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
      ])
      toast.success(`Invoice ${result.invoice_number} moved to reviewed`)
      setSelectedInvoice(null)
      setReviewNote('')
    },
    onError: (error) => {
      toast.error(getResolveErrorMessage(error))
    },
  })

  const reviewNoteByInvoiceId = useMemo(() => {
    const map = new Map<string, ReviewHistoryItem>()
    for (const history of reviewHistory ?? []) {
      if (!map.has(history.invoice_id)) {
        map.set(history.invoice_id, history)
      }
    }
    return map
  }, [reviewHistory])

  const pendingCount = flaggedInvoices?.length ?? 0
  const reviewedCount = reviewedData?.invoices.length ?? 0

  function openResolveModal(invoice: FlaggedInvoiceItem) {
    setSelectedInvoice(invoice)
    setReviewNote('')
  }

  function closeResolveModal() {
    if (resolveMutation.isPending) return
    setSelectedInvoice(null)
    setReviewNote('')
  }

  function submitReview() {
    if (!selectedInvoice) return
    const normalizedNote = reviewNote.trim()
    resolveMutation.mutate({
      invoiceId: selectedInvoice.id,
      note: normalizedNote ? normalizedNote : null,
    })
  }

  function openReviewedDetailModal(invoice: InvoiceListItem, historyItem?: ReviewHistoryItem) {
    setSelectedReviewedDetail({
      invoice_number: invoice.invoice_number,
      vendor_name: invoice.vendor_name,
      grand_total: invoice.grand_total,
      currency: invoice.currency,
      reviewed_at: historyItem?.reviewed_at ?? invoice.processed_at,
      reviewed_by: historyItem ? reviewerName(historyItem) : 'System',
      review_note: historyItem?.review_note ?? null,
    })
  }

  function closeReviewedDetailModal() {
    setSelectedReviewedDetail(null)
  }

  return (
    <div className="relative min-h-[calc(100vh-(--spacing(16)))] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-900/10 via-[#070d1f] to-[#070d1f]" />

      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="space-y-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8"
      >
        <PageShell
          title="Review Queue"
          description="Resolve structural discrepancies with reviewer notes and track audited outcomes in the secure ledger."
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('pending')}
                className={`flex flex-col rounded-[2rem] p-6 text-left transition-all duration-300 backdrop-blur-xl ring-1 shadow-[0_8px_32px_rgba(0,0,0,0.15)] ${
                  activeTab === 'pending'
                    ? 'ring-amber-500/50 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.2)]'
                    : 'ring-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-xl flex items-center justify-center ${activeTab === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-(--muted)'}`}>
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Pending Triage</p>
                </div>
                <div className="flex items-baseline gap-3 mt-1">
                  <p className={`text-4xl font-light tracking-tight ${activeTab === 'pending' ? 'text-amber-400' : 'text-white'}`}>{pendingCount}</p>
                  <p className={`text-xs ${activeTab === 'pending' ? 'text-amber-200/60' : 'text-(--muted)'}`}>flagged items awaiting action</p>
                </div>
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab('reviewed')}
                className={`flex flex-col rounded-[2rem] p-6 text-left transition-all duration-300 backdrop-blur-xl ring-1 shadow-[0_8px_32px_rgba(0,0,0,0.15)] ${
                  activeTab === 'reviewed'
                    ? 'ring-emerald-500/50 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
                    : 'ring-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-xl flex items-center justify-center ${activeTab === 'reviewed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-(--muted)'}`}>
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Audited State</p>
                </div>
                <div className="flex items-baseline gap-3 mt-1">
                  <p className={`text-4xl font-light tracking-tight ${activeTab === 'reviewed' ? 'text-emerald-400' : 'text-white'}`}>{reviewedCount}</p>
                  <p className={`text-xs ${activeTab === 'reviewed' ? 'text-emerald-200/60' : 'text-(--muted)'}`}>invoices permanently resolved</p>
                </div>
              </motion.button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'pending' ? (
                <motion.section
                  key="pending-view"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-4"
                >
                  {isFlaggedLoading && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="h-40 animate-pulse rounded-[1.5rem] bg-white/5 ring-1 ring-white/10" />
                      ))}
                    </div>
                  )}

                  {isFlaggedError && (
                    <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200 backdrop-blur-md">
                      <p className="font-semibold text-red-300 text-base mb-3">Error fetching pending queue datastream.</p>
                      <button
                        type="button"
                        onClick={() => void refetchFlagged()}
                        className="rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors px-4 py-2.5 text-[13px] font-semibold text-white"
                      >
                        Re-initialize Connection
                      </button>
                    </div>
                  )}

                  {!isFlaggedLoading && !isFlaggedError && (flaggedInvoices?.length ?? 0) === 0 && (
                    <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-12 text-center shadow-inner backdrop-blur-xl">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 mb-5 ring-1 ring-emerald-500/20">
                        <CircleCheckBig className="h-8 w-8" />
                      </div>
                      <p className="text-xl font-light tracking-tight text-white">Queue Empty</p>
                      <p className="mt-2 text-sm text-(--muted) max-w-sm mx-auto">
                        All programmatic flags have been resolved. System intelligence active.
                      </p>
                    </div>
                  )}

                  {!isFlaggedLoading && !isFlaggedError && (flaggedInvoices?.length ?? 0) > 0 && (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {flaggedInvoices?.map((invoice) => (
                        <motion.article
                          key={invoice.id}
                          whileHover={{ y: -2 }}
                          className="flex flex-col rounded-[1.5rem] bg-white/[0.02] p-5 ring-1 ring-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl relative overflow-hidden group"
                        >
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          
                          <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
                            <div>
                              <p className="text-base font-semibold text-white tracking-wide">{invoice.invoice_number}</p>
                              <p className="mt-0.5 text-[13px] text-(--muted) truncate max-w-[160px]">{invoice.vendor_name}</p>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-amber-400 ring-1 ring-amber-500/20 uppercase shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                              FLAGGED
                            </span>
                          </div>

                          <div className="relative z-10 grid grid-cols-2 gap-3 text-[13px] mb-4">
                            <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted) mb-1">Exposure</p>
                              <p className="font-mono text-white/90">{formatCurrency(invoice.grand_total, invoice.currency)}</p>
                            </div>
                            <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted) mb-1">Detected</p>
                              <p className="font-medium text-white/90">{formatDate(invoice.processed_at)}</p>
                            </div>
                          </div>

                          {invoice.audit_report && (
                            <div className="relative z-10 mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90 flex-1">
                              <p className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-amber-400 mb-1.5">
                                <AlertTriangle className="h-3 w-3" />
                                Vector Analysis
                              </p>
                              <div className="max-h-24 overflow-hidden mask-[linear-gradient(to_bottom,black_75%,transparent)]">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
                                    strong: ({ children }) => <strong className="font-semibold text-amber-100">{children}</strong>,
                                    em: ({ children }) => <em className="text-amber-100/90">{children}</em>,
                                    ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-4 marker:text-amber-300">{children}</ul>,
                                    ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-4 marker:text-amber-300">{children}</ol>,
                                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                    h1: ({ children }) => <h1 className="mb-2 text-sm font-bold text-amber-100">{children}</h1>,
                                    h2: ({ children }) => <h2 className="mb-2 text-sm font-semibold text-amber-100">{children}</h2>,
                                    h3: ({ children }) => <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-200">{children}</h3>,
                                    hr: () => <hr className="my-2 border-amber-400/20" />,
                                  }}
                                >
                                  {invoice.audit_report}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}

                          <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => openResolveModal(invoice)}
                              className="flex-1 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-3 py-2.5 text-[13px] font-semibold text-white hover:brightness-110 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all"
                            >
                              Take Action
                            </motion.button>
                            <Link
                              to={`/invoices/${encodeURIComponent(invoice.invoice_number)}`}
                              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/10 transition-colors ring-1 ring-transparent hover:ring-white/5 text-center"
                            >
                              Inspect
                            </Link>
                          </div>
                        </motion.article>
                      ))}
                    </div>
                  )}
                </motion.section>
              ) : (
                <motion.section
                  key="reviewed-view"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-6"
                >
                  {(isReviewedLoading || isHistoryLoading) && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="h-28 animate-pulse rounded-[1.5rem] bg-white/5 ring-1 ring-white/10" />
                      ))}
                    </div>
                  )}

                  {(isReviewedError || isHistoryError) && (
                    <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200 backdrop-blur-md">
                      <p className="font-semibold text-red-300 text-base mb-3">Error fetching resolved matrix.</p>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => void refetchReviewed()} className="rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors px-4 py-2.5 text-[13px] font-semibold text-white">Retry Datastream</button>
                        <button type="button" onClick={() => void refetchHistory()} className="rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors px-4 py-2.5 text-[13px] font-semibold text-white">Retry Subsystem</button>
                      </div>
                    </div>
                  )}

                  {!isReviewedLoading && !isHistoryLoading && !isReviewedError && !isHistoryError && (
                    <div className="space-y-4">
                        {(reviewedData?.invoices.length ?? 0) === 0 ? (
                          <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-12 text-center shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-xl flex flex-col items-center justify-center h-full min-h-[300px]">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-(--muted) mb-5">
                              <FileClock className="h-8 w-8" />
                            </div>
                            <p className="text-xl font-light tracking-tight text-white">No historical data logs</p>
                            <p className="mt-2 text-sm text-(--muted) max-w-sm mx-auto">
                              Engage with the pending queue to populate audit trails and timeline events.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-[2rem] bg-white/[0.02] ring-1 ring-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-white/[0.02] text-[10px] font-bold uppercase tracking-widest text-(--muted) border-b border-white/10">
                                  <tr>
                                    <th className="px-6 py-4">Reference Target</th>
                                    <th className="px-6 py-4">Linked Entity</th>
                                    <th className="px-6 py-4">Value Recorded</th>
                                    <th className="px-6 py-4">Audited Event Data</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {reviewedData?.invoices.map((invoice) => {
                                    const historyItem = reviewNoteByInvoiceId.get(invoice.id)
                                    return (
                                      <motion.tr
                                        key={invoice.id}
                                        onClick={() => openReviewedDetailModal(invoice, historyItem)}
                                        whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                                        className="cursor-pointer transition-colors group"
                                      >
                                        <td className="px-6 py-4 font-semibold text-white">
                                          <span className="inline-flex items-center gap-2">
                                            <span className="hover:text-(--brand) transition-colors">{invoice.invoice_number}</span>
                                            <span className="text-[10px] uppercase tracking-wider text-emerald-300/70">view review</span>
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 text-white/80 group-hover:text-white transition-colors">
                                          {invoice.vendor_name}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-white/90">
                                          {formatCurrency(invoice.grand_total, invoice.currency)}
                                        </td>
                                        <td className="px-6 py-4 max-w-[280px]">
                                          <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2">
                                              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-400 ring-1 ring-emerald-500/20">
                                                CLEARED
                                              </span>
                                              <span className="text-[11px] text-(--muted)">
                                                {formatDate(historyItem?.reviewed_at ?? invoice.processed_at)}
                                              </span>
                                            </div>
                                            <p className="text-[13px] text-white/70 truncate">
                                              {historyItem?.review_note ? historyItem.review_note : 'Systematic resolution via console.'}
                                            </p>
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                openReviewedDetailModal(invoice, historyItem)
                                              }}
                                              className="w-fit rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/20"
                                            >
                                              Review Details
                                            </button>
                                          </div>
                                        </td>
                                      </motion.tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </PageShell>
      </motion.div>

      <AnimatePresence>
        {selectedReviewedDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#070d1f]/80 px-4 backdrop-blur-md"
            onClick={closeReviewedDetailModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#070d1f] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/5 bg-white/[0.02] px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Review Details</p>
                    <p className="mt-1 text-sm font-semibold text-white">{selectedReviewedDetail.invoice_number}</p>
                    <p className="text-xs text-(--muted)">{selectedReviewedDetail.vendor_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeReviewedDetailModal}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-(--muted) transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Close review detail modal"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4 px-5 py-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted)">Reviewed By</p>
                    <p className="mt-1 text-white/90">{selectedReviewedDetail.reviewed_by}</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted)">Reviewed At</p>
                    <p className="mt-1 text-white/90">{formatDate(selectedReviewedDetail.reviewed_at)}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted)">Resolved Value</p>
                  <p className="mt-1 font-mono text-white/90">
                    {formatCurrency(selectedReviewedDetail.grand_total, selectedReviewedDetail.currency)}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Reviewer Note</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-emerald-100/90">
                    {selectedReviewedDetail.review_note?.trim() || 'No reviewer note was provided for this resolution.'}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#070d1f]/80 px-4 backdrop-blur-md"
            onClick={closeResolveModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-[#070d1f] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-white/[0.02] px-6 py-5 border-b border-white/5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-light tracking-tight text-white flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-500" /> Executive Override
                  </h3>
                  <p className="mt-2 text-[13px] text-(--muted) flex items-center gap-2">
                    <span className="font-mono text-white/90 bg-white/5 px-1.5 py-0.5 rounded">{selectedInvoice.invoice_number}</span> 
                    • 
                    <span className="text-white/80">{selectedInvoice.vendor_name}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeResolveModal}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-(--muted) transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Close resolve modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <div className="mb-6 rounded-xl bg-amber-500/5 px-4 py-3 text-[13px] text-amber-200/90 ring-1 ring-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                  <p className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 translate-y-0.5" />
                    <span>This operation forcibly transitions the entity from <strong className="text-amber-400 font-semibold tracking-wide uppercase text-[11px]">Flagged</strong> to <strong className="text-emerald-400 font-semibold tracking-wide uppercase text-[11px]">Reviewed</strong> state within the central ledger.</span>
                  </p>
                </div>

                <label className="block space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-(--muted)">
                    Operational Notation (Optional)
                  </span>
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    rows={4}
                    placeholder="Provide justification vectors for the audit trail..."
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-transparent transition-all focus:bg-white/[0.08] focus:ring-(--brand)/50 custom-scrollbar resize-none"
                  />
                </label>
              </div>

              {/* Modal Footer */}
              <div className="bg-white/[0.01] px-6 py-5 border-t border-white/5 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={closeResolveModal}
                  disabled={resolveMutation.isPending}
                  className="rounded-xl bg-white/5 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white/10 ring-1 ring-white/10 disabled:opacity-50"
                >
                  Abort Action
                </button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={submitReview}
                  disabled={resolveMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-[13px] font-semibold text-white hover:brightness-110 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:shadow-none transition-all"
                >
                  {resolveMutation.isPending ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm Resolution
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
