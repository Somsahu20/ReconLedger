import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, AlertTriangle, CheckCircle2, FileSearch } from 'lucide-react'
import { AxiosError } from 'axios'
import { getInvoiceByNumber } from '../api/invoices'
import { InvoicesScene } from '../components/three/InvoicesScene'
import { formatCurrency, formatDate, toStatusLabel } from '../lib/formatters'
import { PageShell } from './PageShell'

function statusClasses(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === 'clean') return 'bg-emerald-100 text-emerald-800'
  if (normalized === 'reviewed') return 'bg-sky-100 text-sky-800'
  return 'bg-amber-100 text-amber-800'
}

export function InvoiceDetailPage() {
  const { invoiceNumber } = useParams()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['invoice', 'detail', invoiceNumber],
    queryFn: () => getInvoiceByNumber(invoiceNumber ?? ''),
    enabled: Boolean(invoiceNumber),
  })

  const notFound =
    error instanceof AxiosError &&
    (error.response?.status === 404 || error.response?.data?.detail === 'Invoice not found')

  const statusLabel = data ? toStatusLabel(data.status) : null
  const isFlagged = statusLabel === 'flagged'

  return (
    <div className="relative">
      <InvoicesScene />
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        <PageShell
          title={`Invoice ${invoiceNumber ?? ''}`}
          description="Review extracted details, line-item arithmetic, and audit insights for this invoice."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Link
                to="/invoices"
                className="inline-flex items-center gap-2 rounded-xl border border-(--line) bg-white px-3 py-1.5 text-xs font-semibold text-(--ink) hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Explorer
              </Link>
            </div>

            {isLoading && (
              <div className="grid gap-3 md:grid-cols-2">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl border border-(--line) bg-white/80" />
                ))}
              </div>
            )}

            {isError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">{notFound ? 'Invoice not found.' : 'Failed to load invoice details.'}</p>
                <p className="mt-1 text-xs">
                  {notFound
                    ? 'This invoice number does not exist or is not associated with your account.'
                    : 'Try refreshing this page or retrying the request.'}
                </p>
                {!notFound && (
                  <button
                    type="button"
                    onClick={() => {
                      void refetch()
                    }}
                    className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {data && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid gap-3 rounded-xl border border-(--line) bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-(--muted)">Vendor</p>
                    <p className="font-semibold text-(--ink)">{data.vendor_name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-(--muted)">Invoice #</p>
                    <p className="font-semibold text-(--ink)">{data.invoice_number}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-(--muted)">Status</p>
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(statusLabel ?? 'flagged')}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-(--muted)">Invoice Date</p>
                    <p className="font-semibold text-(--ink)">{formatDate(data.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-(--muted)">Due Date</p>
                    <p className="font-semibold text-(--ink)">{formatDate(data.due_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-(--muted)">Processed At</p>
                    <p className="font-semibold text-(--ink)">{formatDate(data.processed_at)}</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24 }}
                  className="overflow-hidden rounded-xl border border-(--line) bg-white"
                >
                  <div className="border-b border-(--line) bg-slate-50 px-4 py-3">
                    <h2 className="text-sm font-semibold text-(--ink)">Line Items</h2>
                  </div>

                  {data.line_items.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-(--muted)">No line items available for this invoice.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-(--muted)">
                          <tr>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Qty</th>
                            <th className="px-4 py-3">Unit Price</th>
                            <th className="px-4 py-3">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.line_items.map((item) => (
                            <tr key={item.id} className="border-t border-(--line)">
                              <td className="px-4 py-3 text-(--ink)">{item.description}</td>
                              <td className="px-4 py-3 text-(--ink)">{item.quantity}</td>
                              <td className="px-4 py-3 text-(--ink)">{formatCurrency(item.unit_price, data.currency)}</td>
                              <td className="px-4 py-3 font-semibold text-(--ink)">
                                {formatCurrency(item.line_total, data.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>

                <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26 }}
                    className="rounded-xl border border-(--line) bg-white p-4"
                  >
                    <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-(--ink)">
                      <FileSearch className="h-4 w-4" />
                      Validation Notes
                    </h3>
                    <p className="mt-2 text-sm text-(--muted)">
                      Per-check validation details are generated during upload and review workflows. This page shows stable invoice facts and audit narrative from the persisted invoice record.
                    </p>
                  </motion.section>

                  <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26 }}
                    className="rounded-xl border border-(--line) bg-slate-50 p-4"
                  >
                    <h3 className="text-sm font-semibold text-(--ink)">Invoice Totals</h3>
                    <div className="mt-3 space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-(--muted)">Subtotal</span>
                        <span className="font-semibold text-(--ink)">{formatCurrency(data.subtotal, data.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-(--muted)">Tax ({data.tax_rate}%)</span>
                        <span className="font-semibold text-(--ink)">{formatCurrency(data.tax_amount, data.currency)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-(--line) pt-2">
                        <span className="font-semibold text-(--ink)">Grand Total</span>
                        <span className="text-base font-extrabold text-(--ink)">{formatCurrency(data.grand_total, data.currency)}</span>
                      </div>
                    </div>
                  </motion.section>
                </div>

                {data.audit_report && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border p-4 ${
                      isFlagged
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    }`}
                  >
                    <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
                      {isFlagged ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      Audit Report
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{data.audit_report}</p>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </PageShell>
      </motion.div>
    </div>
  )
}
