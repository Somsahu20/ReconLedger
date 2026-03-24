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
  MessageSquareText,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getFlaggedInvoices,
  getReviewHistory,
  getReviewedInvoices,
  resolveFlaggedInvoice,
} from '../api/reviews'
import { ReviewScene } from '../components/three/ReviewScene'
import { formatCurrency, formatDate } from '../lib/formatters'
import type { FlaggedInvoiceItem, ReviewHistoryItem } from '../types/review'
import { PageShell } from './PageShell'

type ActiveTab = 'pending' | 'reviewed'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

const pageTransition = { duration: 0.3 }

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

  return (
    <div className="relative">
      <ReviewScene />
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="space-y-6"
      >
        <PageShell
          title="Review Queue"
          description="Resolve flagged invoices with reviewer notes and track reviewed outcomes in one workspace."
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <motion.button
                type="button"
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setActiveTab('pending')}
                className={`rounded-2xl border p-4 text-left transition ${
                  activeTab === 'pending'
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-(--line) bg-white hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-(--muted)">Pending Review</p>
                <p className="mt-2 text-2xl font-extrabold text-(--ink)">{pendingCount}</p>
                <p className="mt-1 text-xs text-(--muted)">Flagged invoices waiting for auditor action</p>
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setActiveTab('reviewed')}
                className={`rounded-2xl border p-4 text-left transition ${
                  activeTab === 'reviewed'
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-(--line) bg-white hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-(--muted)">Reviewed</p>
                <p className="mt-2 text-2xl font-extrabold text-(--ink)">{reviewedCount}</p>
                <p className="mt-1 text-xs text-(--muted)">Invoices moved from flagged to reviewed</p>
              </motion.button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'pending' ? (
                <motion.section
                  key="pending-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {isFlaggedLoading && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="h-26 animate-pulse rounded-2xl border border-(--line) bg-white/80" />
                      ))}
                    </div>
                  )}

                  {isFlaggedError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <p className="font-semibold">Could not load pending queue.</p>
                      <button
                        type="button"
                        onClick={() => {
                          void refetchFlagged()
                        }}
                        className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!isFlaggedLoading && !isFlaggedError && (flaggedInvoices?.length ?? 0) === 0 && (
                    <div className="rounded-2xl border border-(--line) bg-white p-6 text-center">
                      <CircleCheckBig className="mx-auto h-8 w-8 text-emerald-600" />
                      <p className="mt-2 text-lg font-semibold text-(--ink)">No pending reviews</p>
                      <p className="mt-1 text-sm text-(--muted)">
                        All flagged invoices are resolved. New flags will appear here automatically.
                      </p>
                    </div>
                  )}

                  {!isFlaggedLoading && !isFlaggedError && (flaggedInvoices?.length ?? 0) > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {flaggedInvoices?.map((invoice) => (
                        <motion.article
                          key={invoice.id}
                          whileHover={{ y: -1.5 }}
                          whileTap={{ scale: 0.995 }}
                          className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-(--ink)">{invoice.invoice_number}</p>
                              <p className="mt-1 text-xs text-(--muted)">{invoice.vendor_name}</p>
                            </div>
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                              <motion.span
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 500 }}
                                className="inline-block"
                              >
                                FLAGGED
                              </motion.span>
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                              <p className="text-(--muted)">Amount</p>
                              <p className="font-semibold text-(--ink)">{formatCurrency(invoice.grand_total, invoice.currency)}</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                              <p className="text-(--muted)">Processed</p>
                              <p className="font-semibold text-(--ink)">{formatDate(invoice.processed_at)}</p>
                            </div>
                          </div>

                          {invoice.audit_report && (
                            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                              <p className="inline-flex items-center gap-1.5 font-semibold">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Audit Summary
                              </p>
                              <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{invoice.audit_report}</p>
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <motion.button
                              type="button"
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.985 }}
                              onClick={() => openResolveModal(invoice)}
                              className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                            >
                              Resolve
                            </motion.button>
                            <Link
                              to={`/invoices/${encodeURIComponent(invoice.invoice_number)}`}
                              className="rounded-xl border border-(--line) px-3 py-1.5 text-xs font-semibold text-(--ink) hover:bg-slate-50"
                            >
                              Open Detail
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {(isReviewedLoading || isHistoryLoading) && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="h-24 animate-pulse rounded-2xl border border-(--line) bg-white/80" />
                      ))}
                    </div>
                  )}

                  {(isReviewedError || isHistoryError) && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <p className="font-semibold">Could not load reviewed records.</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void refetchReviewed()
                          }}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Retry Reviewed
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void refetchHistory()
                          }}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Retry History
                        </button>
                      </div>
                    </div>
                  )}

                  {!isReviewedLoading && !isHistoryLoading && !isReviewedError && !isHistoryError && (
                    <>
                      {(reviewedData?.invoices.length ?? 0) === 0 ? (
                        <div className="rounded-2xl border border-(--line) bg-white p-6 text-center">
                          <FileClock className="mx-auto h-8 w-8 text-(--muted)" />
                          <p className="mt-2 text-lg font-semibold text-(--ink)">No reviewed invoices yet</p>
                          <p className="mt-1 text-sm text-(--muted)">
                            Resolve pending invoices to build the reviewed timeline.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-2xl border border-(--line) bg-white">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-(--muted)">
                              <tr>
                                <th className="px-4 py-3">Invoice #</th>
                                <th className="px-4 py-3">Vendor</th>
                                <th className="px-4 py-3">Amount</th>
                                <th className="px-4 py-3">Review Note</th>
                                <th className="px-4 py-3">Reviewed At</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reviewedData?.invoices.map((invoice) => {
                                const historyItem = reviewNoteByInvoiceId.get(invoice.id)
                                return (
                                  <motion.tr
                                    key={invoice.id}
                                    whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.95)' }}
                                    className="border-t border-(--line)"
                                  >
                                    <td className="px-4 py-3 font-semibold text-(--ink)">
                                      <Link to={`/invoices/${encodeURIComponent(invoice.invoice_number)}`} className="hover:underline">
                                        {invoice.invoice_number}
                                      </Link>
                                    </td>
                                    <td className="px-4 py-3 text-(--ink)">{invoice.vendor_name}</td>
                                    <td className="px-4 py-3 text-(--ink)">
                                      {formatCurrency(invoice.grand_total, invoice.currency)}
                                    </td>
                                    <td className="max-w-64 px-4 py-3 text-(--muted)">
                                      <motion.span
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 500 }}
                                        className="mb-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800"
                                      >
                                        Reviewed
                                      </motion.span>
                                      <br />
                                      {historyItem?.review_note ? (
                                        <span className="line-clamp-2">{historyItem.review_note}</span>
                                      ) : (
                                        <span className="text-xs">No note</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-(--muted)">
                                      {formatDate(historyItem?.reviewed_at ?? invoice.processed_at)}
                                    </td>
                                  </motion.tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="rounded-2xl border border-(--line) bg-white p-4">
                        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-(--ink)">
                          <MessageSquareText className="h-4 w-4" />
                          Recent Review Notes
                        </h3>
                        {(reviewHistory?.length ?? 0) === 0 ? (
                          <p className="mt-2 text-sm text-(--muted)">No review note history available yet.</p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {reviewHistory?.slice(0, 6).map((item) => (
                              <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl border border-(--line) bg-slate-50 px-3 py-2.5 text-xs"
                              >
                                <p className="font-semibold text-(--ink)">{reviewerName(item)}</p>
                                <p className="mt-0.5 text-(--muted)">{formatDate(item.reviewed_at)}</p>
                                <p className="mt-1 text-(--ink)">{item.review_note || 'No note provided.'}</p>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </PageShell>
      </motion.div>

      <AnimatePresence>
        {selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4"
            onClick={closeResolveModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="w-full max-w-lg rounded-2xl border border-(--line) bg-white p-5 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-(--ink)">Resolve Flagged Invoice</p>
                  <p className="mt-0.5 text-sm text-(--muted)">
                    {selectedInvoice.invoice_number} • {selectedInvoice.vendor_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeResolveModal}
                  className="rounded-full border border-(--line) p-1.5 text-(--muted) hover:bg-slate-50"
                  aria-label="Close resolve modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="inline-flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  This action changes status from FLAGGED to REVIEWED.
                </p>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-semibold uppercase tracking-wide text-(--muted)">
                  Reviewer Note (optional)
                </span>
                <textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  rows={4}
                  placeholder="Add context for this decision..."
                  className="mt-1.5 w-full rounded-xl border border-(--line) px-3 py-2 text-sm text-(--ink) outline-none ring-(--brand)/25 transition focus:ring"
                />
              </label>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeResolveModal}
                  disabled={resolveMutation.isPending}
                  className="rounded-xl border border-(--line) px-4 py-2 text-sm font-semibold text-(--ink) hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={submitReview}
                  disabled={resolveMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {resolveMutation.isPending ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Resolving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Mark as Reviewed
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
